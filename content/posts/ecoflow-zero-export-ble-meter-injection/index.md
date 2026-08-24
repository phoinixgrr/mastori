---
title: "Cutting Two Clouds Out of My Solar Inverter's Zero-Export Loop"
date: 2026-08-24
# UNLISTED WHILE UNDER REVIEW. The page renders at its own URL so it can be read in
# situ, but it stays out of RegularPages, so it is absent from RSS (the Slack feed
# reads that), the /posts/ list, tag pages, the sitemap and the site search index.
# TO PUBLISH: delete this comment block, the build block, excludeFromSearch and
# robots, then rebuild.
build:
  list: never
  render: always
  publishResources: true
excludeFromSearch: true
robots: "noindex, nofollow"
tags: ["ecoflow", "solar", "zero-export", "home-assistant", "ble", "modbus", "shelly", "stream-ultra"]
summary: "My meter and my inverter sit three metres apart and were exchanging one number via two clouds. Now Home Assistant reads the meter locally and writes it straight into the inverter over Bluetooth, twice a second, with a deliberate safety margin."
keywords: [
  "ecoflow stream ultra zero export",
  "ecoflow zero feed in latency",
  "ecoflow cloud meter",
  "cfg_cloud_metter",
  "shelly pro 3em modbus tcp registers",
  "shelly pro 3em 1 hz update rate",
  "shelly pro 3em modbus register 1064",
  "zero export regulation greece",
  "home assistant ecoflow ble",
  "ecoflow stream ultra home assistant"
]
---

## The Problem

I have no grid-tie agreement, so pushing energy back into the grid is not allowed. Every watt my panels make must be used or stored on my side of the meter. (The legal background is in [Balcony Solar in Greece](/posts/balcony-solar-greece-legal/).)

My EcoFlow Stream Ultra does this by reading a Shelly energy meter and trimming its output to hold the grid reading at zero. Both devices sit in the same electrical panel, three metres apart, both on my LAN.

They do not talk to each other. The meter reading goes out to Shelly's cloud, across to EcoFlow's cloud, and back down to the inverter: **2 to 3.5 seconds** each way.

There is no setting to fix this. The inverter's firmware has no field anywhere for a meter's address, hostname or port, so it structurally cannot be pointed at a device on my network. `use_lan_meter` exists in its telemetry and is read-only.

Two smaller problems came with it. The inverter regulates *towards* zero, which means it hunts back and forth across zero and spends about half its time on the exporting side. And I had no control over where that resting point sits.

## What I Have Now

Home Assistant reads the meter locally and writes the reading straight into the inverter over Bluetooth, roughly twice a second, out-pacing the cloud.

{{< mermaid >}}
flowchart LR
    S["Shelly meter"] -->|"Modbus, 15ms"| HA["Home Assistant"]
    HA -->|"Bluetooth, ~130ms"| U["Stream Ultra"]
    S -.->|"cloud path, 2.5s<br/>still there, now loses the race"| C["Shelly + EcoFlow clouds"]
    C -.-> U

    style C fill:#854d0e,stroke:#eab308,color:#fff
{{< /mermaid >}}

The mechanism is the field the cloud itself uses to deliver the meter reading. It is writable by anything that can reach the device, and Home Assistant already keeps an authenticated Bluetooth session open.

Four things make it work:

**A faster read.** Shelly meters speak Modbus, an industrial protocol, alongside the usual web API. Same number, **15 milliseconds instead of 79**. (For anyone searching later: read *input* registers, phase C power is at register 1064, and the value arrives with its two halves swapped.)

**Two meters instead of one.** I have two meters watching the same conductor. They each publish once a second, and they publish **0.41 seconds apart**, so reading both and using whichever spoke most recently nearly halves the effective delay. It is also free redundancy: if one stops answering, regulation continues on the other. A guard watches for the two disagreeing and permanently disables the interleave if they do, judging the average rather than any single reading.

**A deliberate import margin.** The inverter drives what it *sees* to zero, so showing it a number 150W below reality makes reality settle 150W on the safe side. That works out to about **115W of steady import**, fading out as grid import rises so it costs nothing when the house is already drawing. This is the part that matters most to me: I would rather pay for margin than risk export.

**Refusing to write when it would be unsafe.** The write is skipped entirely on a stale meter reading or an unresponsive inverter, rather than letting the last value ride. The margin can only ever be applied in the safe direction, and its size is hard-capped in code.

Control was verified rather than assumed: eight paired trials, alternating a false reading against a true one with identical Bluetooth traffic, judged only from the independent meter and the battery. The false readings moved the inverter by **+903W** on average against +29W for the true ones, with no overlap between the two sets.

## What Got Better

| | Before | After |
|---|---|---|
| Age of the data the inverter steers on | ~2.5s | **~0.3s** |
| Updates reaching the inverter | ~0.4/s | **~2/s** |
| Who controls the setpoint | the cloud | me |
| Time on the safe side of zero | ~50% | **100%** |
| Resting position | around 0W | **115W importing** |

Three fixes contributed: the Modbus read, the two-meter interleave, and a pacing bug where the loop waited a fixed pause *after* each cycle instead of working out when the next one was due (configured for twice a second, actually running at 1.5). The age of the injected reading fell from **481 milliseconds to about 145**.

The safety margin also turned out to have never really run. It had been gated on "only while the battery is discharging", but during a sunny afternoon the battery *charges*, so the margin was disabled during exactly the conditions it existed for. It now fades continuously on the grid reading instead.

## What Did Not Get Better

**Accuracy is unchanged.** Alternating blocks of my version against the stock cloud version, scored from the independent meter: average error 27.5W mine, 25.6W stock. Within noise, and if anything a hair worse.

That is not a contradiction. The stock loop was already holding the line to about 30W on 2.5-second-old data, so there was almost no error left for speed to remove. The gain here is **control and margin**, not precision.

**The meter's own averaging is the floor.** It aggregates internally and publishes once per second. Of the ~1.1 seconds between reality and my write, about a full second belongs to the meter and cannot be reduced from my side. Everything above competes for the remaining 120 milliseconds, which is also why the WiFi-versus-Ethernet question I had been worrying about turned out to be worth under 2% of the total.

**The number that matters is not measured yet.** The honest measure is exported watt-hours per day. My baseline over the previous nine days averaged about 44 Wh. All of this went live this morning, so until I have a week of daily totals to compare against that, the export improvement is a well-instrumented hypothesis and not a result.

**It costs something.** A 115W cushion is roughly 0.9 kWh a day if the house sits there for eight hours. For a system whose hard rule is "do not export", that is a bargain. For anyone optimising a feed-in tariff, it is the wrong trade.

{{< alert "triangle-exclamation" >}}
**If you are considering this.** It writes to a live battery inverter's control setpoint, on my own hardware, down a deliberately narrow path: margin only in the safe direction, size capped, no write on a stale reading or a silent link. Do not probe unknown commands to see what happens. One blind probe on this hardware reset a safety power limit to zero. And if you are somewhere export is regulated, the correct configuration is the one your grid operator agreed to, not the one you can reach over Bluetooth.
{{< /alert >}}

More on this system: [the parallel battery imbalance](/posts/ecoflow-parallel-battery-imbalance/) and [the 19% charge day](/posts/ecoflow-expandable-battery-broken-promise/).
