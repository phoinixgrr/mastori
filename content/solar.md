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

This blog is powered by a small solar system with battery storage in Athens, Greece. A Shelly Pro 3EM monitors grid consumption. Data is collected via Prometheus, and these charts update every 5 minutes.

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
  <h3>PV Production</h3>
  <div class="solar-chart-desc">Total solar output of the whole system.</div>
  <canvas id="chart-pv"></canvas>
</div>

<div class="solar-chart-card">
  <h3>Battery State of Charge</h3>
  <div class="solar-chart-desc">How the batteries charged and discharged today.</div>
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
      // Total PV production
      new Chart(document.getElementById('chart-pv'), {
        type: 'line',
        data: { datasets: [
          { label: 'PV Production', data: toChartData(d.pv_production), borderColor: '#eab308', backgroundColor: 'rgba(234,179,8,0.25)', borderWidth: 2, fill: true, tension: 0.3, pointRadius: 0 }
        ]},
        options: {
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: { mode: 'index', intersect: false, callbacks: { label: function(ctx) { return ctx.dataset.label + ': ' + Math.round(ctx.parsed.y) + ' W'; } } }
          },
          scales: { x: timeAxis(), y: { min: 0, ticks: { color: tickColor, callback: function(v) { return v + ' W'; } }, grid: { color: gridColor } } },
          spanGaps: true
        }
      });

      // Battery SOC
      new Chart(document.getElementById('chart-soc'), {
        type: 'line',
        data: {
          datasets: [
            { label: 'Battery', data: toChartData(d.combined_soc), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 3, fill: true, tension: 0.3, pointRadius: 0 }
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
          { label: 'Inverter Output to Home', data: toChartData(d.battery_to_home), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.06)', borderWidth: 2, fill: true, tension: 0.3, pointRadius: 0 },
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
          scales: { x: timeAxis(), y: { min: 0, ticks: { color: tickColor, callback: function(v) { return v + ' W'; } }, grid: { color: gridColor } } },
          spanGaps: true
        }
      });
    })
    .catch(function() {
      document.getElementById('soc-error').style.display = 'block';
      document.getElementById('power-error').style.display = 'block';
      document.getElementById('chart-pv').style.display = 'none';
      document.getElementById('chart-soc').style.display = 'none';
      document.getElementById('chart-power').style.display = 'none';
    });
})();
</script>
