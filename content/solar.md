---
title: "Live Solar Status"
layout: "simple"
sharingLinks: false
showComments: false
_build:
  list: never
  render: always
  publishResources: true
---

<div id="solar-live-about"></div>

Real-time data from our EcoFlow battery system, updated every 5 minutes.

### Battery State of Charge

How our batteries charged and discharged throughout the day. The **Combined** line shows overall system capacity.

<img src="/api/solar-battery.png" alt="Battery state of charge today" style="width:100%; border-radius:8px; margin:8px 0;" loading="lazy">

### Power Flow

Where the energy comes from: **PV Production** (solar panels), **Battery to Home** (stored solar), and **Grid Import** (utility power).

<img src="/api/solar-power.png" alt="Power flow today" style="width:100%; border-radius:8px; margin:8px 0;" loading="lazy">

<p style="text-align:center; color:#9ca3af; font-size:0.85rem; margin-top:16px;">
  Graphs refresh every 5 minutes. Data from Prometheus via Grafana, rendered as static images — no external services, no tracking.
</p>
