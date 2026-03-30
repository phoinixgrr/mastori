---
title: "EcoFlow Stream Ultra + AC Pro — The Parallel Battery Imbalance Nobody Warns You About"
date: 2026-03-30
draft: true
tags: ["ecoflow", "solar", "battery", "zero-export", "home-assistant", "ev-charging"]
summary: "When you connect a Stream Ultra and AC Pro in parallel, you'd expect them to charge together. They don't. Here's what actually happens, why it matters, and the automation workaround I built to deal with it."
---

## The Promise

EcoFlow sells the Stream Ultra + AC Pro combo as a seamless expansion: plug in a second battery, double your storage from 1.92kWh to 3.84kWh, and enjoy longer self-consumption. The marketing implies it works as one unified system.

It doesn't.

## The Setup

| Component | Role |
|-----------|------|
| **Stream Ultra** | Inverter + 1.92kWh battery + 4 MPPT solar inputs |
| **Stream AC Pro** | Additional 1.92kWh battery (no solar inputs, no inverter) |
| **Connection** | AC parallel cable between the two units |

The AC Pro has no MPPT inputs — it's just a battery. It can only charge via the AC connection from the Ultra. This means:

1. Ultra converts DC (solar) → AC
2. Sends AC to the house and to the AC Pro via the parallel cable
3. AC Pro converts AC → DC to charge its battery

This AC coupling adds 20-30% conversion losses. But that's the advertised trade-off. The real problem is worse.

## What Actually Happens

### Normal operation (no heavy loads)

When the house load is light and the EV isn't charging, both batteries charge roughly together. The Ultra shares surplus PV with the AC Pro via the parallel cable. Life is good.

### Under load (EV charging)

The moment a significant load appears on the output — like an EV charger drawing 1.4kW on phase C — the Ultra stops sharing with the AC Pro. All PV goes to: (1) feeding the load, (2) charging the Ultra's own battery. The AC Pro gets nothing.

The SOC gap starts growing immediately. The Ultra climbs steadily while the AC Pro flatlines.

Here's a real graph from March 30, 2026. Both batteries started the morning at ~15% and charged together until around 11:00. That's when EV charging started on PV surplus. The Ultra (green) rockets to 91% while the AC Pro (blue) stalls at 50%. A 41% gap — that's 0.8kWh of usable capacity sitting empty while the system clips solar energy.

![Top: Battery SOC divergence — Ultra (blue) pulls away from AC Pro (orange) when EV charging starts. Bottom: PV power from all 4 strings drops to zero when Ultra hits max, despite AC Pro still needing charge.](battery-imbalance-graph.png)

### The cliff: Ultra hits 100%

This is where it gets truly wasteful. When the Ultra's battery reaches 100%, instead of redirecting surplus PV to the AC Pro (which might be sitting at 50%), the inverter **throttles MPPT completely**. PV production drops to 0W. The sun is shining, the panels are capable, but the system is clipping.

Meanwhile the AC Pro is half empty, perfectly capable of absorbing that energy — but it never arrives.

The Home Assistant debug output at that moment:

```
🔋 BATTERY
  combined: 78%  Ultra: 99.3%  AC Pro: 56.2%  gap: 43%
  power: -316W  charge: 0W  discharge: 316W

☀️ PV
  PV: 0.0kW ← panels throttled despite sunshine
```

Combined SOC shows 78% — a number that doesn't represent reality. One battery is full, the other is half empty, and PV is at zero.

## Why This Matters

If you're using the combined SOC for automation decisions — like my [PV surplus EV charging controller](/posts/pv-surplus-ev-charging/) — you're making choices based on a misleading number. The automation might think "78% SOC, plenty of room" when actually the Ultra is about to hit 100% and throttle everything.

For a zero-export system where every watt must be consumed or stored locally, this is a significant efficiency loss. Energy that could be stored in the AC Pro or sent to the EV is simply thrown away.

## The Chicken-and-Egg Problem

My first instinct was to build an automation workaround: stop the EV charging periodically to let the AC Pro catch up. And it works — partially.

When the EV stops, the Ultra has no heavy output load. If the Ultra isn't full yet, PV flows again and some surplus reaches the AC Pro via the parallel cable. The gap starts narrowing.

But here's the catch: **if the Ultra is already at 100%, stopping the EV doesn't help.** PV is throttled because the Ultra is full, and no energy flows to the AC Pro either. You need to *drain* the Ultra first to un-throttle MPPT, but the only way to drain it is to turn the EV back on — which was the thing causing the imbalance in the first place.

| Ultra SOC | EV charging | PV flows? | AC Pro charges? |
|-----------|-------------|-----------|-----------------|
| < 95% | Yes | Yes | No (Ultra hogs it) |
| < 95% | No | Yes | Yes (surplus shared) |
| 100% | No | No (throttled) | No |
| 100% | Yes | Resumes | No (goes to load + Ultra) |

## The Automation Workaround

Since I can't fix EcoFlow's firmware, I built a workaround into the PV surplus automation. The key insight: **balance early, while there's still headroom.**

Two new variables track the individual battery SOCs:

```yaml
ultra_soc: "{{ states('sensor.stream_ultra_akis_power_battery_soc') | float(0) }}"
ac_pro_soc: "{{ states('sensor.stream_ac_pro_power_battery_soc') | float(0) }}"
battery_gap: "{{ (ultra_soc - ac_pro_soc) | abs }}"
```

The logic uses two thresholds with a bypass:

```yaml
# Don't start EV if gap > 10% (unless Ultra already >= 95%, then give up)
battery_balanced: "{{ battery_gap <= 10 or ultra_soc >= 95 }}"

# Stop EV if gap > 20% AND Ultra < 95% (still fixable)
battery_imbalanced_and_fixable: "{{ battery_gap > 20 and ultra_soc < 95 }}"
```

### How it plays out

1. **Morning:** Both batteries charge together from overnight lows. Gap is small.
2. **PV surplus detected:** EV charging starts. Ultra charges faster, gap grows.
3. **Gap hits 20% while Ultra is at e.g. 60%:** Automation stops EV. PV is still flowing (Ultra isn't full). AC Pro catches up.
4. **Gap drops to 10%:** EV resumes.
5. **Cycle repeats** until both batteries are high.
6. **Ultra hits 95%:** Automation gives up on balancing — charges EV regardless. No point waiting, PV will throttle soon anyway.

The 10%/20% hysteresis prevents flapping: stop at 20%, don't restart until 10%. The 95% bypass prevents the automation from blocking the EV when balancing is physically impossible.

### The trade-off

Each balance pause costs 20-30 minutes of EV charging time (the AC Pro charges slowly over the AC cable). On a sunny day you might get 2-3 charge/pause/charge cycles. You lose some EV charging time but gain usable battery capacity that would otherwise be wasted to clipping.

## What EcoFlow Should Fix

This is fundamentally a firmware issue. In a parallel configuration:

1. **Both batteries should charge proportionally**, regardless of output load. The Ultra shouldn't hog all PV when the EV is drawing power.
2. **When one battery hits 100%, surplus should redirect to the other.** Throttling MPPT while a connected battery is at 50% is wasteful.
3. **The combined SOC reported to integrations should reflect the imbalance** — or better, expose individual battery SOCs prominently.

I've reported this to EcoFlow. If you have the same setup and see this behavior, I'd encourage you to report it too. The more data points they have, the more likely a firmware fix becomes.

## Takeaway

If you're considering the Stream Ultra + AC Pro combo: it works, and the extra capacity is genuinely useful for overnight self-consumption. But don't expect them to behave as one unified battery. Under load, they diverge — and at full charge, you'll lose solar production to unnecessary clipping.

The automation workaround helps, but it's a band-aid over a firmware gap. The system should handle this natively.

---

*The full PV surplus automation with battery balancing logic is documented in [PV Surplus EV Charging — The Zero-Export Adventure](/posts/pv-surplus-ev-charging/).*
