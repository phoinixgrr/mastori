---
title: "Free Failover for mastori.dev: Cloudflare Tunnel, One Worker and the Second House"
date: 2026-11-09
tags: ["cloudflare", "high-availability", "failover", "homelab", "proxmox", "hugo", "wireguard", "cloudflared"]
summary: "mastori.dev is served from Athens. If Athens goes down, a small VM in my second house, which has no public IP, answers instead. A Cloudflare Tunnel gets the traffic in, a short Worker decides who answers, and it costs nothing."
keywords: [
  "cloudflare tunnel failover",
  "cloudflare worker failover static site",
  "free high availability static site",
  "cloudflared behind cgnat",
  "hugo cloudflare worker standby"
]
---

## The setup

It is an active-standby setup: Athens serves every request, and the second house only takes over when Athens fails.

- **Athens (main, active).** A Proxmox VM runs nginx and serves mastori.dev, a Hugo site, behind [Cloudflare](https://www.cloudflare.com/). Athens has a normal public IP (no CGNAT), so the router simply forwards the web port to that VM, and only accepts Cloudflare's address ranges.
- **The second house (εξοχικό, standby).** One Proxmox node as well, on 5G. The carrier shares one public address between many customers (CGNAT), so this house has no public IP and nothing can connect in.
- **A site-to-site WireGuard VPN** between the two routers, used for [offsite backups](/posts/proxmox-backup-server-offsite-adsl/). The failover does not use it.

{{< mermaid >}}
flowchart TD
    V["🌍 Visitors"] --> CF["☁️ Cloudflare<br/>the only public address"]
    PAD["GitHub repo"]
    GH["GitHub repo"]

    subgraph ATH["🏠 Athens (main), ACTIVE"]
        subgraph PA["Proxmox"]
            A["VM<br/>nginx + Hugo site"]
        end
    end

    subgraph SH["🏡 Second house (εξοχικό), STANDBY, 5G, no public IP"]
        subgraph PS["Proxmox"]
            S["VM<br/>nginx + Hugo site<br/>+ cloudflared"]
        end
    end

    PAD ~~~ A
    PAD ~~~ S
    CF -->|"all traffic, port forward,<br/>only from Cloudflare's IP ranges"| A
    CF -->|"failover only,<br/>encrypted tunnel opened from the inside"| S
    A -.- VPN["🔒 WireGuard VPN<br/>(backups only)"]
    S -.- VPN
    GH -->|"git pull + hugo<br/>every 2 min"| A
    GH -->|"git pull + hugo<br/>every 2 min"| S

    style PAD fill:none,stroke:none,color:transparent
    style CF fill:#854d0e,stroke:#eab308,color:#fff
    style A fill:#166534,stroke:#22c55e,color:#fff
    style S fill:#1e3a8a,stroke:#3b82f6,color:#fff
    style VPN fill:#1f2937,stroke:#6b7280,color:#fff
{{< /mermaid >}}

## cloudflared: the house calls out

CGNAT rules out a port forward, so a [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) turns the connection around. The second house runs the same thing as Athens, a small VM (1 core, 1 GB RAM) with nginx and the Hugo site, plus [`cloudflared`](https://github.com/cloudflare/cloudflared), which opens an outbound connection to Cloudflare and keeps it open. Cloudflare sends requests down it, under the hostname `standby.mastori.dev`. No port forward, no public IP.

## All static, and GitHub is the source of truth

No database, no uploads, no sessions. The site is [a GitHub repo](https://github.com/phoinixgrr/mastori), and both servers run the same job every two minutes:

```bash
git pull                      # nothing to do if the repo did not change
hugo --minify                 # same Hugo version as CI
rsync -a --delete build/ /var/www/mastori/
```

There is nothing to replicate. The standby is just a second place that builds the same repo, and the home page from both is byte-identical. The only thing not in git is the live solar numbers, a small JSON file the standby downloads from the public site every five minutes.

## The switch: one Worker

A [Cloudflare Worker](https://developers.cloudflare.com/workers/) is a small JavaScript function that Cloudflare runs on its own servers, close to the visitor. Mine runs for `www.mastori.dev` and `mastori.dev`:

1. Ask Athens. Wait up to 6 seconds.
2. If it answers normally, return that. The visitor sees no difference.
3. If it fails (connection error, 5xx, Cloudflare 52x, or no answer), fetch the same path from the standby and add an `x-failover` header. A 404 is a valid answer and passes through.

```js
// trimmed: the real one also remembers "Athens is down", see below
export default {
  async fetch(request) {
    try {   // 1. Athens
      const res = await fetch(request, { signal: AbortSignal.timeout(6000) });
      if (!isFail(res.status)) return res;
    } catch (e) {}

    // 2. the standby
    const url = new URL(request.url);
    const backup = await fetch('https://standby.mastori.dev' + url.pathname);
    const out = new Response(backup.body, backup);
    out.headers.set('x-failover', 'standby');
    return out;
  },
};
```

Waiting 6 seconds for every visitor would be awful. After the first failure the Worker remembers "Athens is down" in that data center, sends everyone straight to the standby, and checks Athens in the background every 15 seconds. When Athens answers again, traffic goes back.

{{< mermaid >}}
sequenceDiagram
    actor V as 🌍 Visitor
    participant W as ☁️ Cloudflare Worker
    participant A as 🏠 Athens
    participant S as 🏡 Standby (via tunnel)

    V->>W: GET /posts/
    W->>A: ask Athens (6 s limit)
    alt Athens answers
        A-->>W: 200, the page
        W-->>V: the page, untouched
    else error, 5xx, 52x or timeout
        A--xW: no answer
        W->>S: same path, through the tunnel
        S-->>W: 200, the page
        W-->>V: the page + x-failover header
    end
{{< /mermaid >}}

## Does it work?

I stopped nginx on the Athens VM and watched the site from outside:

{{< mermaid >}}
flowchart LR
    A["nginx stopped<br/>on Athens"] --> B["first request<br/>waits 6 s,<br/>then 200 from<br/>the standby"]
    B --> C["every page after:<br/>about 0.1 s,<br/>from the standby"]
    C --> D["nginx started<br/>again"]
    D --> E["about 1 min later:<br/>back on Athens,<br/>no action needed"]

    style A fill:#991b1b,stroke:#ef4444,color:#fff
    style B fill:#854d0e,stroke:#eab308,color:#fff
    style C fill:#854d0e,stroke:#eab308,color:#fff
    style D fill:#1e3a8a,stroke:#3b82f6,color:#fff
    style E fill:#166534,stroke:#22c55e,color:#fff
{{< /mermaid >}}

## Cost: zero

| Part | Cost |
|---|---|
| Cloudflare plan and Tunnel | Free |
| Worker | Free tier, 100,000 requests a day |
| VM | A spare corner of a Proxmox node |

Cloudflare shows 2,000 to 15,000 requests a day for the whole domain (about 500 to 800 unique visitors, 50 to 100 MB). Nowhere near the limit.

## Public IPs stay hidden

- DNS only returns Cloudflare addresses.
- Athens accepts web traffic only from Cloudflare's ranges.
- The second house has no public IP. It only dials out.

## Next

Move Athens to `cloudflared` as well. Then neither house forwards a port, and both sites run exactly the same setup.

This is just a fun project. I doubt mastori.dev visitors would notice even 24 hours of downtime ;)
