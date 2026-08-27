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

I have no export agreement. Every watt the panels make has to be used or stored on my side of
the meter, and the number that matters is zero, not small. (Legal background:
[Balcony Solar in Greece](/posts/balcony-solar-greece-legal/).)

EcoFlow sells zero-feed-in regulation and it works, in the sense that the number is small. My
meter and my inverter are three metres apart in the same panel. Until last week they exchanged
one number via two data centres.

## How zero feed-in works

The whole feature is one number and a loop.

A meter clamped on the incoming cable reads what the house is drawing. That reading is handed to
the inverter. The inverter pushes out power to make the reading zero: house wants 400 W, inverter
gives 400 W, the meter reads nothing, and no energy crosses the boundary in either direction. The
kettle goes on, the reading jumps, the inverter pushes harder. The kettle goes off, the reading
drops, the inverter backs off.

Nobody tells the inverter how much the house wants. It only ever sees one number and tries to
cancel it. Which makes the whole feature exactly as good as that number is.

The meter is the grid's detective. It stands at the boundary, reports everything that crosses, and
the inverter's entire job is to leave it with nothing to report.

{{< mermaid >}}
sequenceDiagram
    actor H as 🏠 The House
    participant M as 🔎 The Meter, the grid's detective
    participant I as ⚡ The Inverter
    participant B as 🔋 The Battery

    H->>M: kettle on, 2000 W
    M->>I: I see 2000 W crossing my clamp. Account for it.
    I->>B: 2000 W, quickly
    B-->>I: 2000 W
    I->>M: try reading it again
    M->>I: nothing. zero crossed.
    Note over M,I: no evidence, no bill, no export

    loop every second, forever
        M->>I: I see 340 W
        I->>M: and now
        M->>I: I see 12 W
        I->>M: I will take that
    end

    H->>M: kettle off
    M->>I: I see minus 1900 W. You are pushing into me.
    I->>M: since when
    M->>I: hard to say. my last report was 2.5 seconds old.
{{< /mermaid >}}

## The hotel shower

You already know this control loop. You turn the tap, nothing happens, so you turn it further.
Three seconds later it scalds you. You back off hard, and three seconds after that it goes cold.

Your hand is fine. Your judgement is fine. You are regulating a shower that stopped existing three
seconds ago. The dead time between the tap and your skin is the entire problem, and no amount of
attention fixes it: the more carefully you chase the temperature, the more you oscillate.

An inverter cancelling a stale meter reading is that hand. The scalding is export.

## The number takes the long way round

Regulation needs the grid reading. Mine comes from a Shelly Pro 3EM on the incoming phase. The
inverter cannot ask it anything.

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

The inverter's copy of that number gets rewritten about every 2.5 seconds. Two and a half seconds
of dead time, in a loop three metres wide.

That is fine while nothing changes, which is most of the time. A compressor start, an EV charger
stepping its current, an oven element: any of those move the grid by several hundred watts inside
one mains cycle. While the new reading is in flight the inverter holds a setpoint chosen for the
old house. If the step was a load switching off, the difference leaves through the meter.

The export is not a leak. It is latency, and it bills once per load event.

There is no setting for this. The firmware has no field for a meter address, host or port
anywhere. `use_lan_meter` appears in telemetry and is read-only.

## Where the time goes

| stage | time |
|---|---|
| Shelly internal aggregation | ~1000 ms |
| Shelly HTTP RPC read over LAN | ~100 ms |
| Modbus TCP read over LAN | ~25 ms |
| BLE write round trip | ~130 ms |
| the cloud path, for comparison | 2000 to 3500 ms |

The Pro 3EM aggregates internally at 1 Hz and that second is not yours. Swapping HTTP RPC for
Modbus on the same device buys 75 ms of a 1200 ms budget: 8%, not the 4x the transport numbers
suggest alone.

{{< mermaid >}}
xychart-beta
    title "Age of the reading the inverter steers on, ms"
    x-axis ["stock, two clouds", "local, HTTP RPC", "local, Modbus", "Modbus + 2 meters"]
    y-axis "milliseconds" 0 --> 2600
    bar [2500, 1240, 1155, 655]
{{< /mermaid >}}

The third bar is the change everyone reaches for. The fourth is worth five times as much and
comes up later.

## The field is writable

The Ultra speaks protobuf inside an encrypted BLE session.
[ha-ef-ble](https://github.com/rabits/ha-ef-ble) already implements the handshake, the session
key and the framing under Apache 2.0, so none of that was my work. The meter reading lives in a
message called `CloudMeter`, and anything that can open a session can write it.

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

The same message appears in both directions, which is what makes the rest verifiable. You can
read back what the device took, and you can see when somebody else has written to it.

At an injected +180 W the whole thing is 28 bytes. The ruler counts bytes, not bits.

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

`phase_c_power` is `int32`, not `sint32`. Negative numbers sign-extend to a ten-byte varint, so
telling the inverter you are exporting costs eight bytes more than telling it you are importing:

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

Eleven bytes to say minus one hundred and eighty. Positive is importing, negative is exporting,
confirmed by experiment rather than assumption.

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

Four reads a second over Modbus, one write every 500 ms over BLE. Nothing leaves the building.

{{< mermaid >}}
flowchart LR
    subgraph panel["one electrical panel, 3 metres wide"]
        direction LR
        S1["Shelly Pro 3EM&lt;br/&gt;solar"]
        S2["Shelly Pro 3EM&lt;br/&gt;mains"]
        U["Stream Ultra x2"]
    end
    S1 -->|"Modbus TCP, 4 Hz"| R["ef_inject&lt;br/&gt;Home Assistant"]
    S2 -->|"Modbus TCP, 4 Hz"| R
    R -->|"BLE, 2 Hz"| U
    R -.->|"heartbeat, every 10 s"| D["dead-man script,&lt;br/&gt;runs on S1"]
    D -.->|"silence re-enables&lt;br/&gt;the vendor path"| S1

    style R fill:#1e3a8a,stroke:#3b82f6,color:#fff
    style D fill:#14532d,stroke:#22c55e,color:#fff
{{< /mermaid >}}

Both clouds are still there and still writing. They lose the race.

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

## Reading it locally

Write this down if you ever do the same. Read *input registers*, Modbus function code 4.
Function code 3, read holding registers, is what every example uses and it returns exception 2
here. Phase blocks sit 20 registers apart, A at 1020, B at 1040, C at 1060, with voltage at +0,
current at +2 and active power at +4. Phase C active power is register 1064. Values are float32
with the two 16-bit halves swapped, low word first. Wide spans return nothing, so read one block
at a time.

Then the part I did not expect. There is a second Pro 3EM on the same conductor, added as a
cross-check, and it turned out to be the largest latency win in the project. Over 730 paired
samples: each meter updates at exactly 1.00 Hz, their update instants are 0.412 s apart, and
they agree on the regulated phase to 2.3 W of about 780 W.

Two 1 Hz sources with a fixed sub-second offset are not two copies of one reading. Take
whichever is fresher and worst-case age halves.

```
time, s   0.0   0.4   1.0   1.4   2.0   2.4   3.0
meter A   |-----------|-----------|-----------|      1.00 Hz
meter B         |-----------|-----------|-----------  1.00 Hz, +0.412 s
use       A     B     A     B     A     B     A      worst-case age ~0.5 s
```

Their per-sample disagreement, 5th percentile -21 W and 95th percentile +29 W, is that offset
showing up during load changes. What reads as sensor noise is the thing being exploited. It is
also free redundancy: if one meter stops answering, regulation carries on with the other.

## BIAS, a deliberate import margin

**BIAS** is a negative offset added to the reading before it is injected. The inverter drives
what it sees to zero, so a negative BIAS parks the house slightly on the import side. That
standing margin, not the speed of the loop, is what holds export at zero.

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
importing when it is not, which commands a ramp up and manufactures the export the whole thing
exists to prevent. So the value is validated on every read, startup and runtime alike:

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

Unsafe at startup refuses to start. Unsafe at runtime is discarded and the last good value stays
in force. A typo must not be able to command export. The file is re-read in an executor rather
than inline: reading it on the event loop at 4 Hz was enough for Home Assistant's own
loop-blocking detector to complain.

BIAS fades on real grid, not on time. Export risk is a function of how close grid sits to zero,
so it runs at full strength at 0 W and below and fades to nothing at 500 W of import, where there
is no export to prevent and a margin only buys grid.

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
`w + BIAS` to zero while BIAS shrinks as `w` rises, so grid settles where the two agree:

```
w = -B * F / (F - B)          B = BIAS (negative), F = fade width (500 W)
```

which is why -150 W gives about +115 W of real import margin and -68 W gives about +60 W.

Two things about it were wrong for a while. BIAS originally armed on "battery is discharging",
and during a PV surplus the battery charges, so the margin was suppressed for exactly the window
it exists for. One morning: 232 samples with BIAS applied against 2709 with it idle, battery
power pinned near +80 W throughout. Turning the number up would have changed nothing, because
the number was not being used. It arms on proximity to export now.

The other is that BIAS was too big. The margin covers export during the loop's response time, so
it is priced in latency. Response time fell from 481 ms to about 142 ms, and the default came
down from -150 W to -68 W. Every millisecond removed from the loop is grid you stop buying.

## Everything fails toward import

A rise in the commanded setpoint that overshoots lands on the grid as export. A fall that
undershoots lands as import. Only one of those is a compliance event, so the rate limiter is
one-sided: rises are rationed, falls are not. Every guard follows the same rule. If a clamp
misfires it has to misfire toward drawing from the grid.

The same thinking covers the boring cases. A failed or stale read stops the write rather than
letting the last value ride. There is a plausibility clamp for absurd readings and a short
timeout so a slow meter cannot stall the loop.

`CloudMeter` is not a scalar, and that one bites harder than it looks:

{{< mermaid >}}
flowchart LR
    A["write phase_c only"] --> B["has_meter defaults false"]
    B --> C["meter unbound from the plant"]
    C --> D["zero-feed disabled&lt;br/&gt;unbounded export"]
    E["read all six, replace one,&lt;br/&gt;write all six"] --> F["binding preserved"]

    style D fill:#7f1d1d,stroke:#ef4444,color:#fff
    style F fill:#14532d,stroke:#22c55e,color:#fff
{{< /mermaid >}}

So does not knowing what you are connected to. The loop observes for 15 seconds before its first
write, then waits for `has_meter = true` and the serial it expects. A wrong serial is a hard
stop. A missing one is a wait, because BLE flaps and "no telemetry yet" is not "wrong device".

Nine flag files can disable pieces of this at runtime, no restart. For the two protections,
presence of the file disables, so forgetting to clean up leaves the protection on. The default
state of a system nobody is watching should be the safe one.

## Racing the cloud

EcoFlow's server still writes the field over MQTT and that link cannot be intercepted. What can
be shortened is how long its value survives.

An echo classifier compares every inbound frame against what was last sent, within 2 W, so a
foreign value is recognisable. The loop re-asserts on sight instead of waiting out the poll
period, cutting exposure from a whole period to about one BLE round trip. A minimum gap between
writes stops a burst of cloud frames hammering the link.

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

Answering low for two cycles cancels the ramp the server just commanded. The first version
released that correction in a single write and made export measurably worse, because the release
is itself a rising step, the exact thing the rate limiter exists to prevent. The release is rate
limited too. Worst case, if every correction ran at full size, the mechanism costs about 90 Wh a
day of import.

The loop also rewrites the value every 500 ms whether it moved or not. That buys a liveness
signal: a counter that advances at a steady 2 Hz whenever regulation is happening. It becomes
load bearing later.

## Three things that were confidently wrong

**The device handle.** The BLE library replaces its device object whenever its config entry
reloads, and a disconnect schedules a reload. A reference captured once at startup goes
permanently dead while the live object is healthy. That produced **74,928 consecutive write
failures** at loop rate, with two other integrations writing to the same physical device
throughout. The device is re-resolved every cycle now.

**The divergence guard, twice.** Two meters agreeing to 0.29% make a good sanity check: if they
diverge, stand down. It judged divergence on a mean of 40 samples, which is right. But 40 samples
at 250 ms is 10 seconds, and during a ramp the grid moves at something like 270 W/s. A 0.412 s
offset between two meters watching a 270 W/s ramp produces a 112 W mean disagreement that is not
disagreement at all. It is the offset doing its job.

So I gated it on the plant being quiescent, and tested one of the two meters for flatness. A
resistive load switching instantaneously is flat on the meter you are watching and not flat on
the other one. Another confident wrong verdict, same week. Any guard comparing two sensors has to
establish that the world was holding still, and has to establish it from both sensors.

**Proof that it controls anything.** The device echoes your write back in telemetry, so "the
number changed" proves nothing. The test that works is paired pulses judged only from
measurements the device cannot fake: the independent meter and battery power. Eight alternating
trials, half injecting a false reading, half injecting the truth with identical Bluetooth
traffic. The false offset is negative on purpose, so it commands the inverter to back off; the
other sign would command a ramp up and could cause real export during a test. False readings
moved the inverter by **+903 W** on average against **+29 W** for the true ones, no overlap.

## Cutting the cloud removed the safety net

Once local injection worked, EcoFlow's writes were interference. The clean way to stop them is
not to block EcoFlow, it is to stop feeding them: disable Shelly Cloud on the bound meter.
EcoFlow's server then has no grid reading to push. The phone app still works, firmware updates
still work, local Modbus is untouched.

It worked, and it deleted the fallback story.

The original design said, in a comment I wrote myself: *if the local read fails or goes stale, we
stop injecting and let the cloud take over.* True while the cloud had a reading. After the change,
if my regulator stopped on a sunny afternoon nothing regulated at all, and the inverters would
hold their last setpoint and export without bound. I turned a redundant system into a single
point of failure and then congratulated myself on the export numbers.

The obvious fix is an automation that spots injection stopping and re-enables the cloud. It does
not work. The single most common way injection stops is Home Assistant restarting, and during a
restart no automation runs.

### So it lives on the meter

Shelly Gen2 devices run scripts in an embedded JavaScript engine inside the firmware event loop.
Sixty lines does it. Home Assistant pokes an HTTP endpoint on the meter every 10 seconds; twenty
seconds of silence and the script re-enables Shelly Cloud, restoring EcoFlow's own regulation.

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

Details that decide whether it works:

- **The heartbeat is an HTTP endpoint, not a stored key.** Shelly's key-value store lives in the
  flash partition. At a 10 second cadence that is roughly three million flash writes a year for a
  value whose entire lifetime is one comparison. The endpoint keeps it in RAM.
- **It does not poll Home Assistant.** An outbound poll means storing a long-lived API token on a
  device whose own authentication is disabled. Inverting the direction removes the credential.
- **Every uncertain state resolves to cloud enabled.** Boot, unreadable config, a heartbeat never
  seen: all of them mean "let the vendor regulate". The only state that disables the cloud is a
  heartbeat proven healthy for two minutes.
- **The timeout is 20 seconds and the number is measured.** Beat jitter over 14 samples ran 9.80
  to 10.20 s and the device's uptime counter has one second resolution, so a 10 second timeout
  tolerates zero late beats. A real outage during a 1880 W surplus costs about 10 Wh per 20
  seconds; a spurious engagement costs about 0.1 Wh of extra leak. The asymmetry pays for the
  wait.

### The heartbeat has to measure work, not health

The first version sent unconditionally, which makes it a liveness check on `curl`. The second
gated on the regulator's reported state, which is better and still wrong.

Consider the Modbus link dying. State stays `running`. BLE frames stay fresh, because BLE is
fine. The bound meter is still bound. The write-failure counter never moves. Every health
indicator says healthy and nothing is being regulated.

Only the write counter catches that. Which is why the loop re-asserts every 500 ms even when
nothing changed: it makes a frozen counter mean exactly one thing, and that one thing covers BLE
loss, a dead control loop, a dead meter link, a manual kill switch and rejected writes.

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

Both cloud figures are measured: 4 seconds to reach Shelly Cloud, 8 more before EcoFlow writes
the field. Twenty-seven seconds of margin. Push the timeout past about 45 s and the order inverts.

Tested by stopping the heartbeat while the regulator stayed healthy, so the plant was regulated
throughout:

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

Three fixes produced that latency figure: the Modbus read, the two-meter interleave, and a pacing
bug where the loop waited a fixed pause after each cycle instead of working out when the next one
was due, so a loop configured for 2 Hz ran at 1.5.

The shower still has dead time. It is a third of a second now instead of two and a half, and the
plumbing no longer goes through two data centres.

## What did not improve

**Accuracy.** Alternating blocks of my version against the stock cloud version, scored from the
independent meter: average error 27.5 W mine, 25.6 W stock. Within noise, and if anything a hair
worse. The stock loop already held about 30 W on 2.5 second old data, so there was almost no
error left for speed to remove. What this bought is control, margin and a fallback I understand.

**The meter's averaging is the floor.** A full second of the delay belongs to the meter.
Everything else competes for the remaining 150 ms, which is also why the WiFi versus Ethernet
question I worried about is worth under 2% of the total.

**Inrush is out of reach.** The largest single riser of one day, 0.45 Wh, was a heat pump
starting: one negative power sample while current was rising and power factor collapsed. You do
not regulate your way out of an inrush with a 250 ms loop.

**It costs money.** BIAS is real energy bought to avoid exporting. For a system whose rule is "do
not export" that is a bargain. For anyone optimising a feed-in tariff it is the wrong trade.

## If you try this

- **Measure the budget first.** I nearly spent a week on transport latency worth 8%, while a
  second meter I already owned was worth twice as much for an afternoon.
- **Find the asymmetry.** Export and import are not symmetric failures here. Once that is
  explicit, half the design decisions make themselves.
- **A guard comparing two sensors needs a quiescence gate, from both sensors.**
- **A watchdog cannot live inside what it watches.** If your most likely failure is "the host
  restarted", the watchdog cannot be on the host.
- **Instrument work done, not health reported.** Health said `running` for the entire duration of
  a dead link.
- **Check what your safety net depends on before you cut a wire.** Mine was a comment describing a
  mechanism I had disabled a week earlier.
- **Never blind-probe unknown commands.** One blind probe on this hardware reset a safety power
  limit to zero.

Two parts of this are not specific to my roof. The dead-man script is generic: any setup where a
local controller owns a device setpoint and a vendor cloud is the fallback has this problem, and a
RAM-only heartbeat endpoint on a third device transfers directly. So does the interleave. If you
have two independent sensors sampling the same quantity at the same rate, check whether their
update instants are offset. If they are, you own a faster sensor than either of them.

{{< alert "triangle-exclamation" >}}
**If you are considering this.** It writes a live battery inverter's control setpoint, on my own
hardware, down a deliberately narrow path: margin only in the safe direction, size capped in code,
no write on a stale reading or a silent link, and a fallback that engages by itself. Do not probe
unknown commands to see what happens. And if you are somewhere export is regulated, the correct
configuration is the one your grid operator agreed to, not the one you can reach over Bluetooth.
{{< /alert >}}

More on this system: [the parallel battery imbalance](/posts/ecoflow-parallel-battery-imbalance/)
and [the 19% charge day](/posts/ecoflow-expandable-battery-broken-promise/).
