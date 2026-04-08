---
title: Tips & Recipes
description: Practical patterns for using gosok
---

## Accessing gosok Remotely

gosok binds to `127.0.0.1` by default, blocking external access. To connect remotely, use a VPN and set `GOSOK_HOST=0.0.0.0`.

### Tailscale

```bash
GOSOK_HOST=0.0.0.0 ./gosok
```

With Tailscale installed, open `http://<tailscale-ip>:18435` from any device on your tailnet.

For HTTPS, try [Tailscale Serve](https://tailscale.com/kb/1312/serve):

```bash
tailscale serve --bg 18435
# https://<machine-name>.<tailnet>.ts.net
```

### WireGuard

With a WireGuard tunnel set up:

```bash
wg-quick up wg0
GOSOK_HOST=0.0.0.0 ./gosok
# http://<wireguard-ip>:18435
```
