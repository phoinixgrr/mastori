---
title: "Cutting Two Clouds Out of My Solar Inverter's Zero-Export Loop"
date: 2026-08-27
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
tags: ["ecoflow", "solar", "zero-export", "home-assistant", "ble", "modbus", "shelly", "stream-ultra", "protobuf"]
summary: "My meter and my inverter sit three metres apart and exchanged one number via two data centres. Now the meter is read over Modbus and written straight into the inverter over Bluetooth, twice a second, with a BIAS (deliberate import margin) and a dead-man switch running on the meter itself. Export went from 41 Wh a day to 4."
keywords: [
  "ecoflow stream ultra zero export",
  "ecoflow zero feed in latency",
  "ecoflow cloud meter",
  "cfg_cloud_metter",
  "ecoflow CloudMeter protobuf",
  "zero export bias import margin",
  "shelly pro 3em modbus tcp registers",
  "shelly pro 3em 1 hz update rate",
  "shelly pro 3em modbus register 1064",
  "shelly script cloud dead man switch",
  "zero export regulation greece",
  "home assistant ecoflow ble",
  "ecoflow stream ultra home assistant"
]
---

I have no export agreement. Every watt the panels make has to be used or stored on my side of the
meter, and the number that matters is zero, not small. (Legal background:
[Balcony Solar in Greece](/posts/balcony-solar-greece-legal/).)

EcoFlow sells zero-feed-in regulation and it works, in the sense that the number is small. My
meter and my inverter are three metres apart. Until last week they exchanged one number via two
data centres.

## How zero feed-in works

A meter on the incoming cable reads what the house is drawing. That number goes to the inverter.
The inverter pushes out power to drive it to zero: house wants 400 W, inverter gives 400 W, meter
reads nothing, nothing crosses the boundary.

Nobody tells the inverter how much the house wants. It sees one number and tries to cancel it. The
meter is the grid's detective, and the inverter's whole job is to leave it with nothing to report.

{{< mermaid >}}
sequenceDiagram
    actor H as 🏠 House
    participant M as 🔎 The Meter
    participant I as ⚡ The Inverter

    Note over H,I: house 0 W · injecting 0 W · grid 0 W
    H->>M: kettle on, 2000 W
    M->>I: the house is importing 2000 W from the grid
    I->>M: roger, injecting 2000 W so that import stops. target is zero.
    Note over H,I: house 2000 W · injecting 2000 W · grid 0 W
    M->>I: import is 0 W now, nothing is crossing me
    H->>M: kettle off
    Note over H,I: house 0 W · injecting 2000 W · grid 2000 W OUT
    M->>I: the house is taking nothing, so all 2000 W is going back to the grid
    I->>M: roger, stopping the injection
    Note over H,I: house 0 W · injecting 0 W · grid 0 W
    M->>I: import is 0 W again, but you exported for 2.5 seconds
    M->>I: that is how old my report was when it reached you
{{< /mermaid >}}

The third note is where the arithmetic lives. The kettle is off, the house is back to idle, and
2000 W is still coming out of the inverter. Current does not queue. Whatever is injected has to be
consumed by something, and with nothing in the house consuming it there is exactly one path left:
back through the meter and into the grid.

{{< mermaid >}}
flowchart LR
    I["inverter injects&lt;br/&gt;2000 W"] --> B{"the busbar"}
    B -->|"0 W consumed"| H["house load,&lt;br/&gt;idle"]
    B -->|"2000 W, the only other way out"| G["the grid"]

    style G fill:#7f1d1d,stroke:#ef4444,color:#fff
    style H fill:#14532d,stroke:#22c55e,color:#fff
{{< /mermaid >}}

That is the export, and stopping it is the entire feature. Which makes the feature exactly as good
as the meter's number is.

## The hotel shower

You know this loop. You turn the tap, nothing happens, you turn it further, and three seconds
later it scalds you. Your hand is fine. You are regulating a shower that stopped existing three
seconds ago, and chasing it harder only makes the swings bigger.

An inverter cancelling a stale meter reading is that hand. The scalding is export.

## Two data centres, three metres apart

The inverter cannot ask my meter anything, so the reading takes this route:

{{< mermaid >}}
flowchart LR
    subgraph panel["one electrical panel, 3 metres wide"]
        S["Shelly Pro 3EM"]
        U["Stream Ultra"]
    end
    S -->|"HTTPS"| SC["Shelly Cloud"]
    SC -->|"server to server"| EC["EcoFlow Cloud"]
    EC -->|"MQTT"| U

    style SC fill:#854d0e,stroke:#eab308,color:#fff
    style EC fill:#854d0e,stroke:#eab308,color:#fff
{{< /mermaid >}}

The inverter's copy is rewritten about every 2.5 seconds. Fine while nothing changes. A compressor
start or an oven element moves the grid by hundreds of watts in one mains cycle, and if the step
was a load switching *off*, the difference leaves through the meter.

The export is not a leak. It is dead time, and it bills once per load event.

There is no setting for this. The firmware has no field for a meter address anywhere.

| stage | time |
|---|---|
| Shelly internal aggregation | ~1000 ms |
| Shelly HTTP RPC over LAN | ~100 ms |
| Modbus TCP over LAN | ~25 ms |
| BLE write round trip | ~130 ms |
| the cloud path | 2000 to 3500 ms |

Reading faster is not the win. Not leaving the building is.

## The field is writable

The Ultra speaks protobuf inside an encrypted BLE session, and none of that was my work.
[ef-ble-reverse](https://github.com/rabits/ef-ble-reverse) is the reverse engineering of EcoFlow's
BLE protocol V2, and [ha-ef-ble](https://github.com/rabits/ha-ef-ble) is the Home Assistant
integration built on top of it, both by rabits under Apache 2.0. That first repository is the hard
part of this whole story: without somebody else having worked out the handshake, the session key
and the framing, none of what follows would be reachable.

The meter reading lives in a `CloudMeter` message, and anything that can open a session can write
it.

{{< mermaid >}}
classDiagram
    class ConfigWrite {
        +CloudMeter cfg_cloud_metter = 383
        +float cfg_inv_target_pwr = 220
    }
    class DisplayPropertyUpload {
        +CloudMeter cloud_metter = 785
        +int32 grid_power
    }
    class CloudMeter {
        +bool has_meter = 1
        +METER_MODEL model = 2
        +string sn = 3
        +int32 phase_a_power = 4
        +int32 phase_b_power = 5
        +int32 phase_c_power = 6
    }
    class METER_MODEL {
        &lt;&lt;enumeration&gt;&gt;
        NONE = 0
        CT_EF_01 = 1
        CT_SHELLY_3EM = 2
        CT_SHELLY_PRO_3EM = 3
        IR_TIBBER_PULSE = 4
        IR_POWERFOX_PA201902 = 5
        CT_EF_PRO_3EM = 6
    }
    ConfigWrite --> CloudMeter : field 383, the way in
    DisplayPropertyUpload --> CloudMeter : field 785, the way back
    CloudMeter --> METER_MODEL
{{< /mermaid >}}

The same message goes both ways, which is what makes everything after this verifiable: you can
read back what the device took, and see when somebody else wrote to it.

At an injected +180 W the whole thing is 28 bytes.

{{< mermaid >}}
---
config:
  packet:
    bitsPerRow: 14
    bitWidth: 44
    showBits: true
---
packet-beta
0-1: "fa 17 tag, field 383"
2: "19 len"
3-4: "08 01 has_meter"
5-6: "10 03 model"
7-8: "1a 0c sn tag"
9-13: "serial, bytes 1 to 5"
14-20: "serial, bytes 6 to 12"
21-22: "20 00 phase A"
23-24: "28 00 phase B"
25-27: "30 b4 01 phase C"
{{< /mermaid >}}

```
fa 17                    field 383, wire type 2 (embedded message)
19                       length = 25 bytes
   08 01                 has_meter = true
   10 03                 model = 3 (CT_SHELLY_PRO_3EM)
   1a 0c 41 42 ... 36    sn, length 12
   20 00                 phase_a_power = 0
   28 00                 phase_b_power = 0
   30 b4 01              phase_c_power = 180
```

Positive is importing, negative is exporting, confirmed by experiment. `phase_c_power` is `int32`,
not `sint32`, so negatives sign-extend: it takes eleven bytes to say minus one hundred and eighty
and three to say plus one hundred and eighty.

{{< mermaid >}}
flowchart TB
    A["phase_c_power = 180&lt;br/&gt;one int32"] --> B["CloudMeter&lt;br/&gt;25 bytes, all six fields set"]
    B --> C["ConfigWrite.cfg_cloud_metter = 383&lt;br/&gt;28 bytes"]
    C --> D["EcoFlow Packet v19&lt;br/&gt;src 0x20, dst 0x02, cmd_set 0xFE, cmd_id 0x11"]
    D --> E["AES, session key from the handshake"]
    E --> F["BLE GATT write&lt;br/&gt;~130 ms round trip"]

    style A fill:#1e3a8a,stroke:#3b82f6,color:#fff
    style F fill:#14532d,stroke:#22c55e,color:#fff
{{< /mermaid >}}

## What replaced it

Four Modbus reads a second, one BLE write every 500 ms. Nothing leaves the building.

{{< mermaid >}}
flowchart LR
    subgraph panel["one electrical panel"]
        direction LR
        S1["Shelly Pro 3EM&lt;br/&gt;solar"]
        S2["Shelly Pro 3EM&lt;br/&gt;mains"]
        U["Stream Ultra x2"]
    end
    S1 -->|"Modbus TCP, 4 Hz"| R["ef_inject&lt;br/&gt;Home Assistant"]
    S2 -->|"Modbus TCP, 4 Hz"| R
    R -->|"BLE, 2 Hz"| U
    R -.->|"heartbeat, every 10 s"| D["dead-man script,&lt;br/&gt;runs on S1"]
    D -.->|"silence restores&lt;br/&gt;the vendor path"| S1

    style R fill:#1e3a8a,stroke:#3b82f6,color:#fff
    style D fill:#14532d,stroke:#22c55e,color:#fff
{{< /mermaid >}}

Both clouds are still writing. They lose the race.

{{< mermaid >}}
flowchart TD
    A["read both meters"] --> B{"fresh and plausible?"}
    B -->|no| Z["no write this cycle"]
    B -->|yes| C["take the fresher sample"]
    C --> D{"plant quiescent?"}
    D -->|yes| E{"meters agree?"}
    E -->|no| Z
    E -->|yes| F
    D -->|"no, ramping"| F["apply BIAS"]
    F --> G["rise-only rate limit"]
    G --> H{"last frame was foreign?"}
    H -->|yes| I["hold low, 2 cycles"]
    H -->|no| J["target value"]
    I --> K["set all six subfields"]
    J --> K
    K --> L["re-resolve the device"]
    L --> M["BLE write, bump the counter"]

    style Z fill:#854d0e,stroke:#eab308,color:#fff
    style M fill:#14532d,stroke:#22c55e,color:#fff
{{< /mermaid >}}

## Reading the meter locally

Worth writing down if you ever do this:

- **Function code 4**, read *input* registers. Function code 3 is what every example uses and it
  returns exception 2 here.
- **Phase blocks 20 apart**: A at 1020, B at 1040, C at 1060. Voltage +0, current +2, active
  power +4. So phase C active power is **register 1064**.
- **float32, low word first.** Wide spans return nothing, so read one block at a time.

Then the part I did not expect. A second Pro 3EM on the same conductor, added as a cross-check,
turned out to be the largest latency win in the project. Over 730 paired samples each meter
updates at exactly 1.00 Hz, their update instants are **0.412 s apart**, and they agree on the
regulated phase to 2.3 W of 780 W.

```
time, s   0.0   0.4   1.0   1.4   2.0   2.4   3.0
meter A   |-----------|-----------|-----------|      1.00 Hz
meter B         |-----------|-----------|-----------  1.00 Hz, +0.412 s
use       A     B     A     B     A     B     A      worst-case age ~0.5 s
```

Two 1 Hz sources with a fixed sub-second offset are not two copies of one reading. Take whichever
is fresher and worst-case age halves. Their per-sample spread, p05 -21 W and p95 +29 W, *is* that
offset showing up during load changes. What reads as noise is the thing being exploited. It is
also free redundancy: if one meter stops answering, regulation carries on with the other.

## BIAS, a deliberate import margin

**BIAS** is a negative offset added to the reading before injection. The inverter drives what it
sees to zero, so it parks the house slightly on the import side. That standing margin, not loop
speed, is what holds export at zero.

{{< mermaid >}}
flowchart LR
    T["real grid&lt;br/&gt;+180 W"] --> A(("+"))
    B["BIAS&lt;br/&gt;-68 W, faded"] --> A
    A --> I["injected&lt;br/&gt;+112 W"]
    I --> R["inverter drives&lt;br/&gt;injected to 0"]
    R --> S["real grid settles&lt;br/&gt;at +60 W import"]

    style B fill:#1e3a8a,stroke:#3b82f6,color:#fff
    style S fill:#14532d,stroke:#22c55e,color:#fff
{{< /mermaid >}}

The sign is a safety property. A *positive* BIAS tells the inverter it is importing when it is
not, which commands a ramp up and manufactures the export the whole thing exists to prevent. So
the value is validated on every read, startup and runtime alike, and a bad one never takes effect.

{{< mermaid >}}
flowchart TD
    F["/config/ef_inject_bias&lt;br/&gt;re-read every 2 s"] --> P{"parses as a number?"}
    P -->|no| K["keep the last good value"]
    P -->|yes| N{"NaN?"}
    N -->|yes| K
    N -->|no| G{"positive?"}
    G -->|"yes, commands a ramp up"| K
    G -->|no| M{"within the hard cap?"}
    M -->|no| K
    M -->|yes| OK["accept as live BIAS"]

    style OK fill:#14532d,stroke:#22c55e,color:#fff
    style K fill:#854d0e,stroke:#eab308,color:#fff
{{< /mermaid >}}

BIAS fades on real grid, not on time: full strength at 0 W, nothing at 500 W of import, where
there is no export to prevent and a margin only buys grid.

{{< mermaid >}}
xychart-beta
    title "BIAS applied, W, against real grid, W"
    x-axis "real grid, W of import" [0, 125, 250, 375, 500, 625]
    y-axis "BIAS applied, W" 0 --> 80
    line [68, 51, 34, 17, 0, 0]
    line [68, 68, 68, 68, 0, 0]
{{< /mermaid >}}

The smooth line is production. The stepped line is the version I did not build: a hard threshold
moves the injected value by the whole of BIAS in one sample, and the regulator hunts across that
step instead of settling.

Because it fades, the steady state is a fixed point rather than the BIAS value:

```
w = -B * F / (F - B)          B = BIAS (negative), F = fade width (500 W)
```

So -150 W gives about +115 W of real import margin, and -68 W about +60 W.

It was wrong twice. It originally armed on "battery is discharging", but during a PV surplus the
battery charges, so the margin was suppressed for exactly the window it exists for: one morning,
232 samples with BIAS applied against 2709 idle, battery pinned near +80 W throughout. Turning the
number up would have changed nothing, because the number was not being used. And it was too big.
The margin covers export during the loop's response time, so it is priced in latency; response
time fell from 481 ms to 142 ms and the default came down from -150 W to -68 W.

## Everything fails toward import

Overshoot on a rise lands on the grid as export. Undershoot on a fall lands as import. Only one of
those is a compliance event, so every guard is built to misfire toward buying grid.

| mechanism | rule |
|---|---|
| rate limiter | rises rationed, falls not |
| stale or failed read | no write this cycle, never let the last value ride |
| plausibility clamp | absurd readings rejected |
| read timeout | a slow meter cannot stall the loop |
| all six subfields | never write a partial `CloudMeter` |
| serial check | wrong serial is a hard stop, missing one is a wait |
| nine flag files | presence disables, so failing to clean up leaves protection on |

Two of those need a word. `CloudMeter` is not a scalar, and a partial write is the worst outcome
in the whole system:

{{< mermaid >}}
flowchart LR
    A["write phase_c only"] --> B["has_meter defaults false"]
    B --> C["meter unbound from the plant"]
    C --> D["zero-feed disabled&lt;br/&gt;unbounded export"]
    E["read all six, replace one,&lt;br/&gt;write all six"] --> F["binding preserved"]

    style D fill:#7f1d1d,stroke:#ef4444,color:#fff
    style F fill:#14532d,stroke:#22c55e,color:#fff
{{< /mermaid >}}

And the loop observes for 15 seconds before its first write, because BLE flaps and "no telemetry
yet" is not "wrong device".

## Racing the cloud

EcoFlow's server still writes the field over MQTT and that link cannot be intercepted. What can be
shortened is how long its value survives. An echo classifier matches every inbound frame against
what was last sent, within 2 W, so a foreign value is recognisable on sight.

{{< mermaid >}}
sequenceDiagram
    participant M as Shelly (LAN)
    participant R as regulator
    participant U as Stream Ultra
    participant C as EcoFlow cloud

    R->>M: Modbus read, 4 Hz
    M-->>R: phase C = +180 W
    R->>U: ConfigWrite CloudMeter, phase_c = 112
    U-->>R: DisplayPropertyUpload = 112
    Note over R: matches within 2 W, that was us
    C->>U: cloud writes its own stale value
    U-->>R: DisplayPropertyUpload = 940
    Note over R: no match, that was not us
    R->>U: re-assert at once, deliberately low
    R->>U: hold low 2 cycles, then ramp back
{{< /mermaid >}}

Answering low for two cycles cancels the ramp the server just commanded. The first version
released that correction in one write and made export measurably *worse*, because the release is
itself a rising step. Worst case the mechanism costs about 90 Wh a day of import.

The loop also rewrites the value every 500 ms whether it moved or not, which buys a counter that
advances at a steady 2 Hz whenever regulation is happening. That becomes load bearing below.

## Three things that were confidently wrong

**The device handle.** The BLE library replaces its device object whenever its config entry
reloads, and a disconnect schedules a reload. A reference captured at startup goes permanently
dead while the live object is healthy: **74,928 consecutive write failures**. Re-resolved every
cycle now.

**The divergence guard, twice.** Two meters agreeing to 0.29% make a good sanity check, so if they
diverge, stand down. It judged on a mean of 40 samples, which is right, but 40 samples at 250 ms
is 10 seconds, and a grid ramping at 270 W/s seen through a 0.412 s offset produces a 112 W
disagreement that is not disagreement at all. So I gated it on the plant being quiescent, and
tested one of the two meters for flatness. A resistive load switching instantly is flat on the
meter you are watching and not on the other one. Same class of mistake, same week: a guard
comparing two sensors has to prove the world was holding still, from *both* sensors.

**Proof that it controls anything.** The device echoes your write back, so "the number changed"
proves nothing. Eight alternating trials, half injecting a false reading, half the truth, with
identical Bluetooth traffic, judged only from the independent meter and battery power. False
readings moved the inverter by **+903 W** against **+29 W** for the true ones, no overlap. The
false offset is negative on purpose: the other sign would command a ramp up and could cause real
export during a test.

## Cutting the cloud removed the safety net

The clean way to stop EcoFlow writing the field is not to block EcoFlow, it is to stop feeding it:
disable Shelly Cloud on the bound meter. The phone app still works, firmware updates still work,
local Modbus is untouched.

It also deleted the fallback. The original design said, in a comment I wrote myself, *if the local
read fails we stop injecting and let the cloud take over*, which was true while the cloud had a
reading. After the change, if my regulator stopped on a sunny afternoon the inverters would hold
their last setpoint and export without bound.

An automation that notices and re-enables the cloud does not work either, because the most common
way injection stops is Home Assistant restarting, and during a restart no automation runs.

### So the watchdog lives on the meter

Shelly Gen2 devices run scripts inside the firmware event loop. Sixty lines does it: Home
Assistant pokes an HTTP endpoint every 10 seconds, and 20 seconds of silence re-enables Shelly
Cloud, restoring EcoFlow's own regulation.

{{< mermaid >}}
stateDiagram-v2
    [*] --> Seeded: script start
    Seeded --> Healthy: heartbeat within 20 s
    Seeded --> CloudOn: no heartbeat for 20 s
    Healthy --> CloudOn: heartbeat lost &gt; 20 s
    Healthy --> LocalOwns: healthy for 120 s
    LocalOwns --> CloudOn: heartbeat lost &gt; 20 s
    CloudOn --> Healthy: heartbeat returns
    note left of CloudOn
        Shelly Cloud ENABLED
        EcoFlow regulates
        degraded, but bounded
    end note
    note right of LocalOwns
        Shelly Cloud disabled
        local regulator owns the field
    end note
{{< /mermaid >}}

- **An HTTP endpoint, not a stored key.** Shelly's KVS lives in flash. At 10 seconds that is ~3M
  flash writes a year for a value whose whole lifetime is one comparison.
- **It does not poll Home Assistant.** That would mean a long-lived API token on a device whose
  own auth is disabled. Inverting the direction removes the credential.
- **Every uncertain state resolves to cloud enabled.** Boot, unreadable config, a heartbeat never
  seen: all mean "let the vendor regulate".
- **20 seconds is measured, not chosen.** Beat jitter over 14 samples ran 9.80 to 10.20 s and the
  device's uptime counter is integer seconds, so 10 s tolerates zero late beats.

### The heartbeat measures work, not health

Consider the Modbus link dying. State stays `running`, BLE frames stay fresh, the bound meter is
still bound, the write-failure counter never moves. Every health indicator says fine and nothing
is being regulated.

Only the write counter catches that, which is why the loop re-asserts even when nothing changed:
it makes a frozen counter mean exactly one thing, covering BLE loss, a dead loop, a dead meter
link, a kill switch and rejected writes.

{{< mermaid >}}
flowchart LR
    W["BLE write counter&lt;br/&gt;+2 per second"] --> D["delta over 10 s&lt;br/&gt;expect 20"]
    D -->|"18 to 21"| H["send heartbeat"]
    D -->|"below 10"| X["stay silent"]
    H --> M["cloud stays off"]
    X --> F["20 s of silence&lt;br/&gt;cloud comes back"]

    style F fill:#854d0e,stroke:#eab308,color:#fff
    style M fill:#14532d,stroke:#22c55e,color:#fff
{{< /mermaid >}}

A last-resort automation physically cuts the plant's supply on sustained export, so the failsafe
has to beat it, or every ordinary outage ends with the plant off waiting for a human.

{{< mermaid >}}
timeline
    title From heartbeat loss to something regulating again
    0 s : heartbeat stops
    20 s : dead-man decides the regulator is gone
    25 s : next 5 s tick fires, Cloud.SetConfig
    29 s : the change reaches Shelly Cloud
    33 s : EcoFlow resumes writing the meter field
    60 s : hard stop would have cut the supply
{{< /mermaid >}}

Both cloud figures are measured: 4 s to reach Shelly Cloud, 8 more before EcoFlow writes the
field. Twenty-seven seconds of margin, and past about a 45 s timeout the order inverts. Tested by
stopping the heartbeat with the regulator left healthy, so the plant stayed regulated throughout:
asserted at 32 s, stood down at 133 s, worst export 0 W. That run used a 30 s timeout, before it
came down to 20.

## Results

The authoritative number is the meter's own returned-energy counter for the regulated phase, out
of long-term statistics rather than off a graph.

| period | exported |
|---|---|
| 12 days before, daily mean | **41.0 Wh/day** |
| day 1 after | 3.7 Wh |
| day 2 after | 4.3 Wh |
| day 3 after, to 16:22 | 1.8 Wh |

About 90% down. On the trend of a full year of prior data, roughly 20 kWh/yr becomes 2 kWh/yr.

| | before | after |
|---|---|---|
| age of the data the inverter steers on | ~2.5 s | **~0.65 s** |
| updates reaching the inverter | ~0.4/s | **~2/s** |
| age of the injected reading | 481 ms | **~142 ms** |
| who owns the setpoint | the cloud | me |

{{< mermaid >}}
xychart-beta
    title "Age of the reading the inverter steers on, ms"
    x-axis ["stock, two clouds", "local, HTTP RPC", "local, Modbus", "Modbus + 2 meters"]
    y-axis "milliseconds" 0 --> 2600
    bar [2500, 1240, 1155, 655]
{{< /mermaid >}}

Bar two is the whole point: leaving the building costs more than everything else combined. Bar
three is the change everyone reaches for, 85 ms of transport. Bar four is the second meter, 500 ms,
for an afternoon and no new hardware. Of the 655 ms that remain, about 500 is the meter's own 1 Hz
aggregation, already halved by the interleave.

Accuracy did not improve. Alternating blocks against the stock cloud version, scored from the
independent meter: 27.5 W average error mine, 25.6 W stock. The stock loop already held about 30 W
on 2.5 second old data. What this bought is control, margin, and a fallback I understand.

The shower still has dead time. It is a third of a second now instead of two and a half, and the
plumbing no longer goes through two data centres.

{{< alert "triangle-exclamation" >}}
**If you are considering this.** It writes a live battery inverter's control setpoint, on my own
hardware, down a deliberately narrow path: margin only in the safe direction, size capped in code,
no write on a stale reading or a silent link, and a fallback that engages by itself. Do not probe
unknown commands to see what happens. And if you are somewhere export is regulated, the correct
configuration is the one your grid operator agreed to, not the one you can reach over Bluetooth.
{{< /alert >}}

More on this system: [the parallel battery imbalance](/posts/ecoflow-parallel-battery-imbalance/)
and [the 19% charge day](/posts/ecoflow-expandable-battery-broken-promise/).
