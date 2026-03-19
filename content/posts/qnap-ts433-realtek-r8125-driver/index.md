---
title: "QNAP TS-433 Network Issues — The Realtek r8125 Driver Nobody Updated"
date: 2026-03-19
tags: ["qnap", "networking", "realtek", "linux", "driver", "nas", "homelab"]
summary: "The QNAP TS-433's built-in 2.5GbE port becomes unusable after 1-2 days. The cause: an outdated Realtek r8125 driver shipped with QTS. The fix: sideloading a newer driver on every boot. The frustration: QNAP still hasn't updated it officially."
draft: false
---

## The Problem

The [QNAP TS-433](https://www.qnap.com/en/product/ts-433) is a 4-bay ARM NAS with a built-in Realtek 2.5GbE network interface. On paper, it's a solid little NAS for a homelab. In practice, it has a crippling network issue that QNAP has known about for over a year and still hasn't fixed.

After 1-2 days of uptime, the 2.5GbE port degrades:
- Throughput drops dramatically
- Packet loss appears
- Latency becomes inconsistent
- The NAS becomes effectively unusable over the network

The only way to recover is to reboot — which buys you another day or two before it happens again.

## The Cause

The issue is the **Realtek r8125 kernel module** shipped with QTS. QNAP bundles version **9.007.01-NAPI** across their firmware releases, including the latest QTS 5.2.9.3410. This driver version has known stability issues with sustained workloads on the RTL8125 chipset.

Realtek has released newer driver versions that fix these issues. Version **9.014.01-NAPI** has been available for months and runs stable on the exact same hardware.

But QNAP hasn't updated it.

## It's Not Just Me

This isn't an isolated case. Multiple TS-433 owners report the same behavior:

- [QNAP Community Forum — TS-433 boost performance](https://community.qnap.com/t/ts-433-boost-performance/650/23)
- [QNAP Forum — Network issues thread](https://forum.qnap.com/viewtopic.php?t=175522)
- [Reddit — PSA: TS-433 is not working properly as a 2.5G NAS](https://www.reddit.com/r/qnap/comments/1m2w52f/psa_ts433_is_not_working_properly_as_a_25g_nas/)

Users across these threads have independently discovered the same workaround: replace the stock r8125.ko with a newer Realtek version. The consistency of reports and the identical fix strongly suggest this is a platform-wide issue, not a hardware defect.

## The Workaround

Since QNAP won't update the driver, I do it myself on every boot. The NAS runs a startup script that:

1. Backs up the sideloaded driver
2. Copies the newer r8125.ko into the kernel modules directory
3. Unloads the old driver and loads the new one
4. Reloads udev rules
5. Sets up my VLAN interface

```bash
#!/bin/sh
echo "############ autorun.sh script start ############" >> /dev/kmsg

# Backup the stock driver, then replace with the newer version
cp /lib/modules/5.10.60-qnap/r8125.ko /share/CACHEDEV1_DATA/Public/r8125.ko_STOCK_BAK
cp /share/CACHEDEV1_DATA/Public/r8125.ko /lib/modules/5.10.60-qnap/

# Reload the driver
modprobe -r r8125
modprobe r8125
sleep 5
udevadm control --reload-rules && udevadm trigger
sleep 30

# Optional: set up VLAN if needed (adjust to your network)
# vconfig add eth0 <VLAN_ID>
# ip link set eth0.<VLAN_ID> up
# brctl addif br0 eth0.<VLAN_ID>
# ip addr add <YOUR_IP>/<MASK> dev br0

echo "############ autorun.sh script end ############" >> /dev/kmsg
```

This script lives on the NAS storage and runs at boot via QNAP's autorun mechanism. After it runs, the NAS is stable for weeks — no packet loss, no throughput drops, no latency issues.

### Before and After

| Metric | Stock driver (9.007.01) | Sideloaded (9.014.01) |
|--------|------------------------|----------------------|
| **Stability** | Degrades after 1-2 days | Stable for weeks |
| **Throughput** | Drops to near zero | Consistent 2.5Gbps |
| **Packet loss** | Yes, after degradation | None |
| **Driver version** | 9.007.01-NAPI | 9.014.01-NAPI |

## The QNAP Support Experience

I opened a support ticket in March 2026 (ticket Q-202603-14685). Here's the timeline:

1. **Day 1** — I filed a detailed report with diagnostic logs, driver versions, uname output, and the workaround script
2. **Day 2** — Support asked me to upgrade to the latest QTS firmware (fair enough)
3. **Day 3** — I upgraded to QTS 5.2.9.3410. The driver was **still 9.007.01-NAPI**. No change. I reported this back with proof
4. **Day 4** — Support escalated to the Dev Team
5. **Day 5** — I provided links to public forum threads showing multiple users with the same issue
6. **Day 6** — Dev Team acknowledged and asked for my usage scenario (protocols, clients, network hardware)
7. **Day 8** — I provided full details: SMB + NFS, macOS + Windows + Proxmox, MikroTik router, Cat6 cabling
8. **Day 11** — "Dev Team is still checking this issue. For now, you can do your workaround."

As of writing, the ticket is still open and the driver is still not updated in any QTS release.

### What's Frustrating

The support engineer tested on a **TS-473** (different model) and found driver version **9.011.01-NAPI-RSS** — newer than what ships on the TS-433. This means QNAP has newer Realtek drivers in their pipeline but hasn't pushed them to all affected models.

The TS-433 is stuck on 9.007.01-NAPI across all firmware versions, while other models get 9.011.01. And the community-available 9.014.01 fixes the issue completely.

## Why This Matters

The TS-433 is not a cheap device. People buy it specifically for the 2.5GbE connectivity. When the primary network interface degrades after a day of use, the NAS is fundamentally broken for its intended purpose.

The workaround exists and it works — but it shouldn't be necessary. A firmware update with a newer Realtek driver would fix this for every TS-433 owner. The driver exists. The fix is proven. It just needs to be included in QTS.

## If You Have a TS-433

If you're experiencing similar network issues:

1. **Verify your driver version** via SSH (note: `modinfo` is not available on QTS/BusyBox):
   ```bash
   grep -a "version" /lib/modules/$(uname -r)/r8125.ko | strings | grep NAPI
   ```
   If it shows `version=9.007.01-NAPI`, you're affected.

2. **Download the newer Realtek r8125 driver** (version 9.014.01-NAPI). I host a pre-compiled module for the QNAP aarch64 kernel 5.10.60 here on mastori.dev: **[r8125-9.014.01-NAPI-aarch64.ko](/downloads/r8125-9.014.01-NAPI-aarch64.ko)** — feel free to grab it, that is if you trust a stranger's kernel module 😄. Otherwise, download the source from the [Realtek website](https://www.realtek.com/Download/List?cate_id=584) and compile it yourself.

3. **Place the driver on persistent storage.** The `/lib/modules/` directory is reset on every QTS update, so the driver must live on a share that survives reboots and firmware upgrades. Copy it via SSH:
   ```bash
   # Rename and copy the downloaded driver to a persistent location on the NAS
   cp r8125-9.014.01-NAPI-aarch64.ko /share/CACHEDEV1_DATA/Public/r8125.ko
   ```
   `/share/CACHEDEV1_DATA/Public/` maps to the "Public" shared folder on your first storage pool. You can use any shared folder — just make sure the autorun script points to the same path.

4. **Set up the autorun script** as shown above to replace the driver on every boot.

4. **File a support ticket** with QNAP referencing this issue — the more reports they receive, the more likely it gets prioritized in a firmware update.

## The Bottom Line

The QNAP TS-433 has a known, reproducible, community-documented network stability issue caused by an outdated Realtek r8125 driver. The fix is a driver update that Realtek has already released. QNAP's Dev Team is aware. Multiple users have reported it. The workaround is straightforward but shouldn't be needed.

If you're considering a TS-433 — be aware of this issue. If you already own one — sideload the driver and file a ticket. And if you're at QNAP reading this — please just update the driver. It's one file.
