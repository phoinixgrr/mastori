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

**Left:** Battery SOC. Ultra (green) pulls away sharply from AC Pro (blue) the moment EV charging begins. By 14:00, Ultra is at 95% while AC Pro is stuck at 75% — a 20% gap.

**Right:** PV power from all 4 strings. Note the production drops to zero after 14:00 when Ultra hits maximum, despite full sunshine. Those gaps are solar energy that was **produced by the panels but rejected by the system**.

{{< gallery >}}
  <img src="soc-divergence.png" class="grid-w50" alt="Battery SOC divergence — Ultra (green) at 95% while AC Pro (blue) stuck at 75%" />
  <img src="pv-throttling.png" class="grid-w50" alt="PV power from all 4 strings drops to zero when Ultra hits max — solar energy wasted" />
{{< /gallery >}}

And here's the combined view from the HA dashboard — both SOC and PV power on the same timeline:

![Combined view: SOC divergence on top, PV throttling on bottom](battery-imbalance-graph.png)

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

On a typical sunny day in Athens (March-September), 4× 520W panels produce **8-10 kWh**. The Ultra's 1.92kWh battery fills by late morning. Once it hits 100%, PV throttles to zero — even if there are 4-5 hours of strong sun left.

The real losses:

- **3-6 kWh per day** in clipped solar production. If the Ultra fills by noon and PV throttles for 3-4 hours at ~1.5kW average, that energy is gone. The AC Pro could absorb it but never receives it.
- **Over a 6-month sunny season** (180 days), that's **540-1080 kWh** of wasted production — enough to drive a Tesla **3,000-6,000 km**.
- **The AC Pro capacity is largely stranded.** On a typical day it reaches 50-70% while the Ultra hits 100%. That's 0.6-1.0 kWh of paid storage capacity sitting empty every day.
- **The AC Pro cost ~€400.** If half its capacity is regularly unreachable, the effective cost per usable kWh doubles — you're paying for 3.84kWh and reliably getting ~2.5kWh.

### Battery degradation: the hidden cost

The imbalance also hammers the Ultra's battery life. Because the Ultra does all the heavy lifting — deep discharge overnight, full charge during the day, repeated cycling under load — while the AC Pro barely cycles. This uneven wear pattern means:

- The Ultra accumulates **2-3× more charge cycles** than the AC Pro per year
- LFP batteries are rated for ~3000 cycles to 80% capacity. At 1-2 full cycles per day, the Ultra could degrade noticeably within **3-4 years** while the AC Pro is still essentially new
- When the Ultra's capacity degrades, the imbalance gets worse — less Ultra capacity means it fills even faster, PV throttles even earlier, and more energy is wasted

You're not just losing energy today. You're accelerating the wear on the more expensive unit (the one with the inverter and MPPT) while the cheaper expansion battery sits underutilized.

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

## Why There's No Software Workaround

I tried. I built a battery balancing cycle into my [PV surplus EV charging automation](/posts/pv-surplus-ev-charging/) — stop the EV when the SOC gap between Ultra and AC Pro exceeds 20%, let them equalize, resume. It failed for two reasons:

### Reason 1: They charge at the same rate when idle

When the EV stops, the Ultra doesn't redirect its surplus to the AC Pro. Instead, **both batteries charge at the same rate from PV**. The gap never closes. I watched Ultra go from 43% to 59% while AC Pro went from 24% to 42% — a 19% gap that stayed at 19% the entire time.

The AC Pro can only receive energy via the AC parallel cable. When there's no output load and PV is flowing, the system distributes charging current equally. The gap is permanent once established.

### Reason 2: Every path leads to the same outcome

| Ultra SOC | Output load | PV flows? | AC Pro charges? | Gap closes? |
|-----------|-------------|-----------|-----------------|-------------|
| < 95% | Yes (EV) | Yes | **No** — Ultra takes everything | Gap grows |
| < 95% | No | Yes | **Yes** — but at same rate as Ultra | Gap stays |
| 100% | No | **No** — MPPT throttled | **No** — nothing flows | Gap stays |
| 100% | Yes (EV) | Resumes | **No** — goes to load, not AC Pro | Gap stays |

There is no cell in this table where the gap shrinks. The only option that gets energy into the EV is the top-left — and that's the one that makes the gap worse.

### The practical conclusion

**Charge the EV as early and as long as possible.** Don't try to balance the batteries — it wastes EV charging time for zero benefit. The EV absorbs energy that would otherwise be clipped when the Ultra inevitably hits 100%. Accept the AC Pro imbalance as a firmware limitation and maximize the energy that goes into the car before the system throttles.

My automation now starts EV charging at 12% combined SOC on strong days and doesn't stop for battery imbalance. The priority is: **use every watt of PV before EcoFlow wastes it.**

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

The Stream Ultra + AC Pro combo works. The extra capacity is genuinely useful for overnight self-consumption. But **don't expect them to behave as one unified battery under load.** They diverge, the gap is permanent, and at full charge you'll lose solar production to unnecessary clipping while your expansion battery sits partially empty.

**There is no software workaround.** I tried battery balancing logic, early stopping, gap-based cycling — none of it works because the firmware charges both batteries at equal rates when idle, so the gap never closes. The only rational strategy is to charge the EV as aggressively as possible before the Ultra hits 100% and PV throttles.

This needs a firmware fix. The hardware is capable, the energy path exists, and the system is actively wasting solar energy that it could store.

---

*The full PV surplus automation is documented in [PV Surplus EV Charging — The Zero-Export Adventure](/posts/pv-surplus-ev-charging/).*

*If you found this useful, share it — especially in EcoFlow-related communities. Visibility drives fixes.*
