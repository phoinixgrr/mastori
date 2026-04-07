---
title: "I Paid €620 for an EcoFlow Battery That Never Charges"
date: 2026-04-07
draft: true
tags: ["ecoflow", "solar", "battery", "stream-ultra", "stream-ac-pro", "hardware-limitation", "consumer-rights"]
summary: "EcoFlow says you can expand to 6 batteries. Here's what actually happens on a sunny day — with real data to prove it."
keywords: ["ecoflow stream ultra battery imbalance", "ecoflow expandable lie", "ecoflow ac pro not charging", "ecoflow 1200W bottleneck", "ecoflow stream ultra review"]
---

## The Promise

EcoFlow's website says:

> *"Expandable capacity from 3.84 to 23kWh"*

> *"Up to 6 devices per system"*

> *"Surplus solar energy automatically transfers between batteries"*

So I bought a Stream AC Pro (€620) to expand my Stream Ultra system. Two batteries, 4 solar panels, one goal: store more sun.

## The Reality

April 7, 2026. Perfect sunny day in Greece. 12 kWh of solar produced. Here's what happened:

| | Stream Ultra (main) | Stream AC Pro (expansion) |
|---|---|---|
| **Morning** | 10% | 10% |
| **Peak** | **99.8%** | **19.3%** |
| **Difference** | Fully charged | Barely moved |

One battery charged to full. The other — the one I paid €620 for — went from 10% to 19% all day.

**Same sun. Same system. Same house.**

## Why This Happens

There's a 1200W inverter bottleneck inside the Stream Ultra. Solar energy can only reach the AC Pro through this inverter. But the inverter is busy powering your home.

It's like trying to fill two swimming pools through a garden hose that's already watering your lawn. The second pool never fills.

Here's what the data shows:

- **Solar panels produced 2000W** at peak
- **Inverter capped at 1200W** — all of it went to home load
- **Expansion battery got 0W** for most of the day
- **When the main battery hit 100%** — solar panels shut down entirely

The expansion battery was sitting there at 18%, empty and ready. But the 1200W bottleneck wouldn't let a single watt through.

## See It Yourself

I monitor every watt with Home Assistant and Prometheus. Every data point below is real, recorded at 1-minute intervals.

**[→ Interactive charts with full data from April 7, 2026](/ecoflow-data/april-2026.html)**

## What About 6 Batteries?

EcoFlow markets "expandable to 6 batteries." Let's do the math:

| Setup | Total Storage | Actually Usable From Solar | Dead Weight |
|---|---|---|---|
| 1 Ultra + 1 AC Pro | 3.84 kWh | 1.92 kWh | **50%** |
| 1 Ultra + 2 AC Pro | 5.76 kWh | 1.92 kWh | **67%** |
| 1 Ultra + 5 AC Pro | 11.52 kWh | 1.92 kWh | **83%** |

With 6 batteries, 5 sit empty while the sun shines. The 1200W inverter is the only path, and it's already taken.

## EcoFlow Knows

I reported this to EcoFlow EU Support. Their R&D team responded:

> *"The inverter limit of the Stream Ultra itself is only 1200W. The transfer of PV power between different devices must go through the inverter for conversion. The remaining solar energy can only be used to charge the Stream Ultra directly."*

Their suggested solution? **"Remove or reduce the load."**

That's like telling a car owner to stop driving so the engine lasts longer. The whole point of a solar battery system is to power your home AND store surplus.

## What I'm Asking For

I've requested EcoFlow exchange my Stream Ultra for a **Stream Ultra X** — their newer model with double battery capacity (3.84 kWh in a single unit), eliminating the inter-device bottleneck entirely. A minimal concession for a product that doesn't work as advertised.

Under [EU Directive 2019/771](https://eur-lex.europa.eu/eli/dir/2019/771/oj/eng), products must conform to the seller's public advertising. "Expandable" means expandable. "Surplus automatically transfers" means it transfers. If it doesn't — that's non-conformity, and consumers have rights.

## If You Own This System

1. **Check your data.** If you use Home Assistant, compare the SoC of both batteries during a sunny day with normal household load. The gap tells the story.
2. **Report to EcoFlow.** Reference the 1200W inverter bottleneck. They've already confirmed it internally.
3. **Know your rights.** EU consumers have a 2-year legal guarantee. Products must work as advertised.
4. **Share this.** The more visibility, the more pressure for a fix — firmware or hardware.

---

*For the full technical deep-dive (architecture diagrams, BMS analysis, firmware workaround proposals): [EcoFlow Stream Ultra + AC Pro — The Parallel Battery Imbalance Nobody Warns You About](/posts/ecoflow-parallel-battery-imbalance/)*

*I will update this post as my case with EcoFlow progresses.*
