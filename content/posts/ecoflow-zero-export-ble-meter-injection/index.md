---
title: "My Solar Inverter Was Taking Orders from Two Clouds. I Cut Them Out."
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
summary: "My meter and my inverter sit three metres apart, and they were exchanging one number via two different clouds. I took over that conversation with Bluetooth. Then I measured properly and found the real bottleneck was somewhere I had not even looked."
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

## Not Exporting Is the Whole Job

I have no grid-tie agreement, so I am not allowed to push energy back into the grid. Not "would rather not". Not allowed. Every watt my panels make has to be used or stored on my side of the meter. (More on the legal side in [Balcony Solar in Greece](/posts/balcony-solar-greece-legal/).)

My EcoFlow Stream Ultra handles this well enough. It reads a Shelly energy meter, sees whether I am importing or exporting, and trims its output to hold that number at zero.

One question started all of this: **how old is the number it is steering on?**

## Old Enough to Have Been Abroad

The meter is on my network. The inverter is on my network. They are three metres apart in the same electrical panel.

They do not talk to each other.

{{< mermaid >}}
flowchart LR
    S["Shelly meter<br/>my panel"] --> SC["Shelly Cloud"]
    SC --> EC["EcoFlow Cloud"]
    EC --> U["Stream Ultra<br/>my panel"]
    S -.->|"3 metres"| U

    style SC fill:#854d0e,stroke:#eab308,color:#fff
    style EC fill:#854d0e,stroke:#eab308,color:#fff
{{< /mermaid >}}

I measured the round trip: **2 to 3.5 seconds**. Two devices in the same box, sending one number to each other through the internet.

The obvious fix is to point the inverter at the local meter. So I went looking for that setting, and it does not exist. I read through the inverter's entire internal message format looking for anywhere an address, a hostname, or a port could be stored for a meter. There is nothing. The firmware has no way to *name* a device on my network, so there is no toggle to find and no clever DNS trick to play.

Which left one option: if I cannot redirect the conversation, I can join it.

## Joining the Conversation

Buried in the inverter's writable settings is the field the cloud uses to deliver the meter reading. It is writable by **anything that can reach the device**, and the device speaks Bluetooth. Home Assistant already keeps an authenticated Bluetooth session open to it.

So: read the meter locally, then write that number straight into the inverter over Bluetooth, faster than the cloud can overwrite it.

The first test wrote the *exact same value* the meter already reported, so nothing should change. Nothing did. The inverter accepted it without complaint. The cloud quietly overwrote it a couple of seconds later.

I was in.

## But Was Anyone Listening?

Accepting a number is not the same as acting on it, and my first attempt to prove it was junk.

I told the inverter it was exporting 800W when it was not. One second later it echoed 800 back at me, which looked like proof. It was not. That field just **mirrors whatever I put in**, and at that exact moment the meter happened to record a real 800W spike from a household load. I had built a test where the answer was a reflection of my own question, and a coincidence made it look meaningful.

So I redesigned it. Eight paired trials, alternating between a lie and the truth, with identical Bluetooth traffic either way. Then I judged the result only from things the inverter cannot fake: the independent meter, and the battery.

| | Lie | Truth | Difference |
|---|---|---|---|
| Grid | **+933W** | +29W | **+903W** |
| Battery | **+556W** | +15W | +540W |

Every lie moved the inverter by 500 to 660W. Not one truthful trial came close to the weakest lie. No overlap at all.

I was driving.

{{< alert "circle-info" >}}
**The reason my earlier attempts found nothing.** The inverter's output target was set to zero. Telling a switched-off inverter "stop exporting" asks it to go below zero, so it was never going to react, whatever I sent. Also: I only ever lie in the *safe* direction. Telling it "you are importing" makes it back off. Telling it "you are exporting" makes it ramp up, which would create the very export I am trying to prevent.
{{< /alert >}}

## Then I Measured Properly, and Felt Silly

At this point I had a story I liked: the cloud takes 2.5 seconds, my Bluetooth path takes 130 milliseconds, so I win by about two seconds.

Before optimising anything, I characterised the whole chain. I polled both of my meters 20 times a second for 40 seconds, 730 samples.

| What I found | |
|---|---|
| How often the meter's reading actually **changes** | **once per second** |
| Gap between my two meters' updates | **0.41 seconds** |
| How closely the two meters agree | within **0.3%** |

The meter averages internally and publishes once a second. You can ask it 20 times a second and 19 of those answers are a number you already had.

So of the roughly 1.1 seconds between reality and my write, about **one full second belongs to the meter**, and I cannot touch it. Every clever thing I could do competes for the remaining 120 milliseconds.

That is the part I would keep if I forgot the rest of this post. I had been quietly annoyed for weeks that there is no Ethernet run to my electrical panel, so the meters are on WiFi. That penalty turns out to be worth under 2% of the total. I was ready to argue about the wrong number entirely.

## Squeezing the 120ms I Could Actually Reach

Three changes, in ascending order of how much I liked finding them.

**The meter has a faster door.** Instead of the usual web request, Shelly meters speak Modbus, an industrial protocol. Same reading, **15 milliseconds instead of 79**. (For anyone searching for this later: read *input* registers, phase C power lives at register 1064, and the number arrives with its two halves swapped, which cost me an afternoon.)

**My loop was slower than I had configured it.** It waited a fixed pause *after* finishing each cycle, so the real interval was the pause plus the work. I set it to twice a second and measured 1.5. Now it works out when the next cycle is *due* and waits until then, which absorbs the work instead of adding to it. Measured after the fix: 1.99 per second.

**Two meters are better than one.** This one came straight out of the measurement. Both of my meters publish once a second, and they publish **0.41 seconds apart**. So I read both and use whichever spoke most recently, which nearly halves the effective delay for free. I tested it read-only first: over 20 cycles, the second meter was the fresher one 11 times, worth an average of **489 milliseconds**.

Combined, the age of the number I am feeding the inverter went from **481 milliseconds to about 145**. I had predicted it would roughly halve. It did better than that, because the fixes compound.

Two meters watching the same wire is also free insurance. If one stops answering, regulation carries on with the other instead of stalling.

Of course, trusting a second meter needs a way to stop trusting it. If someone re-cables the panel, "whichever spoke last" quietly becomes "sometimes the wrong circuit". So it watches for the two meters disagreeing, and if they do it switches itself off permanently until I look at it. Crucially it judges the **average** disagreement, not a single reading, because the 0.41 second offset means they legitimately disagree during any sudden change. Real data made that point for me: three minutes after going live I logged a 195W instantaneous gap on perfectly healthy hardware. A naive check would have shut the whole feature down immediately.

## Sitting Deliberately on the Safe Side

Since the point of this is compliance and not squeezing out the last cent, I want to sit slightly on the **importing** side of zero. Paying for a little margin is fine. Exporting is not.

The trick is pleasingly simple. The inverter drives what it *sees* to zero. So if I show it a number 150W lower than reality, reality settles 150W on the safe side. It works out to about **115W of deliberate import**.

I had built this months ago. It barely ever ran, and when I finally looked at the counters I found out why: I had told it to apply the margin "only while the battery is discharging". But during a sunny afternoon the battery is **charging**. The safety margin was switched off during exactly the conditions it existed for.

Fixed, and confirmed the same morning as the sun came up. Not a magnitude problem, a logic problem. I could have tripled the margin and changed nothing.

## Three Ways It Lied to Me

Worth knowing if you ever build something that writes to real hardware:

- **"Connected" is not the same as "listening".** The Bluetooth link can report a healthy connection while separately logging that the device stopped answering pings 90 seconds ago. For a minute and a half, every write reports success and nothing arrives. Now it checks when the device last *said something*, not whether a socket is open.
- **The object can die under you.** When the Bluetooth link drops and reconnects, the software builds a brand new device object. Anything I saved a reference to at startup still looks perfectly healthy and is permanently dead.
- **Log what you sent, not what you meant.** My favourite. The margin was applied correctly to the outgoing number, but the log recorded the number from *before* the margin. Everything was working and the logs said it was failing badly. I spent real time debugging a healthy system.

Since I could not safely iterate on a live battery inverter, the whole thing runs against fakes in a test suite: a pretend meter and a pretend inverter, 143 checks. That harness immediately caught a bug that would have looked like a **triumph** in production. My two-meter code was accidentally reading the same meter twice, and the logs would have proudly reported the second meter winning every single cycle while the redundancy did not exist at all.

## What It Adds Up To

| | Before | After |
|---|---|---|
| Age of the data the inverter steers on | ~2.5s | ~0.3s |
| Updates reaching the inverter | ~0.4/s | ~2/s |
| Who controls the setpoint | the cloud | me |
| Time spent on the safe side of zero | ~50% | 100% |
| Resting position | around 0W | **115W importing** |

That last row is the real prize. I stopped hunting back and forth across zero and now sit deliberately, measurably, on the side that cannot get me in trouble.

## What Did Not Improve

The part that makes the rest worth believing.

**Accuracy is unchanged.** I ran alternating blocks of my version and the stock cloud version, scored from the independent meter: average error 27.5W mine, 25.6W theirs. That is a rounding error, and if anything it is a hair worse.

That is not a contradiction. The stock loop was *already* holding the line to within about 30W on two-and-a-half-second-old data. There was almost no error left for speed to remove. What I gained was **control and margin**, not precision. Worth being clear about, because "9x faster" reads like it should have made the line straighter, and it did not.

**The one-second meter averaging is untouched**, and it is now most of what remains. Short of a meter that publishes faster, that is the floor.

**And the number that actually matters is not in yet.** The honest measure is how many watt-hours I export per day, and my baseline for the previous nine days averaged about 44 Wh. Everything above went live this morning. Until I have a week of daily totals to compare, the export improvement is a well-instrumented hypothesis, not a result, and I am not going to dress it up as one.

**It costs something, too.** That 115W cushion is roughly 0.9 kWh a day if the house sits there for eight hours. For a system whose hard rule is "do not export", that is a bargain. If you are optimising a feed-in tariff, it is exactly the wrong trade.

## The Takeaway

1. **Measure before you optimise.** I nearly spent a weekend on a WiFi problem worth 2% of the delay, while the meter's own averaging quietly owned 89% of it.
2. **If your test can be answered by an echo of your own question, it proves nothing.** My first "proof" was a coincidence, and building on it would have wasted weeks.
3. **Check that things are listening, not just connected.** Anything that reports success while going nowhere is far worse than something that fails loudly, especially when the consequences pile up in the physical world.

{{< alert "triangle-exclamation" >}}
**If you are thinking of trying this.** This writes to a live battery inverter's control setpoint, on my own hardware, down a deliberately narrow path: lie only in the safe direction, cap how big the lie can be, refuse to write on a stale reading or a silent link. Do not go poking at unknown commands to see what happens. I learned that one the hard way on this hardware: a single blind probe reset a safety power limit to zero. And if you are somewhere export is regulated, the correct setup is the one your grid operator signed off on, not the one you can reach over Bluetooth.
{{< /alert >}}

More on this system: [the parallel battery imbalance](/posts/ecoflow-parallel-battery-imbalance/) that got me curious about what these devices report internally, and [the 19% charge day](/posts/ecoflow-expandable-battery-broken-promise/) that came out of it.
