# EcoFlow Social Media Posts — Ready to Copy-Paste

---

## 1. Reddit — r/EcoFlow
**URL:** https://www.reddit.com/r/EcoFlow/submit

**Title:** EcoFlow sells "expandable" battery bundles that can't charge from solar. I have 4 months of proof.

**Body:**

EcoFlow sells the Stream Ultra + AC Pro as a bundle on their website for €2,100. They market it as 3.84 kWh of "expandable" storage with "surplus solar energy automatically transferring between batteries."

I bought it. I monitored every watt for 4 months. Here's what "automatically transfers" looks like on a perfect sunny day:

- **12 kWh** of solar produced
- **Main battery:** 10% → 99.8%
- **€620 expansion battery:** 10% → 19.3%
- **Solar energy that reached the expansion battery:** 1.3%

When the main battery hit 100%, the system **shut down all four solar panels** rather than charge the expansion battery sitting at 18%.

I reported this to EcoFlow with full monitoring data. Their R&D team confirmed it's a hardware limitation — the 1200W inverter is shared between powering your home and charging expansion batteries. Their official suggestion:

> **"Remove or reduce the load."**

Turn off your home so your solar battery system can work. That's the fix.

I then requested a simple exchange — same capacity, single unit, no bottleneck. After multiple follow-ups: no resolution offered, no escalation, no acknowledgment that there's a problem with selling "expandable" storage that can't expand.

**The scaling math is brutal:**

| Batteries | You Pay | Storage That Charges From Solar | Money on Batteries That Don't |
|---|---|---|---|
| 1 Ultra + 1 AC Pro | €2,100 | 1.92 kWh | €620 |
| 1 Ultra + 2 AC Pro | €2,720 | 1.92 kWh | €1,240 |
| 1 Ultra + 5 AC Pro | €4,580 | 1.92 kWh | €3,100 |

Full interactive charts with downloadable raw data (Prometheus, 1-minute resolution — verify everything yourself): https://www.mastori.dev/posts/ecoflow-expandable-battery-lie/

**If you already own this setup:** check your data. If you're considering buying: check the data first.

**If you work at EcoFlow:** your customers are watching. Case CAS-20260331-1676192.

---

## 2. Reddit — r/solar
**URL:** https://www.reddit.com/r/solar/submit

**Title:** PSA: Before buying "expandable" battery storage, ask one question — I learned the €620 way

**Body:**

The question: **"Does the expansion battery charge through the inverter, or directly from DC?"**

If the answer is "through the inverter" — you're buying storage you probably can't use.

I own an EcoFlow Stream Ultra + AC Pro. The expansion battery connects via AC coupling through a shared 1200W inverter. That inverter also powers your home. Under any normal household load, it's fully consumed. The expansion battery gets nothing.

EcoFlow markets this system as "expandable to 23 kWh" and "surplus solar energy automatically transfers between batteries." I monitored mine for 4 months with Home Assistant + Prometheus. On a 12 kWh production day:

- Main battery: charged to 99.8%
- Expansion battery (€620): charged to 19.3%
- System response when main battery full: **shut down solar panels** while expansion sat empty

EcoFlow's R&D confirmed it in writing. Their fix: "remove or reduce the load."

The alternative architecture is **DC-coupled expansion** — batteries connect directly to the charge controller, bypassing the inverter entirely. Anker SOLIX (Solarbank 2), Zendure (SolarFlow), and Marstek (Jupiter) use this approach. I haven't tested them, but the architecture doesn't have this bottleneck by design.

Full analysis with interactive data: https://www.mastori.dev/posts/ecoflow-expandable-battery-lie/

I wrote this because I couldn't find this information anywhere before buying. Hopefully someone else does.

---

## 3. Reddit — r/homeassistant
**URL:** https://www.reddit.com/r/homeassistant/submit

**Title:** How I caught EcoFlow's expansion battery doing nothing — HA + Prometheus monitoring setup and what the data revealed

**Body:**

Sometimes the best thing Home Assistant does is show you what you didn't want to see.

I set up detailed monitoring of my EcoFlow Stream Ultra + AC Pro system and discovered the expansion battery barely charges from solar under normal conditions. The 1200W inverter shared between home load and expansion charging is the bottleneck — and EcoFlow doesn't disclose it.

**The monitoring stack:**

- HA with EcoFlow Cloud + BLE integrations
- Prometheus integration (1-min scrape)
- Grafana for daily monitoring
- Chart.js standalone page for public sharing

**Key entities if you want to check your own system:**

```
sensor.stream_ultra_akis_power_battery_soc   # Main battery SoC
sensor.stream_ac_pro_power_battery_soc       # Expansion SoC — watch this one
sensor.stream_ultra_akis_power_ac_sys        # Inverter output (the bottleneck)
sensor.stream_ultra_akis_in_power            # What charges the main battery
sensor.stream_ac_pro_in_power                # What charges expansion — spoiler: almost nothing
```

**The result:** On a 12 kWh day, main battery hit 99.8%, expansion hit 19.3%. EcoFlow confirmed it's by design.

Full write-up with interactive charts and downloadable Prometheus data: https://www.mastori.dev/posts/ecoflow-expandable-battery-lie/

If you have an EcoFlow multi-battery setup, run the comparison yourself. I'd love to see if anyone gets different results.

---

## 4. Facebook (Solar groups)
**Post directly — no title needed:**

EcoFlow sells the Stream Ultra + AC Pro as a €2,100 bundle. "3.84 kWh expandable storage." "Surplus solar automatically transfers between batteries."

I bought it. Here's what 4 months of monitoring data shows:

Main battery on a sunny day: 10% → 99.8%
Expansion battery (€620): 10% → 19.3%

When the main battery was full, the system shut down my solar panels. The expansion battery was at 18%, empty and ready. The system's answer was to waste the solar energy instead.

I reported it with full data. EcoFlow's R&D confirmed it's a design limitation. Their fix: "disconnect your appliances while the battery charges."

They sell "expandable to 6 batteries." The math:
- 6 batteries = €4,580
- Batteries that actually charge from solar: 1
- Money spent on batteries that don't: €3,100

Before buying any "expandable" battery system, ask: does the expansion charge through the inverter (AC-coupled) or directly (DC-coupled)? If it's through the inverter — this is what you get.

Full data, interactive charts, EcoFlow's own written confirmation:
https://www.mastori.dev/posts/ecoflow-expandable-battery-lie/

---

## 5. LinkedIn
**Post directly:**

A €2,100 product that works as advertised 50% of the time.

EcoFlow markets the Stream battery series as "expandable to 6 batteries" with "surplus solar energy automatically transferring between batteries." They sell bundled configurations with expansion units included.

I purchased one, deployed professional-grade monitoring (Home Assistant, Prometheus, 1-minute telemetry), and tracked the system for months. The finding: expansion batteries cannot charge from solar under normal household conditions due to a shared 1200W inverter bottleneck. On a 12 kWh production day, the expansion battery received 1.3% of available solar energy.

EcoFlow's R&D team confirmed this is a hardware limitation. Their recommended workaround: "remove or reduce the load." Their resolution after multiple escalations: none.

This is an interesting case study in the gap between product marketing and product architecture. The storage capacity exists (kWh). The ability to charge that capacity from solar under real-world conditions does not (kW). The marketing says "automatically transfers." The physics disagree.

Competitors using DC-coupled expansion (Anker SOLIX, Zendure, Marstek) avoid this by connecting batteries directly to the charge controller. The architectural difference is fundamental, and it's not something firmware can fix.

Full interactive data: https://www.mastori.dev/posts/ecoflow-expandable-battery-lie/

For anyone in product management or energy storage: this is what happens when expansion architecture is an afterthought. The single-unit product is excellent. The expansion story is not.

#solar #energystorage #productmanagement #consumerrights #ecoflow

---

## 6. Trustpilot
**URL:** https://www.trustpilot.com/review/ecoflow.com (click "Write a review")

**Rating:** 1 star

**Title:** €620 expansion battery that charged to 19% on a perfect sunny day

**Body:**

I purchased the Stream Ultra + AC Pro bundle based on EcoFlow's marketing: "expandable storage" with "surplus solar energy automatically transferring between batteries."

After 4 months of monitoring with professional telemetry (Home Assistant, Prometheus, 1-minute resolution), the data is conclusive: the expansion battery cannot charge from solar under normal household conditions.

On a perfect 12 kWh sunny day: main battery reached 99.8%. Expansion battery reached 19.3%. When the main battery was full, the system shut down all four solar panels rather than charge the empty expansion battery.

EcoFlow's R&D team confirmed in writing that this is a hardware limitation — the 1200W inverter is shared between home load and expansion charging. Their recommended solution: "remove or reduce the load."

I requested a reasonable exchange — a single-unit Stream Ultra X with equivalent capacity, eliminating the bottleneck. After multiple escalations over weeks: no resolution offered.

The standalone Stream Ultra is a capable product. But selling "expandable" bundles with expansion batteries that can't charge under normal use is misleading. The marketing says "automatically transfers." Four months of data says it doesn't.

Full data: https://www.mastori.dev/posts/ecoflow-expandable-battery-lie/

---

## 7. EcoFlow Community Forum
**URL:** https://community.ecoflow.com/ (post in Stream section)

**Title:** 4 months of monitoring data: Stream Ultra + AC Pro expansion battery receives 1.3% of solar energy under normal load

**Body:**

Sharing detailed monitoring data from my Stream Ultra + AC Pro system. This isn't a complaint — it's a dataset. Draw your own conclusions.

**Setup:** Stream Ultra, 4×520W bifacial panels, Stream AC Pro via parallel cable, Shelly Pro 3EM grid meter. Monitored with Home Assistant + Prometheus at 1-minute resolution.

**Finding:** Under normal household load (~350-500W baseline), the Ultra's 1200W inverter is fully allocated to home power. The AC Pro receives effectively 0W from solar during peak production hours.

**April 7 data (clear sky, 12 kWh produced):**
- Ultra SoC: 10% → 99.8%
- AC Pro SoC: 10% → 19.3%
- AC Pro received: 0.16 kWh out of 12 kWh (1.3%)
- PV curtailed when Ultra full: ~1 kWh (panels shut down while AC Pro sat at 18%)

**EcoFlow support has confirmed** this is a limitation of the shared 1200W inverter architecture. Case CAS-20260331-1676192.

Full interactive dataset: https://www.mastori.dev/posts/ecoflow-expandable-battery-lie/
Raw data (JSON, downloadable): https://www.mastori.dev/ecoflow-data/april-2026-data.json

**Questions:**
1. Can anyone with a multi-battery Stream setup share their SoC comparison data?
2. Is there a firmware roadmap that addresses priority charging for expansion units?
3. Has anyone achieved balanced charging under normal household load?

I'd like to understand if this is consistent across all systems or if there's a configuration I'm missing.

---

## 8. Final email to EcoFlow (send LAST, after all posts are live)

**Subject:** Re: Formal Escalation — Published

As outlined in my previous correspondence, the technical analysis has been published:

https://www.mastori.dev/posts/ecoflow-expandable-battery-lie/

I remain open to resolving this with the Stream Ultra X exchange.

Best Regards,
Akis Maziotis
</content>
</invoke>