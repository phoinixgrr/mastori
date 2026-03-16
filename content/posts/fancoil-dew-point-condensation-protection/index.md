---
title: "Preventing Condensation on Fancoils — Dew Point Monitoring with Home Assistant"
date: 2025-02-15
tags: ["home-assistant", "heat-pump", "hvac", "dew-point", "condensation", "lg-therma-v", "fancoil"]
summary: "When your heat pump pushes cold water through fancoil pipes and the water is too cold for the room's humidity, moisture condenses everywhere — dripping fancoils, wet walls, and mold. Here's how I calculate per-room dew points in Home Assistant and derive a safe minimum water temperature to prevent it."
---

## The Problem

My house uses an air-to-water heat pump (LG Therma V) for both heating and cooling. In cooling mode, the pump chills water and circulates it through pipes to fancoil units in every room. The fancoils blow air over the cold pipes, cooling the room.

This works great — until the water gets **too cold** for the room's humidity level. When that happens, moisture from the air condenses on the cold pipes and coils, exactly like a cold beer glass sweating on a summer day. Except it's happening inside your walls, behind your fancoils, and on every pipe fitting in between.

**What happens if you don't control this:**

- Pipes sweat and drip inside walls and ceilings
- Walls near fancoils get damp patches
- Mold starts growing behind and around the units — especially in corners with poor airflow
- Over time, paint peels, plaster degrades, and you have a real moisture damage problem
- In extreme cases, fancoil units can start dripping water onto the floor — most fancoils have a condensate drip tray and drain line, but they're designed for normal dehumidification during operation, not for the volume of water you get when the pipes are well below the dew point. That water needs to go somewhere — either to a drain line (if one was installed) or it overflows onto your floor

This is not a theoretical concern. In a humid Greek summer with indoor humidity around 55-65%, the danger zone is closer than you'd think. If your heat pump is pushing water at 15°C and the room dew point is 17°C, every fancoil in the house becomes an uncontrolled dehumidifier — dripping water with no drain to catch it.

The heat pump itself doesn't know the indoor dew point. It just chills water to whatever setpoint you give it. So it's up to you to make sure that setpoint never goes below the danger zone.

## The Physics: What is Dew Point?

The dew point is the temperature at which air becomes saturated and moisture starts condensing on surfaces. It depends on two things: **air temperature** and **relative humidity**.

At 25°C and 60% humidity, the dew point is about 16.7°C. At 25°C and 50% humidity, it drops to about 13.9°C. The higher the humidity, the closer the dew point is to the actual air temperature — and the more dangerous cooling becomes.

The formula is the [**Magnus approximation**](https://gasquip.com/dew-point-calculator-for-moisture/):

```
γ = ln(RH/100) + (a × T) / (b + T)
Dew Point = (b × γ) / (a - γ)

where a = 17.62, b = 243.12, T in °C, RH in %
```

## The Implementation

I have temperature and humidity sensors in every room. Each room has a [Broadlink RM4](https://www.ibroadlink.com/) IR blaster (used to control the fancoils via infrared), and these units support an optional [external temperature/humidity cable sensor](https://www.amazon.com/Broadlink-Accessory-Temperature-Humidity-Monitor/dp/B081F3C4T4) that plugs directly into them. So every IR blaster doubles as a room climate sensor — no extra hardware needed. Each one gets a dew point template sensor:

```yaml
- name: indoor_dew_point_living
  unit_of_measurement: "°C"
  state: >
    {% set T  = states('sensor.living_room_temperature') | float(0) %}
    {% set RH = states('sensor.living_room_humidity') | float(0) %}
    {% set a = 17.62 %}
    {% set b = 243.12 %}
    {% set gamma = (RH/100.0) | log + (a*T)/(b+T) %}
    {{ (b*gamma/(a-gamma)) | round(1) }}
```

Same pattern for every room: living room, bedroom downstairs, both bedrooms upstairs, and the server rack room (which runs hotter due to equipment heat and has its own humidity profile).

### The Worst-Case Room

Condensation risk is determined by the room with the **highest** dew point — that's where water will condense first. A max sensor picks the worst case:

```yaml
- name: indoor_dew_point_max
  unit_of_measurement: "°C"
  state: >
    {% set vals = [
      states('sensor.indoor_dew_point_living') | float(0),
      states('sensor.indoor_dew_point_kato') | float(0),
      states('sensor.indoor_dew_point_pano_megalo') | float(0),
      states('sensor.indoor_dew_point_pano_mikro') | float(0),
      states('sensor.indoor_dew_point_rack') | float(0)
    ] %}
    {{ (vals | max) | round(1) }}
```

### The Safety Margin

The safe minimum water temperature isn't just "dew point + 1°C". There are two buffers to account for:

1. **Oscillation buffer (2.0°C)** — the heat pump doesn't hold an exact temperature. Water temp oscillates around the setpoint as the compressor cycles. If your setpoint is right at the dew point, the troughs of the oscillation will dip below it.

2. **Safety buffer (1.0°C)** — extra headroom for sensor accuracy, local humidity pockets near windows or bathrooms, and the fact that pipe surface temperature is slightly colder than the water inside.

```yaml
- name: lg_therma_safe_setpoint
  unit_of_measurement: "°C"
  state: >
    {% set dew = states('sensor.indoor_dew_point_max') %}
    {% if dew not in ['unknown', 'unavailable', 'none'] %}
      {% set osc = 2.0 %}
      {% set buf = 1.0 %}
      {{ (dew | float + osc + buf) | round(1) }}
    {% else %}
      unknown
    {% endif %}
```

So if the worst-case room has a dew point of 17.2°C, the safe setpoint is **20.2°C**. Any water colder than that risks condensation somewhere in the house.

### The Live Margin

A real-time sensor shows how close the current outlet water is to the danger zone:

```yaml
- name: dewpoint_margin
  unit_of_measurement: "°C"
  state: >
    {{ (states('sensor.lg_therma_outlet_temp') | float(0)
      - states('sensor.indoor_dew_point_max') | float(0)) | round(1) }}
```

When this drops below 3°C, you're getting close. Below 0°C means condensation is already happening.

## How to Read It

{{< mermaid >}}
flowchart LR
    A["Room temp\n25°C"] --> B["Room humidity\n60%"]
    B --> C["Dew point\n16.7°C"]
    C --> D["+ 2.0°C oscillation\n+ 1.0°C safety"]
    D --> E["Safe setpoint\n19.7°C"]
    F["Outlet water\n22°C"] --> G["Margin\n5.3°C"]
    C --> G

    style E fill:#166534,stroke:#22c55e,color:#fff
    style G fill:#166534,stroke:#22c55e,color:#fff
{{< /mermaid >}}

- **Margin > 3°C** — safe, no condensation risk
- **Margin 1-3°C** — getting close, watch it
- **Margin < 1°C** — condensation likely, raise the setpoint or dehumidify

## What This Gives You

With these 4 template sensors, you have:

| Sensor | What it tells you |
|--------|---|
| `indoor_dew_point_*` (per room) | Current dew point in each room |
| `indoor_dew_point_max` | Worst-case room — the one closest to condensation |
| `lg_therma_safe_setpoint` | Minimum safe water temperature right now |
| `dewpoint_margin` | How many degrees of safety you currently have |

You can put `dewpoint_margin` on a dashboard gauge, set up a notification if it drops below 2°C, or — if you want full automation — use `lg_therma_safe_setpoint` to dynamically clamp the heat pump's cooling setpoint so it physically cannot go below the safe minimum.

## How to Fight Condensation

Monitoring is the first step. Once you can see the dew point and margin in real time, you have three levers to pull:

1. **Raise the water temperature setpoint** — tell the heat pump to produce warmer water. You lose some cooling power, but you stay above the dew point. This is the safest and most immediate fix.

2. **Increase fancoil fan speed** — higher airflow over the coils means better heat exchange at a higher water temperature. The room still gets cooled, but the coil surface stays warmer. This compensates for the raised setpoint.

3. **Run dehumidifiers** — lower the room humidity and the dew point drops with it. If you bring humidity from 60% to 45%, the dew point drops by several degrees, giving you more room to cool aggressively. The downside: you're now running both the heat pump and dehumidifiers simultaneously, which adds to your electricity bill. It's effective but costly — essentially paying twice to condition the same air.

In practice, the best approach is a combination: raise the setpoint slightly, bump the fan speed, and let dehumidifiers handle the humidity. The three levers work together.

### Next Steps: Full Automation

Right now, the monitoring is in place — per-room dew points, worst-case tracking, safe setpoint, and live margin. But the response is still manual.

The end goal is to close the loop automatically:

- **Telegram notification** when the margin drops below a threshold — so I know something needs attention
- **Automatic setpoint adjustment** — clamp the heat pump's cooling setpoint to never go below the safe minimum
- **Automatic dehumidifier control** — turn on the house dehumidifiers when humidity pushes the dew point too close to the water temperature
- **Fancoil fan speed control** — increase fan speed via IR when the margin is tight, reduce when it's comfortable

Not there yet — but the sensors and the data are ready. The automation is the next project.

## The Takeaway

Air-to-water cooling with fancoils is efficient and comfortable, but the water temperature has a hard floor — and that floor moves with room humidity. Go below it and you get dripping pipes, sweating fancoils, damp walls, and eventually mold.

The fix starts with 4 template sensors in Home Assistant: calculate dew point per room using the Magnus formula (4 lines of Jinja2), pick the worst case, add a 3°C total safety margin, and you have a live "don't go below this" number. From there, you raise the setpoint, increase fan speed, run dehumidifiers — or ideally, automate all three.

## Appendix: All Template Sensors

<details>
<summary>Click to expand — Dew Point + Safety Sensors YAML</summary>

```yaml
template:
  - sensor:
      # Per-room dew points (Magnus approximation)
      - name: indoor_dew_point_living
        unit_of_measurement: "°C"
        state: >
          {% set T  = states('sensor.living_room_temperature') | float(0) %}
          {% set RH = states('sensor.living_room_humidity') | float(0) %}
          {% set a = 17.62 %}{% set b = 243.12 %}
          {% set gamma = (RH/100.0) | log + (a*T)/(b+T) %}
          {{ (b*gamma/(a-gamma)) | round(1) }}

      - name: indoor_dew_point_bedroom_down
        unit_of_measurement: "°C"
        state: >
          {% set T  = states('sensor.bedroom_down_temperature') | float(0) %}
          {% set RH = states('sensor.bedroom_down_humidity') | float(0) %}
          {% set a = 17.62 %}{% set b = 243.12 %}
          {% set gamma = (RH/100.0) | log + (a*T)/(b+T) %}
          {{ (b*gamma/(a-gamma)) | round(1) }}

      - name: indoor_dew_point_bedroom_up_large
        unit_of_measurement: "°C"
        state: >
          {% set T  = states('sensor.bedroom_up_large_temperature') | float(0) %}
          {% set RH = states('sensor.bedroom_up_large_humidity') | float(0) %}
          {% set a = 17.62 %}{% set b = 243.12 %}
          {% set gamma = (RH/100.0) | log + (a*T)/(b+T) %}
          {{ (b*gamma/(a-gamma)) | round(1) }}

      - name: indoor_dew_point_bedroom_up_small
        unit_of_measurement: "°C"
        state: >
          {% set T  = states('sensor.bedroom_up_small_temperature') | float(0) %}
          {% set RH = states('sensor.bedroom_up_small_humidity') | float(0) %}
          {% set a = 17.62 %}{% set b = 243.12 %}
          {% set gamma = (RH/100.0) | log + (a*T)/(b+T) %}
          {{ (b*gamma/(a-gamma)) | round(1) }}

      # Worst-case room
      - name: indoor_dew_point_max
        unit_of_measurement: "°C"
        state: >
          {% set vals = [
            states('sensor.indoor_dew_point_living') | float(0),
            states('sensor.indoor_dew_point_bedroom_down') | float(0),
            states('sensor.indoor_dew_point_bedroom_up_large') | float(0),
            states('sensor.indoor_dew_point_bedroom_up_small') | float(0)
          ] %}
          {{ (vals | max) | round(1) }}

      # How close outlet water is to condensation
      - name: dewpoint_margin
        unit_of_measurement: "°C"
        state: >
          {{ (states('sensor.heat_pump_outlet_temp') | float(0)
            - states('sensor.indoor_dew_point_max') | float(0)) | round(1) }}

      # Minimum safe water temperature
      - name: safe_cooling_setpoint
        unit_of_measurement: "°C"
        state: >
          {% set dew = states('sensor.indoor_dew_point_max') %}
          {% if dew not in ['unknown', 'unavailable', 'none'] %}
            {% set osc = 2.0 %}
            {% set buf = 1.0 %}
            {{ (dew | float + osc + buf) | round(1) }}
          {% else %}
            unknown
          {% endif %}
```

</details>
