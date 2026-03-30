---
title: "EcoFlow Stream Ultra + AC Pro — The Parallel Battery Imbalance Nobody Warns You About"
date: 2026-03-30
draft: false
tags: ["ecoflow", "solar", "battery", "zero-export", "home-assistant", "ev-charging", "stream-ultra", "stream-ac-pro", "firmware", "bug"]
summary: "When you connect a Stream Ultra and AC Pro in parallel, you'd expect them to charge together. They don't. The Ultra hogs all PV under load, and throttles solar at 100% instead of feeding the AC Pro. Here's the data, the impact, and the workaround."
keywords: ["ecoflow stream ultra ac pro parallel charging", "ecoflow battery imbalance", "ecoflow mppt throttling", "stream ultra ac pro soc drift", "ecoflow parallel battery bug", "ecoflow firmware issue"]
---

## The Promise

EcoFlow [markets the Stream Ultra + AC Pro combo](https://eu.ecoflow.com/products/stream-ultra-pro) as a seamless expansion: plug in a second battery, double your storage from 1.92kWh to 3.84kWh, and enjoy longer self-consumption. The product page says:

> *"Intelligent energy management across all connected devices"*

In practice, the energy management between the two units has a significant gap that leads to **wasted solar production and unbalanced batteries** — particularly when there's any meaningful output load.

## The Setup

| Component | Model | Role |
|-----------|-------|------|
| **Stream Ultra** | EcoFlow Stream Ultra | Inverter + 1.92kWh battery + 4 MPPT solar inputs (up to 2000W) |
| **Stream AC Pro** | EcoFlow Stream AC Pro | Additional 1.92kWh battery — **no solar inputs, no inverter** |
| **Connection** | EcoFlow parallel AC cable | AC coupling between the two units |
| **Solar** | 4× 520W bifacial panels | ~2kW peak production |
| **Load** | go-e EV charger on phase C | ~1.4kW at 6A single-phase |

The AC Pro has zero MPPT inputs. It can only receive energy from the Ultra via the AC parallel cable. This means every watt going to the AC Pro must be:

1. Generated as DC by the Ultra's MPPT
2. Converted to AC by the Ultra's inverter
3. Sent over the parallel cable
4. Converted back to DC by the AC Pro

This AC coupling path has 20-30% conversion losses — a known trade-off documented by EcoFlow. That's not the problem I'm reporting here.

## The Problem: Three Firmware Behaviors That Compound

### Behavior 1: Ultra prioritizes itself under load

The moment a significant load appears on the output — like an EV charger drawing 1.4kW — the Ultra stops sharing PV with the AC Pro. **All solar energy goes to: (1) feeding the output load, (2) charging the Ultra's own battery.** The AC Pro receives nothing.

This happens regardless of the AC Pro's state of charge. Even if the AC Pro is at 15% and the Ultra is at 80%, the Ultra will not share.

### Behavior 2: No redistribution at 100%

When the Ultra's battery reaches 100%, instead of redirecting surplus PV to the AC Pro (which might be sitting at 50%), the inverter **throttles MPPT completely**. PV production drops to 0W.

The sun is shining. The panels are capable of producing 2kW. The AC Pro is half empty and connected via the parallel cable. But the system throttles solar input to zero because the *Ultra's* battery is full.

### Behavior 3: Combined SOC is misleading

The combined SOC reported to integrations (including Home Assistant and the EcoFlow app) averages both batteries. When the Ultra is at 99% and the AC Pro is at 52%, the combined SOC reads ~78%.

Any automation or display relying on this number will make wrong decisions. The system *looks* healthy at 78% while it's actually about to throttle all solar production.

## The Evidence

Here's real data from my system on March 30, 2026. Both batteries started the morning at ~15% and charged together until around 11:00 — that's when EV surplus charging started.

**Top graph:** Battery SOC. Ultra (blue) pulls away sharply from AC Pro (orange) the moment EV charging begins. By 14:00, Ultra is at ~95% while AC Pro is at ~65% — a 30% gap.

**Bottom graph:** PV power from all 4 strings. Note the production drops to zero around 14:00 when Ultra hits maximum, despite full sunshine. The gaps are solar energy that was **produced by the panels but rejected by the system**.

![Top: Battery SOC divergence — Ultra (blue) pulls away from AC Pro (orange) when EV charging starts. Bottom: PV power from all 4 strings drops to zero when Ultra hits max, despite AC Pro still needing charge.](battery-imbalance-graph.png)

Home Assistant sensor data at the moment of throttling:

```
🔋 BATTERY
  combined: 78%  Ultra: 99.3%  AC Pro: 56.2%  gap: 43%
  power: -316W  charge: 0W  discharge: 316W

☀️ PV
  PV: 0.0kW ← panels throttled despite full sunshine
```

The battery is **discharging** at 316W to cover house load, while the panels sit idle. The AC Pro has 0.83kWh of empty capacity that could absorb this energy.

## Quantifying the Waste

On a typical sunny day in Athens (March-September), this behavior wastes approximately:

- **0.5-1.0 kWh per day** in clipped solar production (Ultra full, AC Pro not full, PV throttled)
- **Over a 6-month sunny season**, that's roughly **90-180 kWh** — enough to drive a Tesla ~500-1000 km
- The AC Pro cost ~€400. If 40% of its capacity is regularly unreachable due to this imbalance, the effective cost per usable kWh doubles

These numbers depend on load patterns, but the fundamental point stands: you're paying for 3.84kWh of storage and reliably getting ~2.5-3.0kWh because the system can't balance itself under load.

## How to Reproduce

This is fully reproducible. Any Stream Ultra + AC Pro (or Stream AC) owner can observe this:

1. Start with both batteries at similar SOC (e.g., both at 30% in the morning)
2. Let them charge from solar — they'll track together
3. Turn on any sustained load > 500W on the EcoFlow-backed phase
4. Watch the Ultra's SOC climb while the AC Pro stalls
5. Wait for Ultra to reach 100%
6. Observe PV production drop to 0W while AC Pro is still below 100%

**Required for observation:** Individual battery SOC sensors. The combined SOC hides the problem. In Home Assistant with the [EcoFlow Cloud integration](https://github.com/tolwi/hassio-ecoflow-cloud) or [local API integration](https://github.com/marq24/ha-ecoflow-stream-ultra), the relevant sensors are:

```
sensor.stream_ultra_*_power_battery_soc    # Ultra SOC
sensor.stream_ac_pro_power_battery_soc      # AC Pro SOC
sensor.stream_ultra_*_power_pv_sum          # Total PV production
```

## The Chicken-and-Egg Trap

My first workaround attempt: stop the load periodically to let the AC Pro catch up. This works — but only if the Ultra isn't already at 100%.

| Ultra SOC | Output load | PV flows? | AC Pro charges? |
|-----------|-------------|-----------|-----------------|
| < 95% | Yes (EV) | Yes | **No** — Ultra takes everything |
| < 95% | No | Yes | **Yes** — surplus shared via AC cable |
| 100% | No | **No** — MPPT throttled | **No** — nothing flows |
| 100% | Yes (EV) | Resumes | **No** — goes to load, not AC Pro |

The bottom-right cell is the trap: turning the load back on un-throttles PV, but that energy goes to the load — not to the AC Pro. You can't win once Ultra is at 100%.

## My Automation Workaround

Since this can't be fixed from outside the firmware, I built a **battery balancing cycle** into my [PV surplus EV charging automation](/posts/pv-surplus-ev-charging/). The key: **balance early, before the Ultra hits 100%.**

```yaml
# Individual battery tracking
ultra_soc: "{{ states('sensor.stream_ultra_akis_power_battery_soc') | float(0) }}"
ac_pro_soc: "{{ states('sensor.stream_ac_pro_power_battery_soc') | float(0) }}"
battery_gap: "{{ (ultra_soc - ac_pro_soc) | abs }}"

# Start gate: don't charge EV if gap > 10% (unless Ultra >= 95%, then give up)
battery_balanced: "{{ battery_gap <= 10 or ultra_soc >= 95 }}"

# Stop gate: stop EV if gap > 20% AND Ultra < 95% (still time to fix)
battery_imbalanced_and_fixable: "{{ battery_gap > 20 and ultra_soc < 95 }}"
```

### The cycle

1. **Morning:** Both batteries charge together. Gap is small.
2. **Surplus detected:** EV charging starts at 6A single-phase (~1.4kW).
3. **Gap grows to 20%** while Ultra is still at e.g. 60%: automation stops EV.
4. PV is still flowing (Ultra isn't full). **AC Pro catches up** via the parallel cable.
5. **Gap drops to 10%:** EV resumes.
6. Repeat until both batteries are high.
7. **Ultra hits 95%:** Automation **gives up on balancing** — charges EV regardless. No point pausing; PV will throttle soon anyway and the AC cable can't fill the AC Pro fast enough.

The 10%/20% hysteresis prevents rapid start/stop flapping. The 95% bypass avoids blocking the EV when balancing is physically impossible.

### The cost

Each balance pause takes 20-30 minutes (the AC Pro charges slowly over the AC cable). On a sunny day: 2-3 charge/pause/charge cycles. You trade some EV charging time for actually using the storage capacity you paid for.

## What EcoFlow Should Fix in Firmware

These are specific, actionable firmware changes — not vague requests:

### 1. Proportional charging under load
When the system has an output load AND surplus PV, distribute charging current to **both** batteries proportionally — not Ultra-only. The AC Pro is connected and available. Use it.

### 2. MPPT redirect at 100%
When the Ultra's battery reaches 100% and the AC Pro is below 100%, **do not throttle MPPT**. Instead, route surplus through the AC coupling to the AC Pro. The hardware path exists (the parallel cable). The firmware just doesn't use it in this scenario.

### 3. Expose individual SOCs prominently
The combined/averaged SOC actively hides the imbalance from users and automations. Either:
- Report the **minimum** of both batteries as the system SOC (conservative, safe)
- Or expose both individual SOCs as first-class metrics in the app and API

### 4. Battery priority setting
Let users configure whether the system should prioritize **filling both batteries evenly** vs **maximizing output availability**. Different use cases have different priorities.

## Call to Action

If you have a Stream Ultra + AC Pro (or Stream Ultra + Stream AC) and observe this behavior:

1. **Check your individual battery SOCs** — if you only look at the combined number, you won't see the problem
2. **Report it to EcoFlow support** — reference this behavior specifically: *"Ultra throttles MPPT at 100% instead of redirecting to AC Pro"*
3. **Post your data** in the [EcoFlow community forum](https://community.ecoflow.com/) — screenshots of SOC divergence and PV throttling help build the case

The more users report this with data, the more likely it gets prioritized in a firmware update.

## Takeaway

The Stream Ultra + AC Pro combo works. The extra capacity is genuinely useful for overnight self-consumption. But **don't expect them to behave as one unified battery under load.** They diverge — and at full charge, you'll lose solar production to unnecessary clipping while your expansion battery sits partially empty.

The automation workaround helps. But this should be fixed in firmware — the hardware is capable, the energy path exists, and the system is actively wasting solar energy that it could store.

---

*The full PV surplus automation with battery balancing logic is documented in [PV Surplus EV Charging — The Zero-Export Adventure](/posts/pv-surplus-ev-charging/).*

*If you found this useful, share it — especially in EcoFlow-related communities. Visibility drives fixes.*
