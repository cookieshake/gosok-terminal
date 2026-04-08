---
title: Tips & Recipes
description: Practical patterns for using gosok
---

## Accessing gosok Remotely

gosok는 기본적으로 `127.0.0.1`에만 바인딩되어 외부 접근이 차단됩니다. 원격에서 접근하려면 VPN을 통해 연결하고, `GOSOK_HOST`를 변경하세요.

### Tailscale

```bash
GOSOK_HOST=0.0.0.0 ./gosok
```

Tailscale이 설치되어 있다면 `http://<tailscale-ip>:18435`로 바로 접근할 수 있습니다.

HTTPS가 필요하면 [Tailscale Serve](https://tailscale.com/kb/1312/serve)를 사용해 보세요:

```bash
tailscale serve --bg 18435
# https://<machine-name>.<tailnet>.ts.net
```

### WireGuard

WireGuard 터널이 구성되어 있다면:

```bash
wg-quick up wg0
GOSOK_HOST=0.0.0.0 ./gosok
# http://<wireguard-ip>:18435
```
