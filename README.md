# mastori.dev

[![Build & Validate](https://github.com/phoinixgrr/mastori/actions/workflows/build.yml/badge.svg)](https://github.com/phoinixgrr/mastori/actions/workflows/build.yml)
[![Hugo](https://img.shields.io/badge/Hugo-0.157.0-FF4088?logo=hugo&logoColor=white)](https://gohugo.io/)
[![Theme](https://img.shields.io/badge/Theme-Blowfish-6C5CE7)](https://blowfish.page/)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fwww.mastori.dev&label=mastori.dev)](https://www.mastori.dev/)

Source for [mastori.dev](https://www.mastori.dev/) — practical Home Assistant projects, real automations, real hardware.

## Posts

| Post | Topic |
|------|-------|
| [PV Surplus EV Charging](https://www.mastori.dev/posts/pv-surplus-ev-charging/) | Forecast-aware EV charging with EcoFlow + go-e + Tesla, zero-export |
| [Smart Boiler Controller](https://www.mastori.dev/posts/boiler-solar-thermal-esphome-vbus-controller/) | ESP32 reading Resol DeltaSol via VBus, safety-first heater control |
| [Sigma Alarm Reverse Engineering](https://www.mastori.dev/posts/sigma-alarm-reverse-engineering/) | Cracking a proprietary alarm cipher, building an HA integration |
| [Heat Pump + Fancoils](https://www.mastori.dev/posts/heat-pump-fancoils-modbus-ir/) | LG Therma V via Modbus, Daikin fancoils via Broadlink IR |
| [Awning Weather Protection](https://www.mastori.dev/posts/smart-awning-weather-protection/) | Forecast-based retract/deploy with tiered thresholds |
| [IR Dimmer with Power Feedback](https://www.mastori.dev/posts/ir-dimmer-power-feedback/) | Dumb dimmer → smart light using power consumption as brightness sensor |
| [Dew Point Protection](https://www.mastori.dev/posts/fancoil-dew-point-condensation-protection/) | Preventing fancoil condensation with per-room dew point monitoring |
| [Air Quality Index](https://www.mastori.dev/posts/air-quality-health-index/) | Composite health score from CO2 + PM2.5 + VOC with actionable tips |
| [Tapo PTZ Camera](https://www.mastori.dev/posts/tapo-ptz-home-assistant/) | Tapo PTZ camera integration with Home Assistant |

## Stack

- **[Hugo](https://gohugo.io/)** static site generator with **[Blowfish](https://blowfish.page/)** theme
- **[Giscus](https://giscus.app/)** comments via GitHub Discussions
- **Google Analytics** + **Google Search Console**
- Self-hosted on a local VM behind **Cloudflare**
- Live solar power status badge in the footer, updated every 5 minutes from Home Assistant

## Deploy

Push to `main` → cron pulls and rebuilds every 2 minutes. CI validates the build on every push.

## Author

[Akis Maziotis](https://www.linkedin.com/in/akis-maziotis/) — SRE, home automation enthusiast.
