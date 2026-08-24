---
title: "Winning the Zero-Export Race: Feeding My EcoFlow Stream Ultra Its Own Meter Readings over BLE"
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
tags: ["ecoflow", "solar", "zero-export", "home-assistant", "ble", "modbus", "shelly", "reverse-engineering", "stream-ultra", "python"]
summary: "My inverter's zero-export loop was steering on meter data that had travelled through two clouds. I found the writable protobuf field, proved I could take the wheel over Bluetooth, then measured the latency budget and discovered the meter itself owns 1000 of the 1120 milliseconds. Here is the whole chase, including the parts that did not pay off."
keywords: [
  "ecoflow stream ultra zero export",
  "ecoflow zero feed in latency",
  "ecoflow cloud meter",
  "cfg_cloud_metter",
  "ecoflow ble protobuf",
  "shelly pro 3em modbus tcp registers",
  "shelly pro 3em 1 hz update rate",
  "shelly pro 3em modbus register 1064",
  "zero export regulation greece",
  "home assistant ecoflow ble injection",
  "ecoflow stream ultra home assistant",
  "zero feed in accuracy",
  "shelly em modbus float low word first"
]
---

## Zero Export Is Not a Preference Here

In my setup, feeding energy back into the grid is not a thing I would rather avoid. It is a thing I must not do. There is no grid-tie agreement, so every watt my panels produce has to be consumed or stored on my side of the meter. I wrote about the legal side of this in [Balcony Solar in Greece](/posts/balcony-solar-greece-legal/) and about the load-side half of the problem in [PV Surplus EV Charging](/posts/pv-surplus-ev-charging/).

The EcoFlow Stream Ultra does have a zero-feed-in mode, and it works. It reads a Shelly Pro 3EM, sees how much I am importing or exporting on phase C, and adjusts inverter output to hold that number at zero.

The question that started this whole thing was simple: how *old* is the number the inverter is steering on?

## The Answer: Old Enough to Go Through Two Clouds

The Shelly is on my LAN. The Ultra is on my LAN. They do not talk to each other.

{{< mermaid >}}
flowchart LR
    S["Shelly Pro 3EM<br/>on my LAN"] -->|"HTTPS"| SC["Shelly Cloud"]
    SC -->|"partner API"| EC["EcoFlow Cloud"]
    EC -->|"MQTT"| M["mqtt-e.ecoflow.com"]
    M -->|"WiFi"| U["Stream Ultra<br/>on my LAN"]
    U -->|"regulates"| G["Phase C"]
    S -.->|"the two devices<br/>are 3 metres apart"| U

    style SC fill:#854d0e,stroke:#eab308,color:#fff
    style EC fill:#854d0e,stroke:#eab308,color:#fff
    style M fill:#854d0e,stroke:#eab308,color:#fff
{{< /mermaid >}}

Two devices in the same electrical panel, exchanging a single number via Athens, Frankfurt, or wherever those clouds actually live. I measured the round trip by correlating step changes between the local Shelly sensor and the value the Ultra reports back over Bluetooth: roughly **2 to 3.5 seconds**, end to end.

That is not catastrophic. It is also not something I wanted in the loop that keeps me legally compliant.

### There Is No LAN Mode, and It Is Not a Firmware Toggle

The obvious fix is to point the Ultra at the local Shelly. The device even hints at it: the telemetry it broadcasts over BLE contains a field called `use_lan_meter`, and mine reads `false`.

So I went looking for the switch. The Stream family speaks a protobuf schema internally (`bk_series`), and I dumped the whole thing looking for anywhere a hostname, an IP address, a port, or a URL could be stored for a meter.

There is nothing. Not one field. The firmware has no way to *address* a device on my network, which means:

- There is no `cfg_use_lan_meter` to flip. `use_lan_meter` is readable, not writable.
- DNS interception is pointless. You cannot redirect a request that is never made to a host you can name.

`use_lan_meter` is presumably for a first-party EcoFlow meter on a proprietary link, not for my Shelly. Dead end, and worth knowing it is a dead end rather than guessing.

## The Field That Was Actually Open

What I did find, in the writable `ConfigWrite` message, was field **383**: `cfg_cloud_metter` (their spelling), carrying the same `CloudMeter` structure that appears in the telemetry the device pushes out.

In other words: the cloud writes the meter reading into the device by writing that field, and the field is writable by anything that can talk to the device.

I can talk to the device. [ef_ble](https://github.com/rabits/ef_ble) already maintains an authenticated Bluetooth LE session to it from Home Assistant, and it exposes the send path that the integration itself uses for configuration writes.

So the plan wrote itself: read the Shelly locally, and write that number straight into `cfg_cloud_metter` over Bluetooth, faster than the cloud can overwrite it.

### The First Write

A zero-delta write, injecting exactly the value the meter already reported, so nothing about the device's behaviour should change:

```
fa1718080110031a0c<meter serial as ascii hex>200028003013
```

55 samples over 60 seconds. The meter identity stayed intact, `has_meter` stayed true, the phase C value kept moving (the cloud was still overwriting it every couple of seconds), and ef_ble logged no errors. The device accepts the write, and the cloud self-heals it within seconds.

That last part matters, and I will come back to it.

{{< alert >}}
**Safety invariant, learned the nervous way.** `CloudMeter` has six subfields: `has_meter`, `model`, `sn`, and the three phase powers. Always pin **all six** from live telemetry on every write. A partial block risks writing `has_meter: false`, and a device that thinks it has no meter has no reason to regulate at all.
{{< /alert >}}

## Proving I Was Actually Driving

Accepting a write is not the same as acting on it. I needed causation, and my first attempt at proving it was garbage.

### The Test That Fooled Me

I injected `phase_c_power = -800W` (telling the inverter it was exporting 800W) while the real meter was quiet. One second later the device echoed `-800`, and its own `pow_get_sys_grid` field read `-805`.

Case closed, surely.

It was not. At that exact moment the independent local Shelly recorded a **real** +779W load spike. The device then echoed `c=779` too. Which revealed the actual lesson:

> `pow_get_sys_grid` is not a measurement. It **mirrors** whatever is currently sitting in `cloud_metter`. It echoes my own input back at me.

I had built a test whose response channel was its own stimulus, and a coincidental load event made the timing look meaningful. The battery telemetry, which *would* have moved if an inverter had been told to stop exporting 800W, sat there charging at -290 to -330W throughout.

### The Test That Held Up

Redesigned as a **paired REAL/SHAM trial**, 8 trials, none discarded:

- **REAL arm:** inject `truth - 600W` for 4 seconds at 2 Hz.
- **SHAM arm:** inject the truth, identically, at the same rate. Same BLE traffic, same code path, no lie.
- **Judged only** from the independent Shelly and `pow_get_bp_cms` (battery power). Never from `pow_get_sys_grid`.

| Measure | REAL | SHAM | Difference |
|---|---|---|---|
| Grid, phase C | **+933W** | +29W | **+903W** |
| Battery power | **+556W** | +15W | **+540W** |
| Weakest / strongest | +635W | +40W | zero overlap |

Every REAL trial cut discharge by 500 to 660W. Not one SHAM trial came close to the weakest REAL trial. I am driving the regulation setpoint.

{{< alert "circle-info" >}}
**The precondition that made this testable at all.** Earlier attempts produced nothing, and it was not because the field does not work. `inverter_target_power` was 0. Telling a switched-off inverter "you are exporting, back off" asks it to go below zero, so a null result was guaranteed either way. Also: inject **negative** offsets only. A negative offset commands back-off, which at worst causes a brief import. A positive offset commands ramp-**up**, which manufactures real export, which is the exact thing I am trying to prevent.
{{< /alert >}}

## Then I Measured the Budget Before Optimising It

At this point I had control and I had an assumption: the cloud path is ~2.5s, my local path is ~130ms, therefore I win by roughly 2 seconds.

Before writing a single optimisation, I characterised the whole chain. Both Shelly Pro 3EMs (I have two, one clamped on the grid feed, one on the solar circuit), polled at **20 Hz for 40 seconds**, 730 paired samples.

The result reframed the entire project:

| Finding | Value |
|---|---|
| Rate at which each meter's phase C value actually **changes** | **1.00 Hz** (median gap 0.999s and 0.997s) |
| Offset between the two meters' update instants | **0.412s**, about 0.41 of a period |
| Agreement between the two meters on phase C | **2.3W**, or 0.29% of reading |

The Shelly Pro 3EM aggregates internally at 1 Hz. You can poll it at 20 Hz and 19 of every 20 answers are a value you already had.

So of the roughly 1120ms between reality and my injected write, about **1000ms belongs to the meter**, and none of that is reachable from my side. Transport choices, WiFi versus Ethernet, tighter loops: all of it competes for the remaining ~120ms.

This is the finding I would want if I read only one section of this post. Measure the budget before you optimise inside it. My instinct had the dominant term completely wrong, and the WiFi-versus-Ethernet debate I was having with myself (the panel has no Ethernet run, which bothered me) turned out to be worth 20 to 60ms of a 1120ms budget. Under 2%. It does not matter.

## Reading the Meter Faster Anyway

The remaining 120ms was still worth taking, and the Shelly's HTTP RPC endpoint is the slow way to ask.

Shelly gen-2 devices speak **Modbus TCP**, and the register map is not especially well documented, so here is what I mapped:

| What | Register | Notes |
|---|---|---|
| Function code | **FC4** (read input registers) | FC3 returns exception code 2. Only FC4 works. |
| Phase A block | 1020 | +0 voltage, +2 current, +4 active power |
| Phase B block | 1040 | phase blocks are 20 registers apart |
| Phase C block | 1060 | so **1064** is phase C active power |
| Total active power | 1013 | |
| Encoding | float32, **low word first** | not the usual big-endian float |

Two gotchas cost me time:

1. **Reading a large span in one request returns nothing at all.** No error, no partial read, just silence. Keep counts small and read what you need.
2. **Keep the socket persistent.** Connecting per read pushed p95 latency to ~97ms, which is worse than the HTTP call I was trying to replace. But if any protocol error occurs, *drop the socket*, because a desynced reply gets parsed as the answer to the next request. A wrong number in a zero-export loop is worse than no number.

Raw asyncio, no pymodbus, so the integration's `requirements` stays empty:

```python
req = struct.pack(">HHHBBHH", tid, 0, 6, MODBUS_UNIT, 4, reg, 2)
...
head = await reader.readexactly(9)
if head[7] & 0x80:          # exception response: len is 3, code is in head[8]
    raise ModbusError(head[8])
body = await reader.readexactly(4)
value = struct.unpack(">f", body[2:4] + body[0:2])[0]   # low word first
```

Measured on the Home Assistant host: HTTP RPC median **~79ms** (max 158), Modbus median **~15ms**.

Everything sits behind a touch file, `/config/ef_inject_modbus`, re-read every cycle, so I can flip transports or roll back without a restart. On a Modbus failure it falls back to HTTP **for that cycle** rather than skipping the cycle. A skipped cycle leaves the last injected value riding, and during a fading surplus that stale value is precisely what leaks export.

## Three Fixes That Moved the Number

### 1. The Loop Was Not Running at the Rate I Configured

The pacing was `sleep(period)` after the cycle's work. So the real period was `period + meter read + BLE write`. Configured for 2 Hz, measured live at **1.52 sends/s**.

Deadline-based pacing instead: compute when the next cycle is *due* and wait until then, so the cycle's own work is absorbed rather than added.

```python
now = time.time()
self._deadline = max(now, self._deadline + POLL_PERIOD_SEC)
if self._deadline - now > POLL_PERIOD_SEC:      # never wait more than one period
    self._deadline = now + POLL_PERIOD_SEC
wait = self._deadline - now
```

That clamp is the important half. Without it, a loop that fell 30 seconds behind would try to repay the arrears as 120 back-to-back cycles. Bursting BLE writes at a battery inverter is not a thing I want an off-by-one to be able to do. It resyncs to now instead.

Result after deploying: **1.99 polls/s** against a configured 2 Hz.

### 2. Polling and Writing Do Not Need the Same Clock

Detection latency and write rate were the same knob, so tightening one meant hammering the other. I split them:

- Poll every **250ms**.
- Write only when the reading actually **moved** (threshold 0.5W), when a **500ms keepalive** falls due, or when a cloud overwrite is pending.

Detection delay drops from ~310ms to ~125ms while the write rate stays at the already-proven ~2/s. The keepalive still fires on a steady reading, which matters because the field must stay contested (see below).

The gate sits **after** every safety check, never before. A skipped write must not be able to skip a gate.

### 3. Two Meters, Publishing 0.412s Apart

This is the one that came from the measurement. My two 3EMs each publish at 1 Hz, they agree to 0.29%, and their update instants are offset by 0.412s. Read both, use whichever published most recently, and the *effective* sample interval halves.

Validated on real hardware before enabling it, read-only, over 20 paired cycles: the second meter was the fresher publisher on **11 of 20** cycles, with an average freshness gain of **489ms**. Agreement over the same window: mean +0.5W, worst transient 17.4W.

Two meters measuring what should be the same conductor is also free redundancy. If one stops answering, regulation continues on the other instead of stalling.

### The Guard on the Interleave

Trusting a second meter needs a way to stop trusting it. If a clamp gets moved, or someone re-cables the panel, "whichever published last" silently becomes "sometimes the wrong circuit".

The guard judges a **rolling mean over 40 samples**, never a single sample, and tripping **latches the feature off** for the rest of the session. Agreement returning does not silently re-enable it.

Judging a mean rather than an instant is not defensive over-engineering, it is forced by the physics. The 0.412s offset means that during any step change one meter has the new value and the other still has the old one, so instantaneous differences are *legitimately* large. Real production data settled it: within three minutes of going live I logged a **195W** instantaneous difference on genuinely healthy hardware. A 100W instant threshold would have false-tripped almost immediately.

## The Import Cushion, and the Gate That Was Backwards

Since the point of the exercise is compliance and not saving the last cent, I want to sit slightly on the *import* side of zero. Paying for a small margin is fine. Exporting is not.

The mechanism is pleasingly direct. The regulator drives what it **sees** to zero, and it sees `truth + bias`. So the real grid position settles at `-bias`. Gain is 1:1, confirmed empirically: a -30W bias moved the local mean from +25.6W to about +29W, and moved time-spent-importing from roughly 50% (hunting back and forth across zero) to 72 to 88%.

Then I found the real bug, and it was not the magnitude.

The cushion was gated on "only apply this while the battery is discharging". But during a PV surplus the battery **charges**. The cushion was disarmed during exactly the window it existed to protect. The counters said it plainly: `biased=232` against `bias_idle=2709`. I could have tripled the bias value and changed nothing.

Replaced with a continuous linear fade, gated on the local grid reading instead of the battery: full cushion at 0W and below, tapering to zero at 500W of import. The fade is continuous on purpose. A hard threshold steps the injected value, and the regulator hunts across the step.

With a -150W bias fading out at 500W, the real grid settles at `-bias * F / (F - bias)`, which is **+115W import**.

Confirmed in production the same morning, as the grid crossed the fade edge:

| True grid reading | Applied bias | Formula check |
|---|---|---|
| 360W | -42W | (500-360)/500 × -150 = -42.0 |
| 326W | -52W | (500-326)/500 × -150 = -52.2 |
| 315W | -55W | (500-315)/500 × -150 = -55.5 |

And `biased` climbed from 0 to 218 to 398 while `bias_idle` stayed frozen at 1462. The old gate would have slept through all of it.

Hard guard in code: the process refuses to start if the bias is positive or if its magnitude exceeds 200W. A positive bias tells the inverter it is importing when it is not, which commands ramp-up, which manufactures the exact export I am trying to prevent. That is not a knob I want to be able to turn the wrong way at 6am.

## Failure Modes That Report Success

Three of these, and they are the parts I would most want to hand to someone building anything similar.

### `is_connected` is necessary but not sufficient

The BLE library reports the link as connected based on the transport being open. But it can separately log `Ping response not received after 90.0 seconds`. For up to 90 seconds, every write returns success while nothing reaches the device.

In a zero-export loop that is a silent failure with a real-world consequence: the last value the device received keeps riding, the sun keeps rising, and the regulator holds a setpoint for conditions that no longer exist.

Telemetry frame age is the honest liveness signal. If the device has not pushed a frame in 8 seconds, refuse to write and count it separately (`skipped_silent`) so it shows up as its own number and not as a generic error.

### Never cache the device object

When the BLE link drops, the integration reloads its config entry, and the reload constructs a **brand new** device object. Any reference cached at startup is now a perfectly healthy-looking object that is permanently dead. Re-resolve from `entry.runtime_data` on every single send.

### Log the value you actually sent

My favourite bug of the whole project. `last_sent_w` was assigned from the unbiased reading, while the biased value was the one serialised onto the wire.

The bias was always correct on the wire. But the log printed the wrong `c=` value, and the echo classifier (which decides "was that telemetry frame my write or the cloud's?") was comparing against values that were never sent. Ours-share collapsed to 9 to 18% and it looked exactly like a control failure.

Log the bytes you serialised, not the input you serialised them from.

## The Cloud Keeps Overwriting, and That Is Fine

EcoFlow's cloud writes `cfg_cloud_metter` over the device's own MQTT session. That traffic never transits Home Assistant, so there is no software hook to suppress it. The router could block it, but that channel also carries the app, firmware updates, and region configuration, so blocking it is a bad trade.

So I do not fight it, I out-pace it. An echo classifier tags every incoming telemetry frame as mine or the cloud's, and a cloud-authored value wakes the send loop **immediately** instead of waiting out the period. Floored at 150ms, so a cloud burst can never turn into a BLE burst.

Steady state: I own the field about **99%** of the time.

One honest caveat on the reported ~490ms "cloud exposure" figure: it includes *detection* delay, because I only learn of a cloud write on the next telemetry frame, roughly 1 Hz. The correction itself is one BLE round trip, about 130ms.

There is a cleaner fix I have not tried: unlink the Shelly from the EcoFlow account entirely, so the cloud has no meter to push and the field is mine alone. The risk is that the device sets `has_meter: false` and stops regulating altogether, so that is a daylight experiment with eyes on the inverter, not a Friday-night one.

## Testing Something You Cannot Safely Break

This is the part I usually skip in hobby projects, and here I could not.

The thing under test writes to a battery inverter's safety-adjacent regulation setpoint. I am not iterating on that live. So the test suite runs the **real** loop against fakes: a fake Modbus server (low-word-first floats, FC3 exception behaviour, plus modes for wrong transaction IDs, short counts, dropped connections and garbage replies), a fake BLE device that records what was sent and when, and a fake protobuf module so the real lazy import resolves.

**143 checks** across four files. The pacing and write-gate tests drive the actual `run()` loop, deliberately, because a test that re-implements the gate predicate will happily pass while the shipped predicate is wrong.

Then the harness earned its existence. A test asserted that the interleave was picking the second meter for **100% of reads**, which is too good, because the meters are only 0.412s apart and should alternate.

The assertion was right and the code was wrong. `ModbusMeter` read the **module-global** port at connect time instead of a per-instance one. Both meter objects were pointing at the same socket. The second one always timestamped a hair later, so it always "won".

In production that bug would have looked like a spectacular success. The logs would have shown the interleave winning every cycle while it was reading one meter twice and the redundancy did not exist at all.

## What It Adds Up To

Against the stock cloud-only path:

| | Cloud only | With injection | Change |
|---|---|---|---|
| Data age at the regulator | ~2500ms | ~275ms | **~9x fresher** |
| Including the meter's own 1s averaging | ~3500ms | ~1275ms | 2.7x |
| Updates reaching the device | ~0.4/s | 1.95/s | ~5x |
| Who owns the field | cloud, 100% | me, 99% | control |
| Effective fresh publications | 1/s | ~2/s | 2x |
| Time spent on the import side of zero | ~50% | 100% | no hunting |
| Equilibrium grid position | ~0W | **+115W import** | deliberate margin |
| Control authority over the setpoint | none | proven (+903W) | the actual win |

Staleness of the injected value, measured live before and after the interleave went on: **481ms** down to **128 to 162ms**. The write mix flipped from roughly half change-triggered and half keepalive, to about 92% change-triggered, which is what you want: the device hears from me because something happened, not because a timer expired.

I will admit I got the size of this wrong in advance. I predicted the interleave would roughly halve staleness. It cut it by 3.3x, because the two changes compound: faster polling means more polls land on a genuinely new value, which means more change-triggered writes.

## What Did Not Improve

The section that makes the rest of the post worth trusting.

**Regulation tightness is unchanged.** I ran alternating 180-second injected and cloud blocks, scored from the independent local Shelly:

| | Injected | Cloud |
|---|---|---|
| Average absolute error | 27.5W | 25.6W |
| RMS | 50.2W | 48.0W |
| Excursions over 100W | 4.3% | 4.5% |

That is within noise, and confounded by an evening quieting trend on top. It is not a contradiction of the causation result. The loop was *already* holding phase C to a 25 to 35W average error on the cloud's 2.5-second data. There was almost no error left for lower latency to remove.

The value delivered here is **control and margin**, not accuracy. I can now decide where the equilibrium sits, and I can put a deliberate 115W import cushion under it. That is a compliance guarantee I did not have before. It is not a tighter loop.

**The 1000ms aggregation is untouched**, and it is 80% of the remaining budget. Short of a meter that publishes faster, that is the floor.

**The number that actually matters is not measured yet.** The honest KPI is exported energy per day, and my baseline over Aug 15 to 23 was 69.1, 31.4, 34.9, 38.5, 50.3, 41.8, 47.2, 19.5 and 60.0 Wh, averaging about 43.6 Wh/day. Everything above went live today. Until I have a week of daily totals against that baseline, the export claim is a hypothesis with good instrumentation behind it, and I am not going to write it up as a result.

**It costs something.** A 115W cushion, applied only below 500W of grid import, is about 0.9 kWh/day if the house parks there for eight hours. For a system whose non-negotiable constraint is "do not export", that is a bargain. For someone optimising a feed-in tariff, it is the wrong trade entirely.

## The Takeaway

Three things I would keep from this if I forgot everything else:

1. **Measure the budget before optimising inside it.** I was ready to argue about WiFi versus Ethernet over a term worth under 2% of the total, while the meter's own 1 Hz averaging quietly owned 89% of it.
2. **A test whose response channel echoes its stimulus proves nothing.** `pow_get_sys_grid` mirrors the value you inject. My first "proof" was a coincidence with a load spike, and if I had stopped there I would have built the rest of this on a false premise.
3. **Verify liveness, not connectedness.** Anything that reports success while going nowhere is worse than something that fails loudly, especially when the consequence accumulates in a physical system for 90 seconds.

And one that is specific to this hardware: the Stream Ultra's regulation setpoint is genuinely open to anything holding an authenticated BLE session. That is a capability, and it deserves the same caution as any other writable control on a device that moves kilowatts.

{{< alert "triangle-exclamation" >}}
**On doing this yourself.** This writes to a live battery inverter's regulation setpoint on my own hardware, and it is a controlled path: pin every subfield, negative bias only, magnitude capped, refuse to write on a stale reading or a silent link, and prove liveness rather than assuming it. Do not probe unknown command IDs to see what happens. I have already learned that lesson on this device family in a way I did not enjoy: one blind probe reset a safety power limit to zero. And if you are in a jurisdiction where export is regulated, the compliant configuration is the one your grid operator agreed to, not the one you can reach over Bluetooth.
{{< /alert >}}

Related reading on the same system: [the parallel battery imbalance](/posts/ecoflow-parallel-battery-imbalance/) that started my interest in what these devices report internally, and [the 19% charge day](/posts/ecoflow-expandable-battery-broken-promise/) that came out of it.
