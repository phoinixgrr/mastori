---
title: "I Paid €620 for an EcoFlow Battery That Never Charges"
date: 2026-04-07
draft: true
tags: ["ecoflow", "solar", "battery", "stream-ultra", "stream-ac-pro", "hardware-limitation", "consumer-rights"]
summary: "EcoFlow says you can expand to 6 batteries. Here's what actually happens on a sunny day — with real data to prove it."
keywords: ["ecoflow stream ultra battery imbalance", "ecoflow expandable lie", "ecoflow ac pro not charging", "ecoflow 1200W bottleneck", "ecoflow stream ultra review"]
---

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.1.0/dist/chartjs-plugin-annotation.min.js"></script>

<style>
.chart-wrap { position:relative; background:var(--color-neutral-800,#1e293b); border-radius:12px; padding:16px; margin:24px 0; height:400px; }
.chart-wrap canvas { max-height:100%; }
.stat-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin:24px 0; }
.stat-card { background:var(--color-neutral-800,#1e293b); border-radius:12px; padding:16px; text-align:center; }
.stat-val { font-size:1.8em; font-weight:700; }
.stat-lbl { opacity:0.6; font-size:0.85em; margin-top:2px; }
.clr-green{color:#22c55e} .clr-red{color:#ef4444} .clr-yellow{color:#eab308} .clr-orange{color:#f97316}
</style>

## The Promise

EcoFlow's website says:

> *"Expandable capacity from 3.84 to 23kWh"*

> *"Up to 6 devices per system"*

> *"Surplus solar energy automatically transfers between batteries"*

So I bought a Stream AC Pro (€620) to expand my Stream Ultra system. Two batteries, 4 solar panels, one goal: store more sun.

## The Reality

April 7, 2026. Perfect sunny day in Greece. Here's what happened:

<div class="stat-grid">
  <div class="stat-card"><div class="stat-val clr-yellow">12 kWh</div><div class="stat-lbl">Solar produced</div></div>
  <div class="stat-card"><div class="stat-val clr-green">99.8%</div><div class="stat-lbl">Main battery (Ultra)</div></div>
  <div class="stat-card"><div class="stat-val clr-red">19.3%</div><div class="stat-lbl">Expansion battery (AC Pro)</div></div>
  <div class="stat-card"><div class="stat-val clr-orange">1200W</div><div class="stat-lbl">Inverter bottleneck</div></div>
</div>

One battery charged to full. The other — the one I paid €620 for — went from 10% to 19% all day.

**Same sun. Same system. Same house.**

<div class="chart-wrap"><canvas id="chart1"></canvas></div>

Both batteries start the day at ~10%. By afternoon, the main battery is at 99.8%. The expansion battery barely moved. Every data point is real, recorded by [Home Assistant](https://www.home-assistant.io/) at 1-minute intervals.

## Why This Happens

There's a 1200W inverter bottleneck inside the Stream Ultra. Solar energy can only reach the AC Pro through this inverter. But the inverter is already busy powering your home.

It's like trying to fill two swimming pools through a garden hose that's already watering your lawn. The second pool never fills.

<div class="chart-wrap"><canvas id="chart2"></canvas></div>

The gap between solar production and inverter output is energy that the panels actually generated — but the system **threw away** because the inverter is maxed out at 1200W.

## Where Does the Solar Energy Go?

<div class="chart-wrap"><canvas id="chart3"></canvas></div>

The inverter spends all 1200W powering the home. The main battery absorbs whatever surplus is left. And the expansion battery? Barely visible at the bottom. It received **0.16 kWh out of 12 kWh** produced — just 1.3% of available solar energy.

## Solar Panels Shut Down — While the Expansion Battery Sits Empty

<div class="chart-wrap"><canvas id="chart4"></canvas></div>

When the main battery hits 100% and the inverter is maxed, the system has nowhere to put the energy. So it **shuts down your solar panels entirely**. Meanwhile, the expansion battery is at 18% — empty and ready to charge — but the 1200W bottleneck won't let a single watt through.

## "Expandable to 6 Batteries" — Let's Do the Math

EcoFlow's marketing proudly announces you can expand to 6 batteries. They even sell the Stream Ultra X with "expandable to 23 kWh" in bold letters. Sounds incredible, right?

Let's see what you're actually buying:

| Setup | Cost | Total Storage | Usable From Solar | Dead Weight | Money Wasted |
|---|---|---|---|---|---|
| 1 Ultra + 1 AC Pro | ~€2,100 | 3.84 kWh | 1.92 kWh | **50%** | ~€620 |
| 1 Ultra + 2 AC Pro | ~€2,720 | 5.76 kWh | 1.92 kWh | **67%** | ~€1,240 |
| 1 Ultra + 5 AC Pro | ~€4,580 | 11.52 kWh | 1.92 kWh | **83%** | ~€3,100 |

With 6 batteries, you've spent over €4,500 — and **5 out of 6 batteries sit empty while the sun shines**. €3,100 worth of lithium doing absolutely nothing during peak solar hours. That's not an energy system. That's a very expensive shelf decoration.

But wait — it gets even better. EcoFlow's flagship Stream Ultra X boasts "expandable to 23 kWh." That's 6 units at 3.84 kWh each, all sharing the same 1200W inverter bus with your house. Let's imagine you actually bought that:

- **23 kWh of storage**, one 1200W straw to fill it
- Under any household load, **only the first unit charges from solar**
- Even with zero load, charging 5 empty batteries through a 1200W inverter at ~87% efficiency takes **over 18 hours** — longer than the longest summer solar day in Greece
- You'd need **two consecutive perfect sunny days with zero home consumption** just to fill the system once
- Total investment: north of **€8,000** for storage you physically cannot use

The "expandable to 23 kWh" claim is technically true in the same way a bicycle is "expandable to highway speed" — the hardware supports it, the physics don't.

## EcoFlow Knows

I reported this to EcoFlow EU Support. Their R&D team responded:

> *"The inverter limit of the Stream Ultra itself is only 1200W. The transfer of PV power between different devices must go through the inverter for conversion. The remaining solar energy can only be used to charge the Stream Ultra directly."*

Their suggested solution? **"Remove or reduce the load."**

That's like telling a car owner to stop driving so the engine lasts longer. The whole point of a solar battery system is to power your home AND store surplus.

## Thinking of Buying Into the Stream Platform?

Don't let the "expandable" marketing fool you. Before you invest, understand what you're actually getting:

- **The first unit works great.** A single Stream Ultra with solar panels is a solid product. No complaints there.
- **The moment you expand, the architecture breaks.** Every additional battery you buy depends on that same 1200W inverter to receive solar charge. Under any normal household load, it can't.
- **You're not buying storage — you're buying dead weight.** An AC Pro can only charge from solar when your home draws almost nothing. That's not how homes work.
- **The more you expand, the worse it gets.** Two batteries? 50% dead. Three? 67%. Six? 83% of your investment sits idle during peak solar hours.
- **There is no firmware fix.** This is a hardware architecture limitation. The 1200W inverter is a physical bottleneck. EcoFlow's own R&D team confirmed it.

If you need more than 1.92 kWh of usable solar storage, look elsewhere. Anker SOLIX, Zendure, Marstek, and others offer balcony solar systems with DC-coupled expansion batteries that don't suffer from this bottleneck. Do your research — and don't trust "expandable" marketing without understanding the architecture behind it.

## If You Already Own This System

1. **Check your data.** Compare the SoC of both batteries during a sunny day with normal household load. The gap tells the story.
2. **Report to EcoFlow.** Reference the 1200W inverter bottleneck. They've already confirmed it internally.
3. **Know your rights.** EU consumers have a 2-year legal guarantee. Products must work as advertised.
4. **Share this.** The more visibility, the more pressure for a fix — firmware or hardware.

---

*For the full technical deep-dive (architecture diagrams, BMS analysis, firmware workaround proposals): [The Parallel Battery Imbalance Nobody Warns You About](/posts/ecoflow-parallel-battery-imbalance/)*

*All raw Prometheus data used in this post is available for download: [april-2026-data.json](/ecoflow-data/april-2026-data.json) — 1-minute resolution, verify everything yourself.*

*Prefer a full-page interactive view? [Open the standalone data dashboard](/ecoflow-data/april-2026.html).*

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
</script>
