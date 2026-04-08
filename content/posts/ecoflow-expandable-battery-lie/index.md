---
title: "I Paid €620 for an EcoFlow Battery That Never Charges"
date: 2026-04-07
draft: false
_build:
  list: never
  render: always
tags: ["ecoflow", "solar", "battery", "stream-ultra", "stream-ac-pro", "hardware-limitation", "consumer-rights"]
summary: "EcoFlow markets 'expandable' battery systems with 'automatic solar energy transfer.' I bought the expansion, monitored it for weeks, and the data shows the 1200W inverter bottleneck prevents expansion batteries from charging under normal household load."
keywords: ["ecoflow stream ultra battery imbalance", "ecoflow expandable lie", "ecoflow ac pro not charging", "ecoflow 1200W bottleneck", "ecoflow stream ultra review", "ecoflow stream ultra problems", "ecoflow alternative", "anker solix vs ecoflow", "zendure vs ecoflow"]
---

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.1.0/dist/chartjs-plugin-annotation.min.js"></script>

<style>
.chart-wrap { position:relative; background:var(--color-neutral-800,#1e293b); border-radius:12px; padding:16px; margin:24px 0; height:400px; cursor:pointer; transition:all 0.3s ease; }
.chart-wrap::after { content:'Click to expand'; position:absolute; top:8px; right:12px; font-size:0.7em; opacity:0.4; pointer-events:none; }
.chart-wrap canvas { max-height:100%; }
.chart-fullscreen-overlay { display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.97); z-index:99999; padding:24px; cursor:zoom-out; }
.chart-fullscreen-overlay.active { display:flex; align-items:center; justify-content:center; }
.chart-fullscreen-overlay canvas { width:100%!important; height:90vh!important; }
.stat-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin:24px 0; }
.stat-card { background:var(--color-neutral-800,#1e293b); border-radius:12px; padding:16px; text-align:center; }
.stat-val { font-size:1.8em; font-weight:700; }
.stat-lbl { opacity:0.6; font-size:0.85em; margin-top:2px; }
.clr-green{color:#22c55e} .clr-red{color:#ef4444} .clr-yellow{color:#eab308} .clr-orange{color:#f97316}
</style>

If you're considering adding expansion batteries to an EcoFlow Stream Ultra system, this post might save you some money. I bought one, monitored it for weeks, and the data tells a clear story.

Everything below is backed by real measurements from [Home Assistant](https://www.home-assistant.io/) with Prometheus at 1-minute resolution. The raw data is available for download at the bottom of this post — verify everything yourself.

## My Setup

| Component | Role |
|---|---|
| **EcoFlow Stream Ultra** | Main unit — 4 MPPT solar inputs, 1200W inverter, 1.92 kWh LFP battery |
| **EcoFlow Stream AC Pro** | Expansion battery — 1.92 kWh LFP, no solar inputs, no independent inverter |
| **EcoFlow Parallel Cable** | Proprietary AC cable connecting Ultra to AC Pro |
| **4× 520W bifacial panels** | ~2 kWp total, connected to the Ultra's 4 MPPTs |
| **Shelly Pro 3EM** | Grid meter for zero-export control |

The AC Pro has no solar inputs of its own. It connects to the Ultra via a proprietary AC parallel cable. The **only** path for solar energy to reach the AC Pro is: panels → Ultra's DC bus → Ultra's 1200W inverter → AC cable → AC Pro's inverter → AC Pro's battery. Two conversions (DC→AC→DC), through a shared 1200W inverter.

I purchased the AC Pro (€620) to double my storage from 1.92 kWh to 3.84 kWh, based on EcoFlow's marketing of seamless expansion.

## What EcoFlow Markets

Their product page says:

> *"Expandable capacity from 3.84 to 23kWh"*

> *"Up to 6 devices per system"*

> *"Surplus solar energy automatically transfers between batteries"*

To be precise about terminology: the storage capacity claim (kWh) is technically correct — the batteries exist and hold charge. The issue is with the **energy transfer** claim. "Surplus solar energy automatically transfers between batteries" describes power flow (kW), and under normal household conditions, it doesn't happen. Here's why.

## The Data: April 7, 2026

Clear sky over Athens. 12 kWh of solar energy produced. Both batteries started the day at ~10%.

<div class="stat-grid">
  <div class="stat-card"><div class="stat-val clr-yellow">12 kWh</div><div class="stat-lbl">Solar produced</div></div>
  <div class="stat-card"><div class="stat-val clr-green">99.8%</div><div class="stat-lbl">Main battery (Ultra)</div></div>
  <div class="stat-card"><div class="stat-val clr-red">19.3%</div><div class="stat-lbl">Expansion battery (AC Pro)</div></div>
  <div class="stat-card"><div class="stat-val clr-orange">1200W</div><div class="stat-lbl">Shared inverter bottleneck</div></div>
</div>

The main battery charged to 99.8%. The expansion battery reached 19.3%. This pattern is consistent across weeks of monitoring — it's not a one-off.

<div class="chart-wrap"><canvas id="chart1"></canvas></div>

## Why This Happens

The Stream Ultra has a 1200W inverter. This inverter serves two purposes: powering your home, and transferring energy to expansion batteries (which connect via AC coupling). Both functions share the same 1200W.

Under any normal household load, the inverter is fully consumed powering the home. Nothing remains for the expansion battery.

Think of it as two water tanks sharing one pipe that's already watering your garden. The second tank stays empty — not because there's no water, but because the pipe is busy.

<div class="chart-wrap"><canvas id="chart2"></canvas></div>

The panels produced nearly 2000W at peak. The inverter passed through 1200W. The remaining ~800W had nowhere to go — the expansion battery couldn't receive it through the saturated inverter.

## Where the Energy Goes

<div class="chart-wrap"><canvas id="chart3"></canvas></div>

The inverter's 1200W capacity is consumed powering the home. The main battery absorbs whatever DC surplus remains before the inverter. The expansion battery received **0.16 kWh out of 12 kWh** produced — 1.3% of available solar energy.

## Solar Curtailment

<div class="chart-wrap"><canvas id="chart4"></canvas></div>

When the main battery reaches 100% and the inverter is fully allocated, the system curtails PV production. The expansion battery is at 18% and has capacity available, but the AC-coupled architecture provides no path for energy to reach it. The panels reduce output because the system has no buffer left — despite 1.92 kWh of empty storage sitting idle.

## Scaling: What "Expandable to 6 Batteries" Actually Means

The storage capacity scales as advertised — add batteries, get more kWh. But the **charging rate from solar doesn't scale at all**. Every expansion battery shares the same 1200W inverter for solar charging:

| Setup | Cost | Total Storage | Solar Charging Bottleneck | Effective Solar Charging |
|---|---|---|---|---|
| 1 Ultra | ~€1,480 | 1.92 kWh | 1200W (dedicated) | Full |
| 1 Ultra + 1 AC Pro | ~€2,100 | 3.84 kWh | 1200W (shared with home) | Main battery only under load |
| 1 Ultra + 2 AC Pro | ~€2,720 | 5.76 kWh | 1200W (shared with home) | Main battery only under load |
| 1 Ultra + 5 AC Pro | ~€4,580 | 11.52 kWh | 1200W (shared with home) | Main battery only under load |

With 6 batteries under normal household load, only the main battery charges from solar during the day. The other 5 batteries have the capacity but no path to receive solar energy.

For the Stream Ultra X ("expandable to 23 kWh"): that's 6 units at 3.84 kWh each, all dependent on one 1200W inverter. Even with zero home consumption, charging 5 empty units through that inverter takes over **18 hours** — longer than the longest summer solar day in Greece.

The capacity claim (kWh) is correct. The practical ability to charge that capacity from solar under real-world conditions is the problem.

## EcoFlow's Response

I submitted a detailed technical report to EcoFlow EU Support with monitoring data, screenshots, and specific sensor readings. Their R&D team confirmed the limitation:

> *"The inverter limit of the Stream Ultra itself is only 1200W. The transfer of PV power between different devices must go through the inverter for conversion. The remaining solar energy can only be used to charge the Stream Ultra directly."*

Their suggested workaround:

> *"We recommend that when charging is required, you first remove or reduce the load."*

I requested a reasonable resolution — an exchange for a Stream Ultra X (same total capacity in a single unit, no AC-coupling bottleneck). The case has been escalated and is ongoing.

## The Architecture Problem: AC vs DC Coupling

This isn't unique to EcoFlow — it's an architecture choice. The Stream series uses **AC-coupled** expansion: batteries connect via AC, requiring double conversion (DC→AC→DC) through a shared inverter. This creates the bottleneck.

The alternative is **DC-coupled expansion**, where batteries connect directly to the solar charge controller. No inverter bottleneck, no shared bus. All batteries charge equally from solar.

Products that use DC-coupled expansion include **Anker SOLIX** (Solarbank 2), **Zendure** (SolarFlow Hub), and **Marstek** (Jupiter series). I haven't tested them — do your own research. The key question to ask any vendor: *"When I add a second battery, does it charge through the inverter or directly from DC?"*

## If You Own This System

If you have Home Assistant or any monitoring, compare both battery SoC values during a sunny day with normal household load. If you see the same divergence, it's the same issue.

EU consumers have a 2-year legal guarantee under [Directive 2019/771](https://eur-lex.europa.eu/eli/dir/2019/771/oj/eng). Marketing claims like "surplus solar energy automatically transfers between batteries" form part of the product's conformity requirements. If the product doesn't deliver on those claims, consumers are entitled to remedy.

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
const overlay=document.createElement('div');overlay.className='chart-fullscreen-overlay';document.body.appendChild(overlay);
let fsChart=null;
function closeOverlay(){overlay.classList.remove('active');if(fsChart){fsChart.destroy();fsChart=null;}overlay.innerHTML='';}
overlay.addEventListener('click',closeOverlay);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeOverlay();});
document.querySelectorAll('.chart-wrap').forEach(w=>{
  w.addEventListener('click',()=>{
    const src=Chart.getChart(w.querySelector('canvas'));if(!src)return;
    closeOverlay();
    const canvas=document.createElement('canvas');overlay.appendChild(canvas);
    overlay.classList.add('active');
    fsChart=new Chart(canvas,{type:src.config.type,data:JSON.parse(JSON.stringify(src.config.data)),options:JSON.parse(JSON.stringify(src.config.options))});
  });
});
</script>
