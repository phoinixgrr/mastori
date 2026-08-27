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
summary: "My meter and my inverter sit three metres apart and were exchanging one number via two clouds. Now the meter is read on the LAN and written straight into the inverter over Bluetooth, twice a second, with an import cushion, a rise-only rate limit, and a dead-man switch running on the meter itself. Export fell from 41 Wh a day to about 4."
keywords: [
  "ecoflow stream ultra zero export",
  "ecoflow zero feed in latency",
  "ecoflow cloud meter",
  "cfg_cloud_metter",
  "ecoflow CloudMeter protobuf",
  "shelly pro 3em modbus tcp registers",
  "shelly pro 3em 1 hz update rate",
  "shelly pro 3em modbus register 1064",
  "shelly script cloud dead man switch",
  "zero export regulation greece",
  "home assistant ecoflow ble",
  "ecoflow stream ultra home assistant"
]
---

I have no grid-tie agreement, so pushing energy back into the grid is not allowed. Every
watt my panels make has to be used or stored on my side of the meter. The requirement is
not "minimise export" or "mostly don't export", it is zero. (Legal background is in
[Balcony Solar in Greece](/posts/balcony-solar-greece-legal/).)

EcoFlow sells exactly that feature, and it works, in the sense that the number is small.
It just is not zero. Once I looked at why, the answer turned out to be geography.

## The problem is a round trip through two clouds

Zero-feed-in regulation needs a grid reading. Mine comes from a Shelly Pro 3EM on the
incoming phase. Both devices sit in the same electrical panel, three metres apart, both on
my LAN. They do not talk to each other. The reading goes out to Shelly's cloud, across to
EcoFlow's cloud, and back down to the inverter.

{{< mermaid >}}
flowchart LR
    subgraph panel["my electrical panel, 3 metres wide"]
        S["Shelly Pro 3EM"]
        U["Stream Ultra"]
    end
    S -->|"HTTPS"| SC["Shelly Cloud"]
    SC -->|"server to server"| EC["EcoFlow Cloud"]
    EC -->|"MQTT"| U

    style SC fill:#854d0e,stroke:#eab308,color:#fff
    style EC fill:#854d0e,stroke:#eab308,color:#fff
{{< /mermaid >}}

Two internet round trips, two vendor backends, and a device-side field the EcoFlow server
rewrites roughly every 2.5 seconds. The inverter regulates against a number that is, at
best, a couple of seconds stale.

That is fine when nothing changes. It is not fine when something switches on. Any step
load, a heat pump compressor, an EV charger changing current, an oven element, moves the
grid by hundreds of watts within one mains cycle. For the seconds it takes the new reading
to travel around the world, the inverter holds a setpoint chosen for a house that no
longer exists. If the step was a load turning *off*, the difference goes out to the grid.

So the export is not a leak. It is a latency artifact, and it lands once per load event.

There is no setting to fix this. The firmware has no field anywhere for a meter's address,
hostname or port, so it structurally cannot be pointed at a device on my network.
`use_lan_meter` exists in its telemetry and is read-only.

## The latency budget, measured before optimising

Worth doing this first, because the intuitive answer is wrong.

| stage | time |
|---|---|
| Shelly internal aggregation | ~1000 ms |
| Shelly HTTP RPC read over LAN | ~100 ms |
| Modbus TCP read over LAN | ~25 ms |
| BLE write round trip | ~130 ms |
| the cloud path, for comparison | 2000 to 3500 ms |

The Pro 3EM aggregates internally at 1 Hz. That 1000 ms is not mine to optimise. Switching
my read transport from HTTP RPC to Modbus TCP on the same device saves about 75 ms out of a
budget of roughly 1.2 seconds. Real, worth having, and an 8% improvement rather than the 4x
the transport figures suggest in isolation.

The win is not in reading faster. The win is in not going through two clouds.

## The field, and what it actually looks like on the wire

The Ultra speaks protobuf over an encrypted BLE session. There is an excellent open source
library for that protocol ([ha-ef-ble](https://github.com/rabits/ha-ef-ble), Apache 2.0),
which is what I built on. The meter reading lives in a message called `CloudMeter`, and it
is writable by anything that can reach the device.

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
        <<enumeration>>
        NONE = 0
        CT_EF_01 = 1
        CT_SHELLY_3EM = 2
        CT_SHELLY_PRO_3EM = 3
        IR_TIBBER_PULSE = 4
        IR_POWERFOX_PA201902 = 5
        CT_EF_PRO_3EM = 6
    }
    ConfigWrite --> CloudMeter : I write this one
    DisplayPropertyUpload --> CloudMeter : the device reports back here
    CloudMeter --> METER_MODEL
{{< /mermaid >}}

Note that the same message appears on both sides. Field 383 in `ConfigWrite` is the way in,
and field 785 in `DisplayPropertyUpload` is the device telling you what it currently
believes. That symmetry is what makes the whole thing verifiable: you can read back exactly
what the device took, and you can see when somebody else has written to it.

Serialised, the entire thing is 28 bytes:

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

A pleasing quirk: `phase_c_power` is a plain `int32`, not `sint32`, so negative values are
sign-extended to a full 10-byte varint. Telling the inverter you are *exporting* costs 8
more bytes than telling it you are importing. The same message at -180 W is 36 bytes
instead of 28.

Sign convention, confirmed experimentally rather than assumed: positive is importing,
negative is exporting.

The protobuf is then wrapped for transport. For this device family the outer frame is a
version 19 EcoFlow packet with `cmd_set 0xFE`, `cmd_id 0x11`, encrypted with the session
key negotiated at connect time.

{{< mermaid >}}
flowchart TB
    A["phase_c_power = 180<br/>one int32"] --> B["CloudMeter<br/>25 bytes, all six fields pinned"]
    B --> C["ConfigWrite.cfg_cloud_metter = 383<br/>28 bytes"]
    C --> D["EcoFlow Packet v19<br/>src 0x20, dst 0x02, cmd_set 0xFE, cmd_id 0x11"]
    D --> E["AES session encryption<br/>key from connect-time handshake"]
    E --> F["BLE GATT write<br/>~130 ms round trip"]

    style A fill:#1e3a8a,stroke:#3b82f6,color:#fff
    style F fill:#14532d,stroke:#22c55e,color:#fff
{{< /mermaid >}}

## What I have now

A loop that reads the meter on the LAN four times a second and asserts the value over
Bluetooth about twice a second, out-pacing the cloud.

{{< mermaid >}}
flowchart LR
    S1["Shelly A<br/>Modbus TCP"] --> R["regulator<br/>4 Hz read, 2 Hz write"]
    S2["Shelly B<br/>Modbus TCP"] --> R
    R -->|"CloudMeter over BLE<br/>~0.3 s old"| U["Stream Ultra"]
    SC["Shelly + EcoFlow clouds"] -.->|"2.5 s, still there,<br/>now loses the race"| U
    U --> G["grid, held just<br/>on the import side"]

    style SC fill:#854d0e,stroke:#eab308,color:#fff
    style G fill:#14532d,stroke:#22c55e,color:#fff
{{< /mermaid >}}

That is the whole idea. Everything interesting after this point is about not breaking
things.

## Every mechanism, enumerated

### 1. Local read, two transports

HTTP RPC first, then Modbus TCP on the same device. For anyone searching later: read
*input* registers with function code 4, because function code 3 returns exception 2. Phase
blocks are 20 registers apart, A at 1020, B at 1040, C at 1060, with voltage at +0, current
at +2 and active power at +4. So phase C active power is register 1064. Values are float32
with the two 16-bit halves swapped, low word first. Asking for a wide span returns nothing,
so read small.

### 2. Two meters interleaved, which was the biggest win

I have a second Pro 3EM on the same conductor. I expected a cross-check. I got the largest
single latency improvement in the project.

Measured over 40 seconds at 20 Hz, 730 paired samples:

- each meter updates at exactly 1.00 Hz
- their update instants are offset by **0.412 seconds**
- they agree on the regulated phase to 2.3 W out of about 780 W, which is 0.29%

Two independent 1 Hz sources with a fixed sub-second offset are not two copies of the same
information. Taking whichever updated most recently roughly **halves** effective staleness,
from about 1000 ms to about 500 ms. That is worth roughly five times the transport change
and it costs nothing but a second socket. It is free redundancy too: if one meter stops
answering, regulation continues on the other.

The pleasing part is that the per-sample disagreement between the two meters, 5th
percentile -21 W and 95th percentile +29 W, *is* the offset showing itself during load
changes. What looks like measurement noise is the signal being exploited.

### 3. The import cushion, which is the part I care about most

The regulator drives what it *sees* to zero. It sees `truth + bias`. So a negative bias
parks the house at a slight **import**, which is a margin against real export instead of
hunting back and forth across zero.

Everything about this mechanism is shaped by one rule: a positive bias would tell the
inverter it is importing when it is not, commanding it to ramp *up* and manufacturing the
very export the system exists to prevent. So:

- the bias is validated as non-positive, non-NaN and within a hard magnitude cap, at
  startup *and* on every runtime change. An unsafe value refuses to start rather than
  running unprotected
- it is tunable at runtime without a restart, and the runtime path is validated by exactly
  the same two rules as the startup path, because a knob that skips the safety check is
  worse than no knob
- an unparseable or unsafe value is refused and the previous good value stays in force. An
  operator typo must not be able to command export

**It fades, and it fades on the right variable.** Export risk is a function of how close
real grid sits to zero, so the cushion is at full strength at 0 W and below, and fades
linearly to nothing at 500 W of import, where there is no export to prevent and a cushion
would only buy grid for no reason. The fade is continuous on purpose: a hard threshold
would step the injected value by the whole bias as it crossed, and the regulator would hunt
across that step instead of settling.

Because the bias fades, the steady state is a fixed point rather than the bias itself. The
regulator drives `w + bias` to zero, so real grid settles at

```
w = -B * F / (F - B)          B = bias (negative), F = fade width (500 W)
```

which for a bias of -150 W is about +115 W of real import cushion, and for -68 W is about
+60 W.

**The gate used to be wrong in an interesting way.** It originally armed on "battery is
discharging". During a PV surplus the battery *charges*, so the cushion was suppressed for
the entire window it existed for. Measured on one morning: 232 samples biased against 2709
idle, with battery power pinned near +80 W. Raising the bias would have changed precisely
nothing. Arming on proximity to export instead of battery direction fixed it.

**And it got smaller as the loop got faster.** The cushion covers export during the loop's
response time. When that response time fell from 481 ms to about 142 ms, the same
protection needed materially less margin, so the default came down from -150 W to -68 W.
Latency work paying for itself in kWh.

### 4. All six subfields pinned

`CloudMeter` is not a scalar. Writing a partial message risks landing `has_meter = false`,
which unbinds the meter from the plant and disables zero-feed entirely. So every write
reads all six subfields from live telemetry, replaces only the one phase being regulated,
and writes the whole message back.

### 5. Refuses to start until it is sure what it is talking to

It observes for 15 seconds before the first write, then waits until it has seen
`has_meter = true` *and* the serial number it expects. A wrong serial is a hard stop, not a
retry. A missing one is a wait, not an abort, because the BLE link flaps and "no telemetry
yet" is transient.

### 6. Every clamp fails toward import

The asymmetry at the heart of the design, and it took me longer than it should have to see
it. A rise in the commanded setpoint that overshoots lands on the grid as export. A fall
that undershoots lands as import. **Only one of those is a compliance event.**

So the rate limiter is deliberately one-sided: rises are rationed, falls are not. The same
logic runs through every guard. If a clamp misfires, it must misfire in the direction of
drawing from the grid.

### 7. No write on stale or implausible data

A failed or stale local read stops the write entirely rather than letting the last value
ride. There is a plausibility clamp for absurd readings, and a short HTTP timeout so a slow
meter cannot stall the loop.

### 8. Answering the cloud's overwrites, and letting go slowly

The EcoFlow server still writes the field over its own MQTT link, which cannot be
intercepted. What *can* be shortened is how long its value survives. An echo classifier
compares every inbound telemetry frame against what was last sent, within a 2 W tolerance,
so a foreign value is recognisable. On seeing one the loop re-asserts immediately instead of
waiting out the poll period, cutting exposure to about one BLE round trip, with a minimum
gap between writes so a burst of cloud frames cannot hammer the link.

It also answers with a value deliberately *below* target for two keepalive cycles, to cancel
the ramp the server just commanded. The first version released that correction in a single
write, and that measurably made export **worse**, because the release is itself a rising
step, the exact thing the rate limiter exists to prevent. So the release is rate limited
too. Worst case cost of the mechanism, if every correction ran at full size, is about 90 Wh
of import a day. Import, not export, which is the whole point.

{{< mermaid >}}
sequenceDiagram
    participant M as Shelly (LAN)
    participant R as regulator
    participant U as Stream Ultra
    participant C as EcoFlow cloud

    R->>M: Modbus read (4 Hz, two meters interleaved)
    M-->>R: phase C = +180 W
    Note over R: apply fading import cushion<br/>apply rise-only rate limit
    R->>U: ConfigWrite CloudMeter, phase_c = 120
    U-->>R: DisplayPropertyUpload, cloud_metter = 120
    Note over R: echo matches within 2 W, that was us
    C->>U: cloud writes its own stale value
    U-->>R: DisplayPropertyUpload, cloud_metter = 940
    Note over R: no match, that was not us
    R->>U: immediate re-assert, deliberately low
    R->>U: hold low for 2 cycles, then ramp back
{{< /mermaid >}}

### 9. Re-assert even when nothing changed

The loop rewrites the value every 500 ms whether or not it moved. This costs nothing and
buys a liveness signal: a cumulative write counter that advances at a steady 2 Hz whenever
regulation is actually happening. That counter turns out to be load bearing later.

### 10. Serialised writes and a device reference that is never cached

Writes go through a dedicated lock, because the BLE library has no send lock of its own and
other things in the house also talk to this device.

More painfully: the library replaces its device object whenever its config entry reloads,
and a disconnect schedules a reload. A reference captured once at loop start therefore goes
permanently dead while the live object is perfectly healthy. This produced **74,928
consecutive write failures** at the loop rate before I understood it, with two other
integrations writing to the same physical device without trouble the whole time. The device
is now re-resolved on every single cycle and the listener re-attached whenever the object
identity changes.

### 11. Nine kill switches, with the polarity chosen carefully

Every experimental mechanism can be toggled at runtime by touching a file, with no restart:
a global stop, transport selection, interleave, shadow mode (observe without acting), quiet
logging, A/B mode, the causation test, and the two protections.

For the protections, **presence of the file disables**, so forgetting to clean up leaves the
protection *on*. The default state of a system nobody is watching should be the safe one.

### 12. A guard on the two meters, which was wrong twice

Two meters agreeing to 0.29% make a good sanity check: if they diverge, something is broken
and the regulator should stand down rather than trust a number it cannot verify.

Getting that right took two production false trips, both the same class of mistake.

**First.** The guard judged divergence on a mean of 40 samples rather than any single
reading, which is correct. But 40 samples at 250 ms is only 10 seconds, and during a fast
ramp the grid moves at something like 270 W/s. A 0.412 s offset between two meters watching
a 270 W/s ramp produces a 112 W mean disagreement that is not disagreement at all. It is the
offset doing exactly what it is supposed to do. Fix: only judge divergence while the plant
is quiescent.

**Second.** The quiescence gate tested one of the two meters for flatness. A resistive load
switching instantaneously is flat on the meter you are watching and not flat on the other.
Another confident, wrong verdict. Fix: test both series.

The general lesson, which I now apply reflexively: any guard comparing two sensors must
first establish that the world was holding still, and must establish it from *both* sensors.

### 13. Proof that it actually controls anything

Early on, the obvious trap: the device echoes your write back in telemetry, so
"the number changed" proves nothing about control.

The test that does work is paired pulses judged only from physical measurements the device
cannot fake, namely the independent meter and battery power. Eight alternating trials, half
injecting a deliberately false reading, half injecting the truth with identical Bluetooth
traffic. The offset direction is deliberately negative, faking export, so the inverter is
commanded to back *off*; the opposite sign would command a ramp up and could cause real
export during a test.

The false readings moved the inverter by **+903 W** on average against **+29 W** for the
true ones, with no overlap between the two sets.

## Then I cut the cloud, and broke my own safety net

Once local injection worked, the EcoFlow server's writes were pure interference. The clean
way to stop them is not to block EcoFlow, it is to stop *feeding* them: disable Shelly Cloud
on the bound meter. The EcoFlow server then has no grid reading to push. The phone app still
works, firmware updates still work, local Modbus is untouched.

This worked, and it quietly removed the entire fallback story.

The original design said, in a comment I had written myself: *if the local read fails or goes
stale, we stop injecting and let the cloud take over.* That was true when the cloud had a
reading. Afterwards, if my regulator stopped on a sunny afternoon, nothing regulated at all.
The inverters would hold their last setpoint and export without bound. I had turned a
redundant system into a single point of failure and congratulated myself on the export
numbers.

### A watchdog inside the thing being watched does not work

The obvious fix is an automation that notices injection stopped and re-enables the cloud.
This does not work, and the reason is embarrassing in hindsight: **the single most common way
injection stops is Home Assistant restarting, and during a restart no automation runs.**

So the dead-man switch had to live somewhere else. It lives on the meter.

### A dead-man switch running on the electricity meter

Shelly Gen2 devices run scripts in an embedded JavaScript engine, on the device, inside the
firmware event loop. About 60 lines of code does the job.

{{< mermaid >}}
stateDiagram-v2
    [*] --> Seeded: script start
    note right of Seeded
        seeds from live config, so a start
        while healthy writes nothing
    end note
    Seeded --> Healthy: heartbeat within 20 s
    Seeded --> CloudOn: no heartbeat for 20 s

    Healthy --> CloudOn: heartbeat lost > 20 s
    Healthy --> LocalOwns: healthy for 120 s
    LocalOwns --> CloudOn: heartbeat lost > 20 s

    CloudOn --> Healthy: heartbeat returns
    note left of CloudOn
        Shelly Cloud ENABLED
        EcoFlow regulates again
        degraded, but bounded
    end note
    note right of LocalOwns
        Shelly Cloud disabled
        local regulator owns the field
    end note
{{< /mermaid >}}

Home Assistant pokes an HTTP endpoint on the meter every 10 seconds. If the pokes stop for
20 seconds the script re-enables Shelly Cloud, restoring EcoFlow's own server-side
regulation. When the pokes come back and stay healthy for 120 seconds it disables the cloud
again so the local regulator has the field uncontested.

Design notes that are not obvious:

**The heartbeat is an HTTP endpoint, not a stored key.** Shelly's key-value store lives in
the flash partition. At a 10 second cadence that is roughly three million flash writes a
year, for a value whose entire lifetime is one comparison. The endpoint keeps it in RAM.

**It does not poll Home Assistant.** An outbound poll would mean storing a long-lived API
token on a device whose own authentication is disabled. Inverting the direction removes the
credential entirely.

**Every uncertain state resolves to cloud enabled.** Boot, unreadable config, a heartbeat
never seen: all of them mean "let the vendor regulate". The only state that disables the
cloud is a heartbeat proven healthy for two minutes. The failure mode of the failsafe is
degraded regulation, never no regulation.

**It seeds itself from live config on start.** An earlier version started with "want cloud
on" and immediately enabled the cloud on a perfectly healthy system, then put it back two
minutes later, writing flash twice for nothing.

**The timeout is 20 seconds, and the number is measured.** Beat jitter over 14 samples was
9.80 s minimum, 10.00 s median, 10.20 s maximum, and the device's uptime counter has one
second resolution. A 10 second timeout on a 10 second cadence tolerates zero late beats and
would false-trip. 20 seconds absorbs one missed beat plus jitter. The cost asymmetry points
the same way: a real outage during a 1880 W surplus costs about 10 Wh per 20 seconds, while
a spurious engagement costs about 0.1 Wh of extra leak.

**It is ordered against the hard stop.** A last-resort automation physically cuts the
plant's supply on sustained export. Re-enabling Shelly Cloud reaches Shelly Cloud in 4
seconds and EcoFlow resumes writing the meter field 8 seconds after that, both measured.
Worst case from heartbeat loss to a regulating cloud is 20 + 5 + 8 = 33 seconds, against a
cut at 60 seconds. The failsafe wins by 27 seconds, so an ordinary outage self-heals instead
of ending with the plant switched off waiting for a human.

### The heartbeat has to gate on the right signal

The first version sent unconditionally, which makes it a liveness check on `curl` rather
than on regulation. The second gated on the regulator's reported state, which is better and
still wrong.

Consider the Modbus link dying. State stays `running`. BLE frames stay fresh, because BLE is
unaffected. The bound meter is still bound. The write-failure counter never moves. Every
health indicator says fine, and nothing is being regulated.

The only signal that catches this is the write counter not advancing. Which is why the loop
re-asserts every 500 ms even when nothing changed: it makes a frozen counter mean exactly one
thing, and that one thing subsumes BLE loss, a dead control loop, a dead meter link, a manual
kill switch and rejected writes. The heartbeat gates on the delta of that counter and nothing
else.

{{< mermaid >}}
flowchart LR
    W["BLE write counter<br/>+2 per second"] --> D["delta over 10 s<br/>expected 20"]
    D -->|"20"| H["send heartbeat"]
    D -->|"below 10"| X["stay silent"]
    H --> M["meter dead-man<br/>cloud stays off"]
    X --> F["20 s of silence<br/>cloud comes back"]

    style F fill:#854d0e,stroke:#eab308,color:#fff
    style M fill:#14532d,stroke:#22c55e,color:#fff
{{< /mermaid >}}

### It was tested, in both directions

Stopping the heartbeat while leaving the regulator healthy, so the plant stayed regulated
throughout:

```
asserted after heartbeat loss : 32 s   (expected 30 to 40)
stood down after heartbeat ok : 133 s  (expected 120 to 125)
worst export during the test  : 0 W
```

That run used a 30 second timeout, before it was lowered to 20.

## What got better

The authoritative number is the meter's own returned-energy counter for the regulated phase,
read out of long-term statistics rather than eyeballed off a graph.

| period | exported |
|---|---|
| 12 days before, daily mean | **41.0 Wh/day** |
| day 1 after | 3.7 Wh |
| day 2 after | 4.3 Wh |
| day 3 after, to 16:22 | 1.8 Wh |

About a 90% reduction. On the trend of a full year of prior data the counter goes from
roughly 20 kWh/yr to roughly 2 kWh/yr.

The loop-level numbers behind that:

| | before | after |
|---|---|---|
| age of the data the inverter steers on | ~2.5 s | **~0.3 s** |
| updates reaching the inverter | ~0.4/s | **~2/s** |
| age of the injected reading | 481 ms | **~142 ms** |
| who controls the setpoint | the cloud | me |
| time on the safe side of zero | ~50% | **~100%** |

Three separate fixes produced the latency improvement: the Modbus read, the two-meter
interleave, and a pacing bug where the loop waited a fixed pause *after* each cycle instead
of working out when the next one was due, so a loop configured for 2 Hz was actually running
at 1.5.

## What did not get better

**Accuracy is unchanged.** Alternating blocks of my version against the stock cloud version,
scored from the independent meter: average error 27.5 W mine, 25.6 W stock. Within noise, and
if anything a hair worse.

That is not a contradiction. The stock loop was already holding to about 30 W on 2.5 second
old data, so there was almost no error left for speed to remove. The gain here is **control,
margin and a fallback I understand**, not precision.

**The meter's own averaging is the floor.** About a full second of the delay belongs to the
meter and cannot be reduced from my side. Everything else competes for the remaining ~150 ms,
which is also why the WiFi versus Ethernet question I had been worrying about turned out to
be worth under 2% of the total.

**Inrush is out of reach.** The residual export is not zero and will not be zero. I traced
the largest single riser of one day, 0.45 Wh, to a heat pump starting, where phase power
showed one negative sample while current was *rising* and power factor collapsed. You cannot
regulate your way out of an inrush with a 250 ms loop.

**It costs something.** The import cushion is real energy bought to avoid exporting. For a
system whose hard rule is "do not export", that is a bargain. For anyone optimising a
feed-in tariff, it is the wrong trade.

## What I would tell someone attempting this

- **Measure the budget before optimising.** I nearly spent a week on transport latency worth
  8%, while a second meter I already owned was worth twice as much for an afternoon's work.
- **Find the asymmetry in your problem.** Export and import are not symmetric failures here,
  and once that is explicit, half the design decisions make themselves.
- **A guard comparing two sensors needs a quiescence gate, from both sensors.** Two
  production false trips in one week taught me that.
- **A watchdog cannot live inside the thing it watches.** If your most likely failure is "the
  host restarted", your watchdog must not be on the host.
- **Instrument what proves work is happening,** not what reports health. Health said
  `running` while nothing was regulated for the entire duration of a dead link.
- **Check what your safety net depends on before you cut a wire.** My fallback was a comment
  describing a mechanism I had personally disabled a week earlier.
- **Never blind-probe unknown commands.** One blind probe on this hardware reset a safety
  power limit to zero.

## The two reusable pieces

Most of this is specific: one inverter family, one meter model, one regulated phase, and
thresholds calibrated to my roof. Two parts are not.

The **dead-man script** is generic. Any setup where a local controller owns a device setpoint
and a vendor cloud is the fallback has this exact problem, and the pattern of a RAM-only
heartbeat endpoint on a third device, with every uncertain state resolving to the fallback,
transfers directly.

The **interleave** idea transfers too. If you have two independent sensors sampling the same
quantity at the same rate, check whether their update instants are offset. If they are, you
have a faster sensor than either of them, for free.

{{< alert "triangle-exclamation" >}}
**If you are considering this.** It writes to a live battery inverter's control setpoint, on
my own hardware, down a deliberately narrow path: cushion only in the safe direction, size
capped in code, no write on a stale reading or a silent link, and a fallback that engages by
itself. Do not probe unknown commands to see what happens. And if you are somewhere export
is regulated, the correct configuration is the one your grid operator agreed to, not the one
you can reach over Bluetooth.
{{< /alert >}}

More on this system: [the parallel battery imbalance](/posts/ecoflow-parallel-battery-imbalance/)
and [the 19% charge day](/posts/ecoflow-expandable-battery-broken-promise/).
