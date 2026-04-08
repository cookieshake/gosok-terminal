---
title: Tips & Recipes
description: Practical patterns for using gosok
---

## Accessing gosok Remotely

gosok has **no built-in authentication**, so the recommended way to access it remotely is through a VPN like Tailscale or WireGuard. The VPN handles encryption and access control — gosok just listens on its normal port.

### Tailscale

Install Tailscale on both the server and your device. gosok is then reachable at the server's Tailscale IP with no extra configuration:

```bash
# On the server
./gosok   # listens on :18435 as usual
```

Open `http://<tailscale-ip>:18435` from any device on your tailnet.

To use a friendly hostname with HTTPS, enable [Tailscale Serve](https://tailscale.com/kb/1312/serve):

```bash
tailscale serve --bg 18435
```

This makes gosok available at `https://<machine-name>.<tailnet>.ts.net` with automatic TLS.

### WireGuard

Set up a WireGuard tunnel between your devices. Once the tunnel is up, access gosok at the server's WireGuard IP:

```ini
# Server wg0.conf (excerpt)
[Interface]
Address = 10.0.0.1/24
ListenPort = 51820
PrivateKey = <server-private-key>

[Peer]
PublicKey = <client-public-key>
AllowedIPs = 10.0.0.2/32
```

```bash
# Start WireGuard, then run gosok
wg-quick up wg0
./gosok
```

Open `http://10.0.0.1:18435` from the client device.
