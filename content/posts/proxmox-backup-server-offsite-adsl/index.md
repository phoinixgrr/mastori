---
title: "Offsite Proxmox Backups Over 1Mbit ADSL — How PBS Made It Possible"
date: 2026-04-18
tags: ["proxmox", "backup", "pbs", "homelab", "nas", "wireguard", "offsite"]
summary: "Setting up Proxmox Backup Server to protect a remote site's VMs over a 733 Kbit/s ADSL uplink — block-level dedup turned a 9-hour full backup into a 30-minute incremental, and freed 4 TB of NAS storage in the process."
draft: false
---

## The Problem

I run Proxmox VE across three nodes in two physical locations:

| Site | Nodes | Guests | Connection |
|------|-------|--------|------------|
| Primary (urban) | 2 nodes | 11 VMs/CTs | 2.5GbE LAN |
| Remote (rural) | 1 node | 2 VMs/CTs | 1Mbit ADSL |

The primary site has a 33TB NAS. Both nodes were already doing daily vzdump backups to it — full `.vma.zst` images every night. It worked, but it was dumb: every backup was a complete copy. The NAS was burning through **4.6 TB** just on backup files, with a retention of 7 daily, 7 weekly, 7 monthly, 7 yearly.

The remote site had **no backups at all**. Why? The ADSL connection:

```
$ iperf3 -c remote-proxmox
  8.49 Mbits/sec  (primary → remote, download at remote)

$ iperf3 -c remote-proxmox -R
  733 Kbits/sec   (remote → primary, upload from remote)
```

733 Kbit/s upload. That's ~90 KB/s. The Home Assistant VM alone has a 32GB disk. A full vzdump backup compressed to ~7GB would take **24+ hours** to transfer. Not viable for any reasonable backup schedule.

The two sites are connected via a WireGuard site-to-site VPN between the routers.

## Why PBS

[Proxmox Backup Server](https://www.proxmox.com/en/proxmox-backup-server/overview) solves this with two key features:

1. **Block-level deduplication** — data is chunked and only unique chunks are stored. Identical blocks across different VMs and snapshots are stored once.
2. **Incremental backups with dirty bitmaps** — for QEMU VMs, PBS tracks which disk blocks changed since the last backup. Only dirty blocks are read and transferred.

This means after the painful first full backup, subsequent backups only transfer what actually changed. For a Home Assistant VM that mostly writes to its database, that's a few hundred MB instead of 32 GB.

## The Setup

### PBS as an LXC Container

PBS runs as a privileged LXC container on one of the primary site nodes. I used the [community-scripts installer](https://community-scripts.org/scripts/proxmox-backup-server):

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/proxmox-backup-server.sh)"
```

Specs: 2 cores, 2GB RAM, 10GB disk. Lightweight — PBS is just a service layer.

> **Note:** Use **privileged** mode if your datastore is on NFS. Unprivileged containers have UID mapping issues with NFS that cause permission errors when PBS tries to write chunks. I learned this the hard way — the proxy service failed to start, and chunk uploads got `ENOENT` errors because the `.chunks` subdirectories had wrong ownership.

### Datastore on NAS

The actual backup data lives on the NAS, mounted into the PBS container via NFS:

```bash
# On the Proxmox host:
pct set <CT_ID> -mp0 /mnt/pve/NAS/pbs-datastore,mp=/mnt/datastore/nas,backup=0

# Inside the PBS container:
proxmox-backup-manager datastore create nas /mnt/datastore/nas
```

This gives PBS access to the NAS storage pool, shared with VM images.

### Namespaces for Multi-Site

Both sites happened to have a VM with the same VMID (100). PBS identifies backups by type and VMID, so these would collide in the same namespace.

The fix: **PBS namespaces**. Each site gets its own:

```bash
# Create namespaces
proxmox-backup-client namespace create primary --repository backup@pbs@pbs-host:nas
proxmox-backup-client namespace create remote --repository backup@pbs@pbs-host:nas

# Configure storage on each PVE node
pvesm set pbs-nas --namespace primary   # on primary site nodes
pvesm set pbs-nas --namespace remote    # on remote site node
```

Namespaces are just subdirectories on disk. If you ever need to rebuild PBS, it auto-discovers them.

### Firewall Rules

The primary site firewall blocks inbound traffic from the remote LAN by default (site-to-site policy). A specific rule allows the remote Proxmox node to reach PBS on port 8007:

```
/ip firewall filter add chain=forward action=accept protocol=tcp \
  src-address=<REMOTE_PVE_IP> dst-address=<PBS_IP> dst-port=8007 \
  in-interface="vpn[wireguard]" \
  comment="S2S: remote proxmox -> PBS backup (8007)"
```


## The First Backup — Pain

The initial full backup of the remote Home Assistant VM took **9 hours** over the ADSL link:

```
INFO: scsi0: dirty-bitmap status: created new
INFO:   0% (180.0 MiB of 32.0 GiB) in 3s, read: 60.0 MiB/s, write: 49.3 MiB/s
...
INFO: 100% (32.0 GiB of 32.0 GiB) in 9h 17m
```

32 GiB disk image, squeezed through 733 Kbit/s. This is the price of admission. I ran it overnight.

## The Incremental — Magic

The next backup, hours later:

```
INFO: efidisk0: dirty-bitmap status: OK (drive clean)
INFO: scsi0: dirty-bitmap status: OK (512.0 MiB of 32.0 GiB dirty)
INFO: using fast incremental mode (dirty-bitmap), 512.0 MiB dirty of 32.0 GiB total
...
INFO: backup was done incrementally, reused 31.50 GiB (98%)
INFO: transferred 512.00 MiB in 1806 seconds (290.3 KiB/s)
INFO: Finished Backup of VM 100 (00:30:09)
```

**30 minutes.** 98% reused. Only 512 MB of dirty blocks transferred instead of 32 GB. The dirty bitmap told PBS exactly which blocks changed — no need to read or hash the entire disk.

A small DNS container (2GB disk) took **39 seconds** with 97.3% reuse.

## The Primary Site — Bonus

While I was at it, I switched the primary site backups from vzdump to PBS too. These run over 2.5GbE LAN so speed isn't the issue — but deduplication is:

| Before (vzdump) | After (PBS) |
|---|---|
| 4.6 TB backup storage | ~400-500 GB |
| Full copy every night | Incremental, 92-99% reuse |
| No cross-VM dedup | Shared chunk store |
| 12 TB free on NAS | 17 TB free on NAS |

Every daily backup of every VM on the primary site now completes in under 5 minutes total. The largest VM (132GB across two disks) finishes in 23 seconds with 98% reuse.

## Backup Schedule

| Site | Schedule | Targets | Mode |
|------|----------|---------|------|
| Primary | Daily 01:30 | 4 CTs (need clean shutdown) | Stop |
| Primary | Daily 02:00 | All other VMs/CTs | Snapshot |
| Remote | Daily 03:00 | All guests | Snapshot |

Retention: 7 daily, 4 weekly, 6 monthly, 2 yearly. With PBS dedup, this costs a fraction of what vzdump needed.

A monthly verification job runs automatically to check chunk integrity on the datastore.

## Disaster Recovery

If the PBS container dies:

1. Recreate the LXC (5 minutes with the community script)
2. Mount the NAS at the same path
3. Point the datastore at it

PBS reads the existing chunk store and indexes from disk. No database to restore, no metadata to rebuild. The backups are self-describing on the filesystem — namespaces are just subdirectories, chunks are content-addressed by SHA-256.

## Final Numbers

| Metric | Value |
|--------|-------|
| Total guests protected | 13 (across 3 nodes, 2 sites) |
| WAN link speed | 733 Kbit/s upload |
| First full backup (remote HA VM) | 9 hours |
| Daily incremental (remote HA VM) | 30 minutes |
| Daily incremental (remote DNS CT) | 39 seconds |
| Primary site daily backup (11 guests) | ~5 minutes total |
| Storage savings | 4.6 TB → ~500 GB |
| NAS space freed | ~4 TB |
| Dedup ratio | 92-99% per incremental |

The lesson: don't let a slow WAN link stop you from doing offsite backups. PBS with dirty bitmaps and block-level dedup makes it practical even over ADSL. The first backup hurts — every one after that is incremental.
