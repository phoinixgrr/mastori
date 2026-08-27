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

I have no export agreement. Every watt the panels make has to be used or stored on my side
of the meter, and the number that matters is zero, not small. (Legal background:
[Balcony Solar in Greece](/posts/balcony-solar-greece-legal/).)

EcoFlow sells zero-feed-in regulation and it works, in the sense that the number is small.
My meter and my inverter are three metres apart in the same panel. Until last week they
exchanged one number via two data centres.

## The number takes the long way round

Regulation needs a grid reading. Mine comes from a Shelly Pro 3EM on the incoming phase.
The inverter cannot ask it anything. The reading goes up to Shelly's cloud, across to
EcoFlow's cloud, and back down over MQTT.

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

The inverter's copy of that number gets rewritten about every 2.5 seconds. It regulates
against a house that existed two and a half seconds ago.

That is fine while nothing changes. A compressor start, an EV charger stepping its current,
an oven element: any of those move the grid by several hundred watts inside one mains cycle.
While the new reading is in flight the inverter holds a setpoint chosen for the old house.
If the step was a load switching off, the difference leaves through the meter.

So the export is not a leak. It is latency, and it bills once per load event.

There is no setting for this. The firmware has no field for a meter address, host or port
anywhere. `use_lan_meter` appears in telemetry and is read-only. You cannot configure your
way out of it.

## Where the time actually goes

Measure before optimising, because the intuition is wrong.

| stage | time |
|---|---|
| Shelly internal aggregation | ~1000 ms |
| Shelly HTTP RPC read over LAN | ~100 ms |
| Modbus TCP read over LAN | ~25 ms |
| BLE write round trip | ~130 ms |
| the cloud path, for comparison | 2000 to 3500 ms |

The Pro 3EM aggregates internally at 1 Hz and that second is not yours. Swapping HTTP RPC
for Modbus TCP on the same device buys 75 ms of a 1200 ms budget. Real, and worth 8%, not
the 4x the two transport numbers suggest on their own.

Those components summed, for the four configurations I ran:

{{< mermaid >}}
xychart-beta
    title "Age of the reading the inverter steers on, ms"
    x-axis ["stock, two clouds", "local, HTTP RPC", "local, Modbus", "Modbus + 2 meters"]
    y-axis "milliseconds" 0 --> 2600
    bar [2500, 1240, 1155, 655]
{{< /mermaid >}}

The third bar is the change everyone reaches for first. The fourth is the one nobody thinks
of, and it is worth five times as much.

## The field is writable

The Ultra speaks protobuf inside an encrypted BLE session.
[ha-ef-ble](https://github.com/rabits/ha-ef-ble) already implements the handshake, the
session key and the framing under Apache 2.0, so none of that was my work. The meter reading
lives in a message called `CloudMeter`, and anything that can open a session can write it.

{{< mermaid >}}
classDiagram
    class ConfigWrite {
        +CloudMeter cfg_cloud_metter = 383
        +float cfg_inv_target_pwr = 220
        +uint32 cfg_utc_time
    }
    class DisplayPropertyUpload {
        +CloudMeter cloud_metter = 785
        +int32 grid_power
        +int32 battery_power
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

The same message appears in both directions. That symmetry is what makes everything after
this verifiable: you can read back what the device took, and you can see when somebody else
has written to it.

At an injected +180 W the whole thing is 28 bytes. The ruler below counts bytes, not bits.

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

Decoded:

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

`phase_c_power` is `int32`, not `sint32`. Negative numbers sign-extend to a full ten-byte
varint, so telling the inverter you are exporting costs eight bytes more than telling it you
are importing. The same message at -180 W is 36 bytes:

{{< mermaid >}}
---
config:
  packet:
    bitsPerRow: 11
    bitWidth: 52
    showBits: true
---
packet-beta
0: "30 tag"
1: "cc"
2: "fe"
3: "ff"
4: "ff"
5: "ff"
6: "ff"
7: "ff"
8: "ff"
9: "ff"
10: "01"
{{< /mermaid >}}

Eleven bytes to say minus one hundred and eighty. Positive is importing, negative is
exporting, confirmed by experiment rather than assumption.

That message then gets wrapped:

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

Four reads a second over Modbus, one write every 500 ms over BLE. Both clouds are still
there. They lose the race.

{{< mermaid >}}
flowchart LR
    S1["Shelly A&lt;br/&gt;Modbus TCP"] --> R["regulator&lt;br/&gt;4 Hz read, 2 Hz write"]
    S2["Shelly B&lt;br/&gt;Modbus TCP"] --> R
    R -->|"CloudMeter over BLE&lt;br/&gt;~0.3 s old"| U["Stream Ultra"]
    SC["Shelly + EcoFlow clouds"] -.->|"2.5 s, still writing,&lt;br/&gt;now too slow to matter"| U
    U --> G["grid, held on&lt;br/&gt;the import side"]

    style SC fill:#854d0e,stroke:#eab308,color:#fff
    style G fill:#14532d,stroke:#22c55e,color:#fff
{{< /mermaid >}}

That is the whole idea. The rest is not breaking anything.

## Thirteen mechanisms

{{< mermaid >}}
mindmap
  root((zero export))
    read path
      Modbus TCP, input registers
      two meters interleaved
      no write on stale data
    control
      BIAS, deliberate import margin
      rise-only rate limit
      all six subfields set
      re-assert every 500 ms
    guards
      bound-meter serial check
      plausibility clamp
      two-meter divergence
      nine kill switches
    cloud contention
      echo classifier
      immediate re-assert
      counter-kick, rate limited
    failsafe
      dead-man on the meter
      heartbeat gated on writes
      ordered before the hard stop
    proof
      paired causation trials
      A/B against stock
{{< /mermaid >}}

### 1. Read it locally

Write this down if you ever do the same. Read *input registers*, Modbus function code 4.
Function code 3, read holding registers, is the one every example uses and it returns
exception 2 here. Phase blocks sit 20 registers apart, A at 1020, B at 1040, C at 1060,
with voltage at +0, current at +2 and active power at +4. Phase C active power is register
1064. Values are float32 with the two 16-bit halves swapped, low word first. Wide spans
return nothing, so read one block at a time.

### 2. Two meters beat one

There is a second Pro 3EM on the same conductor. I added it as a cross-check. It turned out
to be the largest latency win in the project.

730 paired samples over 40 seconds: each meter updates at exactly 1.00 Hz, their update
instants are 0.412 s apart, and they agree on the regulated phase to 2.3 W of about 780 W.

Two 1 Hz sources with a fixed sub-second offset are not two copies of one reading. Take
whichever is fresher and worst-case age halves.

```
time, s   0.0   0.4   1.0   1.4   2.0   2.4   3.0
meter A   |-----------|-----------|-----------|      1.00 Hz
meter B         |-----------|-----------|-----------  1.00 Hz, +0.412 s
use       A     B     A     B     A     B     A      worst-case age ~0.5 s
```

The per-sample disagreement between them, 5th percentile -21 W and 95th percentile +29 W, is
the offset showing up during load changes. What reads as sensor noise is the thing being
exploited. It is also free redundancy: if one meter stops answering, regulation carries on
with the other.

### 3. BIAS, a deliberate import margin

**BIAS** is a negative offset added to the reading before it is injected. The inverter drives
what it sees to zero, so a negative BIAS parks the house slightly on the import side. That
standing margin, not the speed of the loop, is what actually holds export at zero.

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

The sign is a safety property, not a preference. A positive BIAS tells the inverter it is
importing when it is not, which commands a ramp up and manufactures the export the whole
thing exists to prevent. So every path that can set it applies the same four checks.

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

Three details that matter more than the number itself:

- **The runtime path is validated exactly like the startup path.** A knob that skips the
  safety check is worse than no knob. An unsafe value at startup refuses to start; an unsafe
  value at runtime is discarded and the last good one stays in force. A typo must not be able
  to command export.
- **The file is re-read in an executor, not inline.** Reading it on the event loop at 4 Hz
  was enough for Home Assistant's own loop-blocking detector to complain.
- **BIAS fades on real grid, not on time.** Export risk is a function of how close grid sits
  to zero, so BIAS is at full strength at 0 W and below and fades linearly to nothing at
  500 W of import, where there is no export to prevent and a margin only buys grid.

{{< mermaid >}}
xychart-beta
    title "BIAS applied, W, against real grid, W"
    x-axis "real grid, W of import" [0, 125, 250, 375, 500, 625]
    y-axis "BIAS applied, W" 0 --> 80
    line [68, 51, 34, 17, 0, 0]
    line [68, 68, 68, 68, 0, 0]
{{< /mermaid >}}

The smooth line runs in production. The stepped line is the version I did not build: a hard
threshold moves the injected value by the whole of BIAS in one sample as it crosses, and the
regulator hunts across that step instead of settling.

Because BIAS fades, the steady state is a fixed point, not the BIAS value. The loop drives
`w + BIAS` to zero while BIAS itself shrinks as `w` rises, so grid settles where the two
agree:

```
w = -B * F / (F - B)          B = BIAS (negative), F = fade width (500 W)
```

A BIAS of -150 W gives about +115 W of real import margin, and -68 W gives about +60 W. Worth
knowing before you wonder why -150 does not produce 150 W of import.

**The gate was wrong for weeks.** BIAS originally armed on "battery is discharging". During a
PV surplus the battery charges, so the margin was suppressed for exactly the window it exists
for. One morning's data: 232 samples with BIAS applied against 2709 with it idle, battery
power pinned near +80 W throughout. Turning the number up would have changed nothing, because
the number was not being used. It now arms on proximity to export.

**BIAS shrank as the loop got faster.** The margin covers export during the loop's response
time, so it is priced in latency. Response time fell from 481 ms to about 142 ms and the
default came down from -150 W to -68 W. That is the only part of this project that pays back
in kWh every hour of every day.

### 4. Set all six subfields, every time

`CloudMeter` is not a scalar. A partial write risks landing `has_meter = false`, which unbinds
the meter and disables zero-feed altogether. So every write reads all six subfields from live
telemetry, replaces the one phase being regulated, and writes the whole message back.

{{< mermaid >}}
flowchart LR
    A["write phase_c only"] --> B["has_meter defaults false"]
    B --> C["meter unbound from the plant"]
    C --> D["zero-feed disabled&lt;br/&gt;unbounded export"]
    E["read all six, replace one,&lt;br/&gt;write all six"] --> F["binding preserved"]

    style D fill:#7f1d1d,stroke:#ef4444,color:#fff
    style F fill:#14532d,stroke:#22c55e,color:#fff
{{< /mermaid >}}

### 5. Know what you are talking to

The loop observes for 15 seconds before its first write, then waits until it has seen
`has_meter = true` and the serial it expects. A wrong serial is a hard stop. A missing one is
a wait, because BLE flaps and "no telemetry yet" is not the same as "wrong device".

### 6. Every clamp fails toward import

A rise in the commanded setpoint that overshoots lands on the grid as export. A fall that
undershoots lands as import. Only one of those is a compliance event.

So the rate limiter is one-sided on purpose: rises are rationed, falls are not. Same rule runs
through every guard. If a clamp misfires it has to misfire toward drawing from the grid.

### 7. Stale data means no write

A failed or stale read stops the write rather than letting the last value ride. There is a
plausibility clamp for absurd readings and a short timeout so a slow meter cannot stall the
loop.

### 8. Answer the cloud, then let go slowly

EcoFlow's server still writes the field over MQTT and that link cannot be intercepted. What
can be shortened is how long its value survives.

An echo classifier compares every inbound frame against what was last sent, within 2 W. A
foreign value is therefore recognisable, and the loop re-asserts on sight instead of waiting
out the poll period, which cuts exposure from a whole period to about one BLE round trip.
There is a minimum gap between writes so a burst of cloud frames cannot hammer the link.

It also answers with a value deliberately below target for two cycles, to cancel the ramp the
server just commanded. The first version released that correction in a single write, and that
made export measurably worse, because the release is itself a rising step, the exact thing the
rate limiter exists to prevent. The release is rate limited too. Worst case, if every
correction ran at full size, the mechanism costs about 90 Wh a day of import.

{{< mermaid >}}
sequenceDiagram
    participant M as Shelly (LAN)
    participant R as regulator
    participant U as Stream Ultra
    participant C as EcoFlow cloud

    R->>M: Modbus read, 4 Hz, two meters interleaved
    M-->>R: phase C = +180 W
    Note over R: apply BIAS, apply rise-only limit
    R->>U: ConfigWrite CloudMeter, phase_c = 112
    U-->>R: DisplayPropertyUpload, cloud_metter = 112
    Note over R: matches within 2 W, that was us
    C->>U: cloud writes its own stale value
    U-->>R: DisplayPropertyUpload, cloud_metter = 940
    Note over R: no match, that was not us
    R->>U: re-assert immediately, deliberately low
    R->>U: hold low 2 cycles, then ramp back under the limiter
{{< /mermaid >}}

### 9. Re-assert when nothing changed

The loop rewrites the value every 500 ms whether it moved or not. This costs nothing and buys
a liveness signal: a cumulative write counter that advances at a steady 2 Hz whenever
regulation is happening. That counter turns out to be load bearing later.

### 10. Never cache the device handle

Writes go through a dedicated lock, because the BLE library has no send lock and other things
in the house talk to the same device.

Worse: the library replaces its device object whenever its config entry reloads, and a
disconnect schedules a reload. A reference captured once at startup goes permanently dead
while the live object is healthy. That produced **74,928 consecutive write failures** at loop
rate before I found it, with two other integrations writing to the same physical device
without trouble the whole time. The device is now re-resolved every cycle.

### 11. Kill switches that default to safe

Nine flag files, each toggled by touching or deleting it, no restart: global stop, transport
choice, interleave, shadow mode, quiet logging, A/B mode, the causation test, and the two
protections.

For the two protections, **presence of the file disables**. Forgetting to clean up leaves the
protection on. The default state of a system nobody is watching should be the safe one.

### 12. The divergence guard, wrong twice

Two meters that agree to 0.29% make a good sanity check: if they diverge, stand down rather
than trust a number you cannot verify. Getting it right took two production false trips, both
the same mistake.

**First.** The guard judged divergence on a mean of 40 samples, which is correct. But 40
samples at 250 ms is 10 seconds, and during a ramp the grid moves at something like 270 W/s. A
0.412 s offset between two meters watching a 270 W/s ramp produces a 112 W mean disagreement
that is not disagreement at all. It is the offset doing its job. Fix: only judge divergence
while the plant is quiescent.

**Second.** The quiescence gate tested one of the two meters for flatness. A resistive load
switching instantaneously is flat on the meter you are watching and not flat on the other one.
Another confident wrong verdict. Fix: test both series.

Any guard comparing two sensors has to establish that the world was holding still, and has to
establish it from both sensors.

### 13. Prove it controls something

The device echoes your write back in telemetry, so "the number changed" proves nothing.

The test that works is paired pulses judged only from measurements the device cannot fake: the
independent meter and battery power. Eight alternating trials, half injecting a false reading,
half injecting the truth with identical Bluetooth traffic. The false offset is negative on
purpose, so it commands the inverter to back off; the other sign would command a ramp up and
could cause real export during a test.

False readings moved the inverter by **+903 W** on average against **+29 W** for the true ones.
No overlap between the two sets.

## One cycle, end to end

{{< mermaid >}}
flowchart TD
    A["read both meters over Modbus"] --> B{"fresh and plausible?"}
    B -->|no| Z["no write this cycle"]
    B -->|yes| C["take the fresher sample"]
    C --> D{"plant quiescent?"}
    D -->|yes| E{"meters agree?"}
    E -->|no| Z
    E -->|yes| F
    D -->|"no, ramping"| F["apply BIAS, faded on real grid"]
    F --> G["rise-only rate limit"]
    G --> H{"last frame was foreign?"}
    H -->|yes| I["hold below target, 2 cycles"]
    H -->|no| J["target value"]
    I --> K["set all six subfields"]
    J --> K
    K --> L["re-resolve the device, take the lock"]
    L --> M["BLE write, bump the counter"]

    style Z fill:#854d0e,stroke:#eab308,color:#fff
    style M fill:#14532d,stroke:#22c55e,color:#fff
{{< /mermaid >}}

## Cutting the cloud removed the safety net

Once local injection worked, EcoFlow's writes were pure interference. The clean way to stop
them is not to block EcoFlow, it is to stop feeding them: disable Shelly Cloud on the bound
meter. EcoFlow's server then has no grid reading to push. The phone app still works, firmware
updates still work, local Modbus is untouched.

It worked, and it quietly deleted the entire fallback story.

The original design said, in a comment I wrote myself: *if the local read fails or goes stale,
we stop injecting and let the cloud take over.* True while the cloud had a reading. After the
change, if my regulator stopped on a sunny afternoon, nothing regulated at all. The inverters
would hold their last setpoint and export without bound. I turned a redundant system into a
single point of failure and then congratulated myself on the export numbers.

### The watchdog cannot live on the host

The obvious fix is a Home Assistant automation that spots injection stopping and re-enables
the cloud. It does not work. The single most common way injection stops is Home Assistant
restarting, and during a restart no automation runs.

### So it lives on the meter

Shelly Gen2 devices run scripts in an embedded JavaScript engine inside the firmware event
loop. Sixty lines does it.

{{< mermaid >}}
stateDiagram-v2
    [*] --> Seeded: script start
    note right of Seeded
        seeds from live config, so a start
        on a healthy system writes nothing
    end note
    Seeded --> Healthy: heartbeat within 20 s
    Seeded --> CloudOn: no heartbeat for 20 s

    Healthy --> CloudOn: heartbeat lost > 20 s
    Healthy --> LocalOwns: healthy for 120 s
    LocalOwns --> CloudOn: heartbeat lost > 20 s

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

Home Assistant pokes an HTTP endpoint on the meter every 10 seconds. Twenty seconds of silence
and the script re-enables Shelly Cloud, restoring EcoFlow's own regulation. When the pokes come
back and stay healthy for 120 seconds it disables the cloud again.

Details that decide whether it works:

- **The heartbeat is an HTTP endpoint, not a stored key.** Shelly's key-value store lives in
  the flash partition. At a 10 second cadence that is roughly three million flash writes a year
  for a value whose entire lifetime is one comparison. The endpoint keeps it in RAM.
- **It does not poll Home Assistant.** An outbound poll means storing a long-lived API token on
  a device whose own authentication is disabled. Inverting the direction removes the credential.
- **Every uncertain state resolves to cloud enabled.** Boot, unreadable config, a heartbeat
  never seen: all mean "let the vendor regulate". The only state that disables the cloud is a
  heartbeat proven healthy for two minutes. The failsafe's own failure mode is degraded
  regulation, never none.
- **It seeds from live config on start.** An earlier version started with "want cloud on",
  enabled the cloud on a healthy system, and put it back two minutes later. Two flash writes for
  nothing.
- **The timeout is 20 seconds and the number is measured.** Beat jitter over 14 samples was
  9.80 s minimum, 10.00 s median, 10.20 s maximum, and the device's uptime counter has one
  second resolution. A 10 second timeout on a 10 second cadence tolerates zero late beats. Twenty
  absorbs one missed beat plus jitter.
- **The cost asymmetry points the same way.** A real outage during a 1880 W surplus costs about
  10 Wh per 20 seconds. A spurious engagement costs about 0.1 Wh of extra leak. Trading detection
  latency for no false trips is cheap in both directions.

### The heartbeat has to measure work, not health

The first version sent unconditionally, which makes it a liveness check on `curl`. The second
gated on the regulator's reported state, which is better and still wrong.

Consider the Modbus link dying. State stays `running`. BLE frames stay fresh, because BLE is
fine. The bound meter is still bound. The write-failure counter never moves. Every health
indicator says healthy and nothing is being regulated.

The only signal that catches it is the write counter not advancing. That is why the loop
re-asserts every 500 ms even when nothing changed: it makes a frozen counter mean exactly one
thing, and that one thing covers BLE loss, a dead control loop, a dead meter link, a manual kill
switch and rejected writes.

{{< mermaid >}}
flowchart LR
    W["BLE write counter&lt;br/&gt;+2 per second"] --> D["delta over 10 s&lt;br/&gt;expect 20"]
    D -->|"18 to 21"| H["send heartbeat"]
    D -->|"below 10"| X["stay silent"]
    H --> M["dead-man holds&lt;br/&gt;cloud stays off"]
    X --> F["20 s of silence&lt;br/&gt;cloud comes back"]

    style F fill:#854d0e,stroke:#eab308,color:#fff
    style M fill:#14532d,stroke:#22c55e,color:#fff
{{< /mermaid >}}

### Ordered against the hard stop

A last-resort automation physically cuts the plant's supply on sustained export. The failsafe has
to beat it, or every ordinary outage ends with the plant switched off waiting for a human.

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

Both cloud figures are measured, not assumed: 4 seconds to Shelly Cloud, 8 more before EcoFlow
writes the field. Twenty-seven seconds of margin. Push the timeout past about 45 s and the order
inverts.

### Tested in both directions

Heartbeat stopped while the regulator stayed healthy, so the plant was regulated throughout:

```
asserted after heartbeat loss : 32 s   (expected 30 to 40)
stood down after heartbeat ok : 133 s  (expected 120 to 125)
worst export during the test  : 0 W
```

That run used a 30 second timeout, before it came down to 20.

## Results

The authoritative number is the meter's own returned-energy counter for the regulated phase, out
of long-term statistics rather than off a graph.

| period | exported |
|---|---|
| 12 days before, daily mean | **41.0 Wh/day** |
| day 1 after | 3.7 Wh |
| day 2 after | 4.3 Wh |
| day 3 after, to 16:22 | 1.8 Wh |

About 90% down. On the trend of a full year of prior data, roughly 20 kWh/yr becomes roughly
2 kWh/yr.

| | before | after |
|---|---|---|
| age of the data the inverter steers on | ~2.5 s | **~0.3 s** |
| updates reaching the inverter | ~0.4/s | **~2/s** |
| age of the injected reading | 481 ms | **~142 ms** |
| who owns the setpoint | the cloud | me |
| time on the safe side of zero | ~50% | **~100%** |

Three separate fixes produced the latency figure: the Modbus read, the two-meter interleave, and
a pacing bug where the loop waited a fixed pause after each cycle instead of working out when the
next one was due, so a loop configured for 2 Hz ran at 1.5.

## What did not improve

**Accuracy.** Alternating blocks of my version against the stock cloud version, scored from the
independent meter: average error 27.5 W mine, 25.6 W stock. Within noise, and if anything a hair
worse.

That is not a contradiction. The stock loop already held about 30 W on 2.5 second old data, so
there was almost no error left for speed to remove. What this bought is control, margin and a
fallback I understand, not precision.

**The meter's averaging is the floor.** A full second of the delay belongs to the meter. Everything
else competes for the remaining 150 ms, which is also why the WiFi versus Ethernet question I
worried about is worth under 2% of the total.

**Inrush is out of reach.** The largest single riser of one day, 0.45 Wh, was a heat pump starting:
one negative power sample while current was rising and power factor collapsed. You do not regulate
your way out of an inrush with a 250 ms loop.

**It costs money.** BIAS is real energy bought to avoid exporting. For a system whose rule is "do
not export", that is a bargain. For anyone optimising a feed-in tariff it is the wrong trade.

## If you try this

- **Measure the budget first.** I nearly spent a week on transport latency worth 8%, while a second
  meter I already owned was worth twice as much for an afternoon.
- **Find the asymmetry.** Export and import are not symmetric failures here. Once that is explicit,
  half the design decisions make themselves.
- **A guard comparing two sensors needs a quiescence gate, from both sensors.** Two production false
  trips in one week.
- **A watchdog cannot live inside what it watches.** If your most likely failure is "the host
  restarted", the watchdog cannot be on the host.
- **Instrument work done, not health reported.** Health said `running` for the entire duration of a
  dead link.
- **Check what your safety net depends on before you cut a wire.** Mine was a comment describing a
  mechanism I had disabled a week earlier.
- **Never blind-probe unknown commands.** One blind probe on this hardware reset a safety power
  limit to zero.

## Two parts worth stealing

Most of this is specific: one inverter family, one meter, one phase, thresholds calibrated to my
roof. Two parts are not.

The **dead-man script** is generic. Any setup where a local controller owns a device setpoint and a
vendor cloud is the fallback has this problem. A RAM-only heartbeat endpoint on a third device, with
every uncertain state resolving to the fallback, transfers directly.

The **interleave** transfers too. Two independent sensors sampling the same quantity at the same
rate: check whether their update instants are offset. If they are, you own a faster sensor than
either of them.

{{< alert "triangle-exclamation" >}}
**If you are considering this.** It writes a live battery inverter's control setpoint, on my own
hardware, down a deliberately narrow path: margin only in the safe direction, size capped in code,
no write on a stale reading or a silent link, and a fallback that engages by itself. Do not probe
unknown commands to see what happens. And if you are somewhere export is regulated, the correct
configuration is the one your grid operator agreed to, not the one you can reach over Bluetooth.
{{< /alert >}}

More on this system: [the parallel battery imbalance](/posts/ecoflow-parallel-battery-imbalance/) and
[the 19% charge day](/posts/ecoflow-expandable-battery-broken-promise/).
