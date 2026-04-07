---
title: "I Paid €620 for an EcoFlow Battery That Never Charges"
date: 2026-04-07
draft: true
tags: ["ecoflow", "solar", "battery", "stream-ultra", "stream-ac-pro", "hardware-limitation", "consumer-rights"]
summary: "EcoFlow sells 'expandable' battery systems. I bought the expansion. After weeks of monitoring every watt, here's the truth: it doesn't work, they know it, and they don't care."
keywords: ["ecoflow stream ultra battery imbalance", "ecoflow expandable lie", "ecoflow ac pro not charging", "ecoflow 1200W bottleneck", "ecoflow stream ultra review", "ecoflow stream ultra problems", "ecoflow alternative", "anker solix vs ecoflow", "zendure vs ecoflow"]
---

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.1.0/dist/chartjs-plugin-annotation.min.js"></script>

<style>
.chart-wrap { position:relative; background:var(--color-neutral-800,#1e293b); border-radius:12px; padding:16px; margin:24px 0; height:400px; cursor:pointer; transition:all 0.3s ease; }
.chart-wrap::after { content:'Click to expand'; position:absolute; top:8px; right:12px; font-size:0.7em; opacity:0.4; pointer-events:none; }
.chart-wrap canvas { max-height:100%; }
.chart-wrap.fullscreen { position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:9999; margin:0; border-radius:0; padding:24px; cursor:zoom-out; }
.chart-wrap.fullscreen::after { content:'Click to close'; opacity:0.6; }
.stat-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin:24px 0; }
.stat-card { background:var(--color-neutral-800,#1e293b); border-radius:12px; padding:16px; text-align:center; }
.stat-val { font-size:1.8em; font-weight:700; }
.stat-lbl { opacity:0.6; font-size:0.85em; margin-top:2px; }
.clr-green{color:#22c55e} .clr-red{color:#ef4444} .clr-yellow{color:#eab308} .clr-orange{color:#f97316}
</style>

If you're researching the EcoFlow Stream Ultra and considering adding expansion batteries — stop. Read this first. It could save you hundreds of euros and months of frustration.

I bought the Stream AC Pro expansion battery (€620) based on EcoFlow's promises. After weeks of monitoring every watt with professional-grade telemetry, I can tell you: **the expansion doesn't work under normal use, EcoFlow knows it, and they don't care.**

Everything below is backed by real data. No opinions, no guesswork — just measurements.

## What EcoFlow Promises

Their product page, right now, says:

> *"Expandable capacity from 3.84 to 23kWh"*

> *"Up to 6 devices per system"*

> *"Surplus solar energy automatically transfers between batteries"*

They sell the Stream Ultra bundled with AC Pro units. They show happy graphics of energy flowing between devices. They take your money.

## What Actually Happens

April 7, 2026. Clear sky over Athens. 12 kWh of solar energy produced. A textbook perfect day for a solar battery system.

<div class="stat-grid">
  <div class="stat-card"><div class="stat-val clr-yellow">12 kWh</div><div class="stat-lbl">Solar produced</div></div>
  <div class="stat-card"><div class="stat-val clr-green">99.8%</div><div class="stat-lbl">Main battery (Ultra)</div></div>
  <div class="stat-card"><div class="stat-val clr-red">19.3%</div><div class="stat-lbl">Expansion battery (AC Pro)</div></div>
  <div class="stat-card"><div class="stat-val clr-orange">€620</div><div class="stat-lbl">Wasted</div></div>
</div>

The main battery charged to full. The expansion battery — the one I paid €620 for — went from 10% to 19%.

**On a perfect sunny day, the expansion battery got 1.3% of the available solar energy.**

<div class="chart-wrap"><canvas id="chart1"></canvas></div>

This isn't a bad day. This isn't a misconfiguration. This is every single day. Both batteries start at the same level. One charges to 100%. The other flatlines. I've been watching this for weeks. The pattern never changes.

## The Hidden Bottleneck EcoFlow Doesn't Tell You About

Inside the Stream Ultra there's a 1200W inverter. It's the only path for solar energy to reach the expansion battery. But it's also the only path to power your home.

Your home comes first. The inverter spends its entire 1200W capacity on household load. Nothing is left for the expansion battery.

Think of it this way: you have two water tanks and one pipe. The pipe is already fully used watering your garden. The second tank? Bone dry. No matter how much rain falls on your roof.

<div class="chart-wrap"><canvas id="chart2"></canvas></div>

The panels produced nearly 2000W at peak. The inverter let through 1200W. The rest — **800W of perfectly good solar energy** — was thrown away. Not stored, not used, not exported. Wasted.

## The Expansion Battery Gets Nothing

<div class="chart-wrap"><canvas id="chart3"></canvas></div>

The inverter is entirely consumed powering the home. The main battery absorbs whatever trickle of surplus remains. The expansion battery? It received **0.16 kWh out of 12 kWh** produced. That's not a rounding error. That's a product that doesn't do what it's sold to do.

## It Gets Worse: The System Shuts Down Your Solar Panels

This is the part that made me write this post.

<div class="chart-wrap"><canvas id="chart4"></canvas></div>

When the main battery fills up and the inverter is maxed out, the system has nowhere to put the energy. So instead of charging the expansion battery that's sitting there at 18%, **it shuts down all four solar panels.**

Read that again. You paid for solar panels. You paid for an expansion battery. The panels are producing energy. The expansion battery is empty and ready. And the system's solution is to **turn everything off**.

This is not a bug. This is how EcoFlow designed it.

## "Expandable to 6 Batteries" — The Most Expensive Joke in Solar

EcoFlow proudly markets "expandable to 6 batteries" and "expandable to 23 kWh" for the Ultra X. Let me show you what you'd actually be buying:

| Setup | You Pay | Storage You Get | Storage That Actually Works | Money Thrown Away |
|---|---|---|---|---|
| 1 Ultra + 1 AC Pro | ~€2,100 | 3.84 kWh | 1.92 kWh | **€620** |
| 1 Ultra + 2 AC Pro | ~€2,720 | 5.76 kWh | 1.92 kWh | **€1,240** |
| 1 Ultra + 5 AC Pro | ~€4,580 | 11.52 kWh | 1.92 kWh | **€3,100** |

**With 6 batteries, 5 sit empty while the sun shines.** You've spent €3,100 on lithium that does nothing during peak solar hours. Congratulations — you've bought the world's most expensive paperweight collection.

And for the grand finale: the Stream Ultra X advertises **"expandable to 23 kWh."** That's 6 units at 3.84 kWh each, all dependent on one 1200W inverter. Even with **zero home consumption** (so, you've left for vacation), charging 5 empty batteries through that 1200W inverter takes over **18 hours**. That's longer than the longest summer solar day in Greece. You would need two consecutive perfect sunny days in an empty house just to fill the system once.

The "expandable to 23 kWh" claim is technically true in the same way a bicycle is "expandable to highway speed." The hardware allows it. The physics make it useless.

## EcoFlow Knows. They Don't Care.

I didn't write an angry tweet. I did the work. I collected weeks of data, built monitoring dashboards, documented every metric, and submitted a detailed technical report to EcoFlow EU Support with screenshots, graphs, and specific sensor readings.

Their R&D team eventually responded:

> *"The inverter limit of the Stream Ultra itself is only 1200W. The transfer of PV power between different devices must go through the inverter for conversion. The remaining solar energy can only be used to charge the Stream Ultra directly."*

**They confirmed it. In writing. It's a design limitation.**

And their suggested fix? I quote:

> **"Remove or reduce the load."**

Unplug your appliances so the battery can charge. Turn off your home so the solar system can work. That was their actual, official, R&D-approved answer.

I then requested a reasonable resolution — an exchange for a Stream Ultra X (same total capacity in a single unit, no bottleneck). Not a refund. Not a lawsuit. Just a product that works.

**Weeks of silence.** Then a generic reply restating the same technical explanation. No resolution offered. No escalation. No acknowledgment that selling "expandable" storage that can't actually expand might be a problem.

This is not a company that stands behind its products. This is a company that takes your money and reads from a script when you complain.

## What You Should Buy Instead

I'm not going to pretend I have all the answers, but I've done the research. Here's what separates working expansion from EcoFlow's broken architecture:

**The key term is DC-coupled expansion.** That means expansion batteries connect directly to the solar charge controller, not through the inverter. No bottleneck. All batteries charge equally.

Products worth investigating:

- **[Anker SOLIX](https://www.anker.com/solix)** — Their Solarbank 2 series uses DC-coupled battery expansion. Add batteries, they actually charge. Novel concept.
- **[Zendure](https://www.zendure.com/)** — SolarFlow Hub with direct DC battery expansion. Multiple batteries share the DC bus, not a single inverter bottleneck.
- **[Marstek](https://www.marstek.com/)** — Jupiter series with DC-coupled expansion packs. Same principle — batteries connect where the energy actually is.

The common thread: these companies understood that "expandable" means the expansion should work. EcoFlow, apparently, did not.

**Do your own research.** Read spec sheets. Ask specifically: *"When I add a second battery, does it charge through the inverter or directly from DC?"* If the answer is "through the inverter" — walk away.

## If You Already Own This System

You're not stuck. You have options:

1. **Monitor your data.** If you have Home Assistant, compare both battery SoC values during a sunny day with normal household load. The divergence is immediate and obvious.

2. **File a complaint with EcoFlow** referencing the 1200W inverter bottleneck. They've confirmed it in writing to me. They can't deny it to you.

3. **Exercise your EU consumer rights.** Under [EU Directive 2019/771](https://eur-lex.europa.eu/eli/dir/2019/771/oj/eng), products sold in the EU must conform to the seller's public advertising. "Expandable" and "surplus automatically transfers" are specific, verifiable claims. When the product doesn't deliver, you're entitled to repair, replacement, or refund. The burden of proof is on the seller, not you.

4. **Share this post.** Every person who sees this data before buying is one fewer person learning the hard way. EcoFlow's marketing budget is massive. The only counter is visibility.

---

*Want the full technical deep-dive with architecture diagrams, BMS chip analysis, and firmware workaround proposals? Read: [The Parallel Battery Imbalance Nobody Warns You About](/posts/ecoflow-parallel-battery-imbalance/)*

*All raw data (Prometheus, 1-minute resolution) is available for download — verify everything yourself: [april-2026-data.json](/ecoflow-data/april-2026-data.json)*

*Prefer a full-page interactive view? [Open the standalone data dashboard](/ecoflow-data/april-2026.html)*

<script>
fetch('/ecoflow-data/april-2026-data.json').then(r=>r.json()).then(DATA=>{

const ann={
  ev_start:{type:'line',xMin:1775550480000,xMax:1775550480000,borderColor:'rgba(96,165,250,0.5)',borderWidth:1.5,borderDash:[6,4],label:{display:true,content:'EV charging starts 11:28',position:'start',backgroundColor:'rgba(96,165,250,0.8)',font:{size:10},yAdjust:-0}},
  curtail:{type:'line',xMin:1775563380000,xMax:1775563380000,borderColor:'rgba(239,68,68,0.6)',borderWidth:2,borderDash:[6,4],label:{display:true,content:'Panels shut down — AC Pro empty 15:03',position:'start',backgroundColor:'rgba(239,68,68,0.85)',font:{size:10},yAdjust:-0}},
  ev_end:{type:'line',xMin:1775573400000,xMax:1775573400000,borderColor:'rgba(96,165,250,0.5)',borderWidth:1.5,borderDash:[6,4],label:{display:true,content:'EV charging ends 17:50',position:'start',backgroundColor:'rgba(96,165,250,0.8)',font:{size:10},yAdjust:-0}}
};

const timeX={type:'time',time:{unit:'hour',displayFormats:{hour:'HH:mm'},tooltipFormat:'HH:mm'},min:1775538000000,max:1775588400000,grid:{color:'rgba(51,65,85,0.5)'},ticks:{color:'#94a3b8'}};
const baseY={grid:{color:'rgba(51,65,85,0.5)'},ticks:{color:'#94a3b8'}};

function opts(yUnit,a){return{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:'#e2e8f0',usePointStyle:true,pointStyle:'circle',padding:16,font:{size:13}}},tooltip:{backgroundColor:'#1e293b',titleColor:'#f8fafc',bodyColor:'#e2e8f0',borderColor:'#334155',borderWidth:1,callbacks:{label:c=>c.dataset.label+': '+c.parsed.y?.toFixed(c.parsed.y<10?1:0)+(yUnit||'')}},annotation:{annotations:a||{}}},scales:{x:timeX,y:{...baseY,min:0}}};}

function ds(d,l,c,fill=false,w=2.5){return{data:d.map(p=>({x:p[0],y:p[1]})),label:l,borderColor:c,backgroundColor:c+'33',borderWidth:w,pointRadius:0,fill:fill,tension:0.2};}

new Chart('chart1',{type:'line',data:{datasets:[ds(DATA.ultra_soc,'Stream Ultra — Main Battery','#22c55e',true,3),ds(DATA.acpro_soc,'Stream AC Pro — Expansion Battery','#ef4444',true,3)]},options:{...opts('%',ann),scales:{x:timeX,y:{...baseY,min:0,max:100}}}});

new Chart('chart2',{type:'line',data:{datasets:[ds(DATA.pv_sum,'Solar Production','#eab308',true,3),ds(DATA.inverter,'Inverter Output (capped at 1200W)','#f97316',false,2.5)]},options:{...opts('W',{...ann,limit:{type:'line',yMin:1200,yMax:1200,borderColor:'rgba(239,68,68,0.5)',borderWidth:1.5,borderDash:[8,4],label:{display:true,content:'1200W Inverter Limit',position:'end',backgroundColor:'rgba(239,68,68,0.7)',font:{size:10}}}}),scales:{x:timeX,y:{...baseY,min:0,suggestedMax:2200}}}});

new Chart('chart3',{type:'line',data:{datasets:[ds(DATA.inverter,'Powering the Home (inverter)','#a78bfa',false,2),ds(DATA.in_ultra,'Charge → Main Battery (Ultra)','#22c55e',true,2),ds(DATA.in_acpro,'Charge → Expansion Battery (AC Pro)','#ef4444',true,2)]},options:{...opts('W',ann),scales:{x:timeX,y:{...baseY,min:0}}}});

new Chart('chart4',{type:'line',data:{datasets:[ds(DATA.pv1,'Panel 1','#facc15',false,2),ds(DATA.pv2,'Panel 2','#fb923c',false,2),ds(DATA.pv3,'Panel 3','#f87171',false,2),ds(DATA.pv4,'Panel 4','#a78bfa',false,2)]},options:{...opts('W',ann),scales:{x:timeX,y:{...baseY,min:0}}}});

});
document.querySelectorAll('.chart-wrap').forEach(w=>{
  w.addEventListener('click',()=>{
    w.classList.toggle('fullscreen');
    const c=Chart.getChart(w.querySelector('canvas'));
    if(c)setTimeout(()=>c.resize(),50);
  });
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.chart-wrap.fullscreen').forEach(w=>{w.classList.remove('fullscreen');const c=Chart.getChart(w.querySelector('canvas'));if(c)setTimeout(()=>c.resize(),50);});});
</script>
