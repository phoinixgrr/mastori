---
title: "Live Solar Status"
layout: "simple"
sharingLinks: false
showComments: false
build:
  render: always
  publishResources: true
---

<div id="solar-live-about"></div>

This blog is powered by a balcony solar system in Athens, Greece — 6 bifacial panels of about 500W each, plus a 1.92 kWh battery paired with a 1.92 kWh expansion battery for a combined 3.84 kWh storage. A Shelly Pro 3EM monitors grid consumption. Data is collected via Prometheus, and these charts update every 5 minutes.

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js"></script>

<style>
.solar-chart-card {
  background: rgba(30,41,59,0.5);
  border-radius: 12px;
  padding: 20px;
  margin: 20px 0 30px;
}
.solar-chart-card h3 {
  margin: 0 0 4px;
  font-size: 1.15em;
}
.solar-chart-desc {
  color: #94a3b8;
  font-size: 0.88em;
  margin-bottom: 12px;
}
.solar-chart-error {
  color: #94a3b8;
  text-align: center;
  padding: 40px 0;
}
</style>

<div class="solar-chart-card">
  <h3>PV String Production</h3>
  <div class="solar-chart-desc">Individual solar panel string output (stacked). Each string connects to a separate MPPT input.</div>
  <canvas id="chart-pv-strings"></canvas>
</div>

<div class="solar-chart-card">
  <h3>Battery State of Charge</h3>
  <div class="solar-chart-desc">How the batteries charged and discharged today. <strong>Combined</strong> is the overall system capacity.</div>
  <canvas id="chart-soc"></canvas>
  <div id="soc-error" class="solar-chart-error" style="display:none;">Could not load battery data.</div>
</div>

<div class="solar-chart-card">
  <h3>Power Flow</h3>
  <div class="solar-chart-desc">Where the energy comes from: <strong style="color:#eab308;">PV Production</strong>, <strong style="color:#22c55e;">Inverter Output</strong>, <strong style="color:#38bdf8;">PV to Battery</strong>, and <strong style="color:#ef4444;">Grid Import</strong>.</div>
  <canvas id="chart-power"></canvas>
  <div id="power-error" class="solar-chart-error" style="display:none;">Could not load power data.</div>
</div>

<p style="text-align:center; color:#9ca3af; font-size:0.82rem; margin-top:16px;">
  Charts refresh every 5 minutes. Data from Prometheus.
</p>

<script>
(function() {
  var gridColor = 'rgba(148,163,184,0.12)';
  var tickColor = '#94a3b8';

  function toChartData(arr) {
    return (arr || []).map(function(p) { return { x: p[0], y: p[1] }; });
  }

  function timeAxis() {
    return {
      type: 'time',
      time: { unit: 'hour', displayFormats: { hour: 'HH:mm' }, tooltipFormat: 'MMM d, HH:mm' },
      ticks: { color: tickColor, maxTicksLimit: 12 },
      grid: { color: gridColor }
    };
  }

  fetch('/api/solar-today.json?' + Date.now())
    .then(function(r) { return r.json(); })
    .then(function(d) {
      // Show timestamp on chart titles
      var updated = '';
      if (d.ts) {
        var p = d.ts.split('T');
        var ymd = p[0].split('-');
        updated = ymd[2] + '/' + ymd[1] + '/' + ymd[0] + ' ' + p[1].slice(0,5);
      }
      var badge = updated ? ' <span style="font-weight:400;font-size:0.72em;color:#94a3b8;">— last 24h, updated ' + updated + '</span>' : '';
      document.querySelectorAll('.solar-chart-card h3').forEach(function(h) {
        h.innerHTML = h.textContent + badge;
      });
      // PV Strings — stacked area
      var pvColors = ['#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];
      var pvBgs = ['rgba(234,179,8,0.6)', 'rgba(34,197,94,0.6)', 'rgba(59,130,246,0.6)', 'rgba(168,85,247,0.6)', 'rgba(236,72,153,0.6)', 'rgba(20,184,166,0.6)'];
      new Chart(document.getElementById('chart-pv-strings'), {
        type: 'line',
        data: {
          datasets: ['pv1','pv2','pv3','pv4','pv5','pv6'].map(function(key, i) {
            return { label: 'PV ' + (i+1), data: toChartData(d[key]), borderColor: pvColors[i], backgroundColor: pvBgs[i], borderWidth: 1.5, fill: 'stack', tension: 0.3, pointRadius: 0 };
          })
        },
        options: {
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: '#e2e8f0', usePointStyle: true, pointStyle: 'rect' } },
            tooltip: { mode: 'index', intersect: false, callbacks: {
              label: function(ctx) { return ctx.dataset.label + ': ' + Math.round(ctx.parsed.y) + ' W'; },
              footer: function(items) { return 'Total: ' + Math.round(items.reduce(function(s,i){return s+i.parsed.y;},0)) + ' W'; }
            }}
          },
          scales: { x: timeAxis(), y: { stacked: true, min: 0, ticks: { color: tickColor, callback: function(v) { return v + ' W'; } }, grid: { color: gridColor } } },
          spanGaps: true
        }
      });

      // Battery SOC
      new Chart(document.getElementById('chart-soc'), {
        type: 'line',
        data: {
          datasets: [
            { label: 'Combined', data: toChartData(d.combined_soc), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 3, fill: true, tension: 0.3, pointRadius: 0 },
            { label: 'EcoFlow Ultra', data: toChartData(d.ultra_soc), borderColor: '#3b82f6', borderWidth: 2, fill: false, tension: 0.3, pointRadius: 0 },
            { label: 'EcoFlow AC-PRO', data: toChartData(d.ac_pro_soc), borderColor: '#f97316', borderWidth: 2, fill: false, tension: 0.3, pointRadius: 0 }
          ]
        },
        options: {
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { labels: { color: '#e2e8f0', usePointStyle: true, pointStyle: 'line' } }, tooltip: { mode: 'index', intersect: false } },
          scales: { x: timeAxis(), y: { min: 0, max: 100, ticks: { color: tickColor, callback: function(v) { return v + '%'; } }, grid: { color: gridColor } } },
          spanGaps: true
        }
      });

      // Power Flow
      new Chart(document.getElementById('chart-power'), {
        type: 'line',
        data: { datasets: [
          { label: 'PV Production', data: toChartData(d.pv_production), borderColor: '#eab308', backgroundColor: 'rgba(234,179,8,0.1)', borderWidth: 3, fill: true, tension: 0.3, pointRadius: 0 },
          { label: 'Inverter Output', data: toChartData(d.battery_to_home), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.06)', borderWidth: 2, fill: true, tension: 0.3, pointRadius: 0 },
          { label: 'PV to Battery', data: toChartData(d.pv_to_battery), borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.06)', borderWidth: 2, fill: true, tension: 0.3, pointRadius: 0 },
          { label: 'Grid Import', data: toChartData(d.grid_import), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.06)', borderWidth: 2, fill: true, tension: 0.3, pointRadius: 0 }
        ]},
        options: {
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: '#e2e8f0', usePointStyle: true, pointStyle: 'line' } },
            tooltip: { mode: 'index', intersect: false, callbacks: { label: function(ctx) { return ctx.dataset.label + ': ' + Math.round(ctx.parsed.y) + ' W'; } } }
          },
          scales: { x: timeAxis(), y: { min: 0, max: 3000, ticks: { color: tickColor, callback: function(v) { return v + ' W'; } }, grid: { color: gridColor } } },
          spanGaps: true
        }
      });
    })
    .catch(function() {
      document.getElementById('soc-error').style.display = 'block';
      document.getElementById('power-error').style.display = 'block';
      document.getElementById('chart-soc').style.display = 'none';
      document.getElementById('chart-power').style.display = 'none';
    });
})();
</script>
