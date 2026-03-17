# mastori.dev

[![Build & Validate](https://github.com/phoinixgrr/mastori/actions/workflows/build.yml/badge.svg)](https://github.com/phoinixgrr/mastori/actions/workflows/build.yml)
[![Hugo](https://img.shields.io/badge/Hugo-0.157.0-FF4088?logo=hugo&logoColor=white)](https://gohugo.io/)
[![Theme](https://img.shields.io/badge/Theme-Blowfish-6C5CE7)](https://blowfish.page/)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fwww.mastori.dev&label=mastori.dev)](https://www.mastori.dev/)

Source for [mastori.dev](https://www.mastori.dev/) — practical Home Assistant projects, real automations, real hardware.

## Stack

- **[Hugo](https://gohugo.io/)** static site generator with **[Blowfish](https://blowfish.page/)** theme
- **[Giscus](https://giscus.app/)** comments via GitHub Discussions
- **Google Analytics** + **Google Search Console**
- Self-hosted on a local VM behind **Cloudflare**
- Live solar power status badge in the footer, updated every 5 minutes from Home Assistant

## Deploy

Push to `main` → cron pulls and rebuilds every 2 minutes. CI validates the build on every push.
