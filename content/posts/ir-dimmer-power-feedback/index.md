---
title: "Turning a Dumb IR Dimmer into a Smart Light — Power Monitoring as Brightness Feedback"
date: 2025-01-10
tags: ["home-assistant", "broadlink", "shelly", "ir", "lighting", "template"]
summary: "My living room dimmer only understands IR up/down commands. No smart protocol, no brightness reporting. So I built a closed-loop virtual dimmer in Home Assistant — using a Shelly power monitor as the brightness sensor and a Broadlink IR blaster as the controller."
---

## The Problem

The living room light is controlled by a dumb IR dimmer. No WiFi, no Zigbee, no state reporting. Just a remote with power, up, and down buttons. Pressing "up" increases brightness one step. That's it.

I wanted a proper HA light entity with a slider — drag it to 70%, and the light goes to 70%. But the dimmer has no way to report its current brightness, and no way to jump to a specific level. Only relative up/down.

## The Hack: Power Consumption as Brightness

A Shelly power monitor on the light circuit measures real-time wattage. And wattage maps directly to brightness — dim light uses less power, bright light uses more.

I measured the power at each of the 10 brightness steps:

| Step | Power (W) |
|------|-----------|
| 0 (off) | 0 |
| 1 | 2 |
| 2 | 13 |
| 3 | 23 |
| 4 | 35 |
| 5 | 46 |
| 6 | 57 |
| 7 | 69 |
| 8 | 80 |
| 9 (max) | 90 |

Now I have a brightness sensor — just read the wattage, find the closest match in the table, and that's the current step.

## The Virtual Light Entity

A template light in HA ties it all together:

```yaml
- name: "Living Room Dimmer"
  unique_id: saloni_virtual_dimmer
  icon: mdi:lamps

  # On/Off from the Shelly relay
  state: "{{ is_state('switch.shelly_dimmer_relay', 'on') }}"

  # Brightness 0-255 derived from power consumption
  level: >
    {% set p = states('sensor.shelly_dimmer_power') | float(0) %}
    {% set levels = [0, 2, 13, 23, 35, 46, 57, 69, 80, 90] %}
    {% set ns = namespace(idx=0, mindiff=999) %}
    {% for l in levels %}
      {% set d = (p - l) | abs %}
      {% if d < ns.mindiff %}
        {% set ns.mindiff = d %}
        {% set ns.idx = loop.index0 %}
      {% endif %}
    {% endfor %}
    {{ (255 * ns.idx / 9) | round(0) }}

  turn_on:
    service: switch.turn_on
    target:
      entity_id: switch.shelly_dimmer_relay

  turn_off:
    service: switch.turn_off
    target:
      entity_id: switch.shelly_dimmer_relay

  # Slider movement triggers the brightness script
  set_level:
    - service: script.living_room_set_brightness
      data:
        brightness: "{{ brightness }}"
```

From HA's perspective, this is a normal dimmable light. The slider works, automations can set brightness, and the state always reflects reality.

## The Brightness Script: Closed-Loop Control

When you move the slider, the script:

1. Reads current power from the Shelly
2. Maps it to the nearest step index (0-9)
3. Calculates the target step from the requested brightness (0-255)
4. Sends the exact number of IR up/down commands via the Broadlink

```yaml
living_room_set_brightness:
  alias: "Living Room Set Brightness"
  mode: single
  fields:
    brightness:
      description: "Brightness 0-255"
  sequence:
    - service: switch.turn_on
      target:
        entity_id: switch.shelly_dimmer_relay

    - variables:
        levels: [0, 2, 13, 23, 35, 46, 57, 69, 80, 90]

        # Target step from brightness slider
        target_idx: >
          {% set b = brightness | int(0) %}
          {{ (b / 255 * 9) | round(0) | int }}

        # Current step from power consumption
        p: "{{ states('sensor.shelly_dimmer_power') | float(0) }}"
        ns: >
          {% set ns = namespace(idx=0, mindiff=999) %}
          {% for l in levels %}
            {% set d = (p - l) | abs %}
            {% if d < ns.mindiff %}
              {% set ns.mindiff = d %}
              {% set ns.idx = loop.index0 %}
            {% endif %}
          {% endfor %}
          {{ ns.idx }}
        current_idx: "{{ ns | int(0) }}"

        steps: "{{ (target_idx - current_idx) | int }}"
        direction: "{{ 1 if steps > 0 else (-1 if steps < 0 else 0) }}"
        steps_abs: "{{ steps | abs }}"

    - choose:
        # Send UP commands
        - conditions: "{{ direction == 1 }}"
          sequence:
            - service: remote.send_command
              target:
                entity_id: remote.rf_living_room
              data:
                device: light_living_room
                command: up
                num_repeats: "{{ steps_abs }}"
                delay_secs: 0.25

        # Send DOWN commands
        - conditions: "{{ direction == -1 }}"
          sequence:
            - service: remote.send_command
              target:
                entity_id: remote.rf_living_room
              data:
                device: light_living_room
                command: down
                num_repeats: "{{ steps_abs }}"
                delay_secs: 0.25

    # Wait for power reading to stabilize
    - delay:
        seconds: 4
```

The key insight: `num_repeats` sends multiple IR commands in sequence with a configurable delay. So if you're at step 3 and want step 7, it sends 4 "up" commands — no loop needed.

## Why This Works

The closed loop is what makes it reliable:

1. **No drift** — even if an IR command is missed, the next slider movement reads actual power and recalculates from reality, not from assumed state
2. **Survives restarts** — the brightness is derived from live power data, not stored state
3. **Works with automations** — the Jellyfin cinema mode automation dims this light to 1% on play and restores it on stop, using the same slider

## The Hardware

| Component | Role |
|-----------|------|
| **Dumb IR dimmer** | The light fixture's built-in controller |
| **[Broadlink RM4](https://www.ibroadlink.com/)** | Sends IR up/down/power commands |
| **[Shelly 1PM](https://www.shelly.com/products/shelly-plus-1-pm)** | Power monitoring + on/off relay |
| **Home Assistant** | Template light + brightness script |

## The Takeaway

If a device has no smart protocol but responds to IR and draws measurable power, you can close the loop: **power consumption becomes your state sensor, IR becomes your actuator, and a template light ties them together.**

The pattern works for any IR-controlled device where power correlates with state — dimmers, fan speed controllers, heaters with multiple modes. Measure the power at each setting once, build the lookup table, and you have a virtual smart device.
