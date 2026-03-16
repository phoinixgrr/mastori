---
title: "Building an Air Quality Health Index — From Raw Sensors to Actionable Advice in Home Assistant"
date: 2026-03-02
tags: ["home-assistant", "air-quality", "co2", "pm25", "voc", "ikea", "switchbot", "health"]
summary: "CO2 at 1247 ppm means nothing to most people. 'Open a window for 5 minutes' does. Here's how I combined CO2, PM2.5, VOC, and humidity sensors into a single 0-100 health score with actionable tips — using IKEA VINDSTYRKA and SwitchBot sensors."
---

## The Problem with Raw Numbers

My house has air quality sensors on two floors plus a CO2 monitor. They report numbers like CO2: 847 ppm, PM2.5: 12 µg/m³, VOC index: 194. These are accurate and useful — if you know what they mean.

Nobody looks at a dashboard and thinks "oh, 1200 ppm CO2 with VOC at 310, I should ventilate for about 5 minutes." They want a simple answer: **is the air good or bad, and what should I do about it?**

So I built two things:
1. A **composite health score** (0-100) that weighs all sensors into one number
2. **Actionable tips** that appear on the dashboard telling you exactly what to do — "open a window for 5 minutes" instead of "CO2 is elevated"

## The Sensors

| Device | What it measures | Location |
|--------|-----------------|----------|
| **[IKEA VINDSTYRKA](https://www.ikea.com/us/en/p/vindstyrka-air-quality-sensor-smart-30498239/)** (×2) | PM2.5, VOC index, temperature, humidity | One per floor (via Zigbee) |
| **[SwitchBot Meter Pro CO2](https://www.switch-bot.com/products/switchbot-meter-pro-co2-monitor)** | CO2, temperature, humidity | Central location (via Bluetooth) |

![IKEA VINDSTYRKA — PM2.5, VOC index, temperature, and humidity via Zigbee](vindstyrka-sensors.png)

![SwitchBot Meter Pro — CO2, temperature, and humidity via Bluetooth](switchbot-co2.png)

The VINDSTYRKA is great for particulate matter and volatile organic compounds — it uses a Sensirion sensor that provides both PM2.5 (µg/m³) and a VOC index (1-500). Having two of them (upstairs and downstairs) catches floor-level differences — cooking smoke stays downstairs, cleaning chemicals drift upstairs.

The SwitchBot adds the missing piece: **CO2 monitoring**. CO2 is the single best indicator of ventilation quality, and the VINDSTYRKA doesn't measure it.

## The Health Score: One Number, Weighted

Instead of displaying 4 separate metrics, a template sensor combines them into a single 0-100 score:

![The air quality score on the dashboard — 90/100, "Excellent"](air-quality-score.png)

The weighting reflects how much each metric matters for indoor health:

| Metric | Weight | Why |
|--------|--------|-----|
| **CO2** | 40% | Best indicator of ventilation. Directly affects alertness and comfort. |
| **PM2.5** | 30% | Particulate matter from cooking, dust, outdoor pollution. Long-term health impact. |
| **VOC** | 20% | Volatile organics from cleaning products, paint, furniture off-gassing. |
| **Humidity** | 10% | Affects comfort and mold risk. Less actionable in the short term. |

Each metric is scored independently on a tiered scale:

```yaml
# CO2 scoring (40% weight)
{% if co2 < 700 %}{% set co2_s = 100 %}      # Excellent
{% elif co2 < 900 %}{% set co2_s = 90 %}      # Good
{% elif co2 < 1200 %}{% set co2_s = 70 %}     # Fair
{% elif co2 < 1600 %}{% set co2_s = 45 %}     # Poor
{% else %}{% set co2_s = 20 %}{% endif %}      # Bad

# PM2.5 scoring (30% weight)
{% if pm < 10 %}{% set pm_s = 100 %}
{% elif pm < 15 %}{% set pm_s = 90 %}
{% elif pm < 35 %}{% set pm_s = 65 %}
{% elif pm < 55 %}{% set pm_s = 45 %}
{% else %}{% set pm_s = 20 %}{% endif %}

# VOC scoring (20% weight)
{% if voc < 150 %}{% set voc_s = 100 %}
{% elif voc < 250 %}{% set voc_s = 75 %}
{% elif voc < 400 %}{% set voc_s = 50 %}
{% else %}{% set voc_s = 20 %}{% endif %}

# Humidity scoring (10% weight) — sweet spot is 40-55%
{% if 40 <= hum <= 55 %}{% set hum_s = 100 %}
{% elif (35 <= hum < 40) or (55 < hum <= 60) %}{% set hum_s = 85 %}
{% elif (30 <= hum < 35) or (60 < hum <= 65) %}{% set hum_s = 70 %}
{% else %}{% set hum_s = 50 %}{% endif %}

# Weighted composite
{{ (co2_s*0.40 + pm_s*0.30 + voc_s*0.20 + hum_s*0.10) | round(0) }}
```

For PM2.5 and VOC, the sensor takes the **worst reading** between the two floors — if the kitchen is smoky, the score reflects it even if the bedroom is fine.

The result maps to a human-readable label:

| Score | Label | Emoji |
|-------|-------|-------|
| 85-100 | Excellent | 😄 |
| 70-84 | Good | 🙂 |
| 55-69 | Fair | 😐 |
| 40-54 | Poor | 😟 |
| 0-39 | Very poor | 😷 |

## The Actionable Tips

The score tells you how good the air is. The tips tell you **what to do about it**. They appear as secondary text on the dashboard card, triggered by whichever metric is the worst offender:

```yaml
{% if co2 >= 1600 %}
  Open a window for 8-10 minutes now 🪟
{% elif co2 >= 1200 %}
  Open a window for 5 minutes to bring CO₂ down 🪟
{% elif co2 >= 900 %}
  Open a window for 2-3 minutes for fresh air 👍
{% elif voc_max >= 400 %}
  Ventilate 10 minutes — VOC is very high 🪟
{% elif voc_max >= 250 %}
  Ventilate 5 minutes and avoid sprays/chemicals 🧴
{% elif pm_max >= 55 %}
  PM2.5 high — ventilate and use an air purifier if available 😷
{% elif pm_max >= 35 %}
  Looks like some dust or cooking — ventilate 5 minutes 🍳
{% endif %}
```

The tips are prioritized: CO2 first (most common and most actionable), then VOC, then PM2.5. If everything is fine, no tip is shown — the score speaks for itself.

![Dashboard showing all raw values — PM2.5 and VOC per floor, CO2 central](air-quality-cards.png)

## The Dashboard Card

The whole thing is displayed on a single Mushroom card that changes color based on the score — green gradient for excellent, amber for fair, red for poor. The icon color matches. When a tip is active, the card gets slightly taller to accommodate the advice text.

The raw sensor values are still available on separate cards for anyone who wants the detail. But the health score card is the one people actually look at.

## Why These Thresholds?

The CO2 thresholds are based on well-established research:

- **< 700 ppm** — outdoor-like quality, excellent ventilation
- **700-900 ppm** — good, typical well-ventilated room
- **900-1200 ppm** — fair, starting to feel stuffy, cognitive performance begins to decline
- **1200-1600 ppm** — poor, drowsiness and reduced concentration
- **> 1600 ppm** — bad, headaches possible, ventilate immediately

PM2.5 follows WHO guidelines (annual mean < 5 µg/m³, 24-hour mean < 15 µg/m³), adjusted upward for practical indoor use where cooking and cleaning create temporary spikes.

VOC index thresholds follow the Sensirion SGP40 interpretation guide — the VINDSTYRKA uses this exact sensor.

## The Takeaway

Raw sensor values are for engineers. A 0-100 score with an emoji is for everyone else. And a specific tip — "open a window for 5 minutes" — is what actually gets someone to act.

The template sensor is about 30 lines of Jinja2 with no helpers, no automations, and no external dependencies. The dashboard card adds the human layer on top. Together, they turn three sensors and a bunch of numbers into something anyone understands at a glance.

## Appendix: Full Template Sensor

<details>
<summary>Click to expand — Air Quality Health Index YAML</summary>

```yaml
template:
  - sensor:
      - name: "Air Quality Health Index"
        unique_id: air_quality_health_index
        unit_of_measurement: "%"
        icon: mdi:air-filter
        state_class: measurement
        availability: >
          {{ states('sensor.your_co2_sensor') not in ['unknown','unavailable','none',''] }}
        state: >
          {% set co2 = states('sensor.your_co2_sensor') | float(0) %}
          {% set hum = states('sensor.your_humidity_sensor') | float(0) %}
          {% set pmD = states('sensor.your_pm25_downstairs') | float(0) %}
          {% set pmU = states('sensor.your_pm25_upstairs') | float(0) %}
          {% set vocD = states('sensor.your_voc_downstairs') | float(0) %}
          {% set vocU = states('sensor.your_voc_upstairs') | float(0) %}
          {% set pm  = [pmD, pmU] | max %}
          {% set voc = [vocD, vocU] | max %}

          {# CO2 scoring (40% weight) #}
          {% if co2 == 0 %}{% set co2_s = 0 %}
          {% elif co2 < 700 %}{% set co2_s = 100 %}
          {% elif co2 < 900 %}{% set co2_s = 90 %}
          {% elif co2 < 1200 %}{% set co2_s = 70 %}
          {% elif co2 < 1600 %}{% set co2_s = 45 %}
          {% else %}{% set co2_s = 20 %}{% endif %}

          {# PM2.5 scoring (30% weight) #}
          {% if pm < 10 %}{% set pm_s = 100 %}
          {% elif pm < 15 %}{% set pm_s = 90 %}
          {% elif pm < 35 %}{% set pm_s = 65 %}
          {% elif pm < 55 %}{% set pm_s = 45 %}
          {% else %}{% set pm_s = 20 %}{% endif %}

          {# VOC scoring (20% weight) #}
          {% if voc < 150 %}{% set voc_s = 100 %}
          {% elif voc < 250 %}{% set voc_s = 75 %}
          {% elif voc < 400 %}{% set voc_s = 50 %}
          {% else %}{% set voc_s = 20 %}{% endif %}

          {# Humidity scoring (10% weight) #}
          {% if hum == 0 %}{% set hum_s = 0 %}
          {% elif 40 <= hum <= 55 %}{% set hum_s = 100 %}
          {% elif (35 <= hum < 40) or (55 < hum <= 60) %}{% set hum_s = 85 %}
          {% elif (30 <= hum < 35) or (60 < hum <= 65) %}{% set hum_s = 70 %}
          {% else %}{% set hum_s = 50 %}{% endif %}

          {{ (co2_s*0.40 + pm_s*0.30 + voc_s*0.20 + hum_s*0.10) | round(0) | int }}
```

</details>

## Appendix: Dashboard Card (Mushroom Template)

<details>
<summary>Click to expand — Mushroom card YAML with dynamic colors and tips</summary>

```yaml
type: custom:mushroom-legacy-template-card
entity: sensor.air_quality_health_index
primary: >
  {% set raw = states('sensor.air_quality_health_index') %}
  {% if raw in ['unknown', 'unavailable', 'none', 'None', ''] %}
    Air Quality · —
  {% else %}
    {% set score = raw | int(0) %}
    {% if score >= 85 %}
      {% set mood = '😄' %}{% set label = 'Excellent' %}
    {% elif score >= 70 %}
      {% set mood = '🙂' %}{% set label = 'Good' %}
    {% elif score >= 55 %}
      {% set mood = '😐' %}{% set label = 'Fair' %}
    {% elif score >= 40 %}
      {% set mood = '😟' %}{% set label = 'Poor' %}
    {% else %}
      {% set mood = '😷' %}{% set label = 'Very poor' %}
    {% endif %}
    Air Quality · {{ mood }} {{ label }} · {{ score }}/100
  {% endif %}
secondary: >
  {% set co2 = states('sensor.your_co2_sensor') | float(0) %}
  {% set pmD = states('sensor.your_pm25_downstairs') | float(0) %}
  {% set pmU = states('sensor.your_pm25_upstairs') | float(0) %}
  {% set vocD = states('sensor.your_voc_downstairs') | float(0) %}
  {% set vocU = states('sensor.your_voc_upstairs') | float(0) %}
  {% set pm_max = [pmD, pmU] | max %}
  {% set voc_max = [vocD, vocU] | max %}
  {% set msg = '' %}

  {% if co2 >= 1600 %}
    {% set msg = "Open a window for 8-10 min now 🪟" %}
  {% elif co2 >= 1200 %}
    {% set msg = "Open a window for 5 min to bring CO₂ down 🪟" %}
  {% elif co2 >= 900 %}
    {% set msg = "Open a window for 2-3 min for fresh air 👍" %}
  {% elif voc_max >= 400 %}
    {% set msg = "Ventilate 10 min — VOC is very high 🪟" %}
  {% elif voc_max >= 250 %}
    {% set msg = "Ventilate 5 min and avoid sprays/chemicals 🧴" %}
  {% elif pm_max >= 55 %}
    {% set msg = "PM2.5 high — ventilate and use air purifier 😷" %}
  {% elif pm_max >= 35 %}
    {% set msg = "Some dust or cooking — ventilate 5 min 🍳" %}
  {% endif %}
  {{ msg }}
multiline_secondary: true
icon: mdi:air-filter
icon_color: >
  {% set raw = states('sensor.air_quality_health_index') %}
  {% if raw in ['unknown', 'unavailable', 'none', 'None', ''] %}
    disabled
  {% else %}
    {% set score = raw | int(0) %}
    {% if score >= 85 %}green
    {% elif score >= 70 %}light-green
    {% elif score >= 55 %}amber
    {% elif score >= 40 %}orange
    {% else %}red{% endif %}
  {% endif %}
layout: horizontal
fill_container: true
tap_action:
  action: more-info
  entity: sensor.air_quality_health_index
card_mod:
  style: >
    {% set raw = states('sensor.air_quality_health_index') %}
    {% set score = 0 if raw in ['unknown','unavailable','none','None','']
       else raw | int(0) %}

    {% if score >= 85 %}
      {% set bg = 'linear-gradient(135deg, rgba(16,185,129,.16), rgba(16,185,129,.06))' %}
      {% set ring = '0 0 0 1.5px rgba(16,185,129,.40)' %}
    {% elif score >= 70 %}
      {% set bg = 'linear-gradient(135deg, rgba(34,197,94,.14), rgba(22,163,74,.06))' %}
      {% set ring = '0 0 0 1.5px rgba(34,197,94,.34)' %}
    {% elif score >= 55 %}
      {% set bg = 'linear-gradient(135deg, rgba(217,119,6,.22), rgba(146,64,14,.10))' %}
      {% set ring = '0 0 0 1.5px rgba(217,119,6,.50)' %}
    {% elif score >= 40 %}
      {% set bg = 'linear-gradient(135deg, rgba(249,115,22,.18), rgba(154,52,18,.08))' %}
      {% set ring = '0 0 0 1.5px rgba(249,115,22,.42)' %}
    {% else %}
      {% set bg = 'linear-gradient(135deg, rgba(239,68,68,.16), rgba(127,29,29,.08))' %}
      {% set ring = '0 0 0 1.5px rgba(239,68,68,.42)' %}
    {% endif %}

    ha-card {
      padding: 14px 16px 12px;
      border-radius: 18px;
      background: {{ bg }};
      --mush-icon-size: 34px;
      --mush-card-primary-font-size: 1.20rem;
      --mush-card-secondary-font-size: .90rem;
      position: relative;
      overflow: hidden;
    }
    ha-card::after {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: 20px;
      box-shadow: {{ ring }};
      pointer-events: none;
    }
```

</details>
