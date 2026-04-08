---
title: Tips & Recipes
description: Practical patterns for using gosok
---

## Using gosok as a CI/CD Dashboard

You can use gosok tabs to monitor multiple processes at once:

```bash
proj=$(gosok project create deploy --path /app | awk '{print $2}')

# Create tabs for each step
build=$(gosok tab create $proj --name build | awk '{print $2}')
test=$(gosok tab create $proj --name test | awk '{print $2}')
deploy=$(gosok tab create $proj --name deploy | awk '{print $2}')

gosok tab start $build
gosok tab start $test
gosok tab start $deploy

# Kick off the pipeline
gosok msg send $build "make build && gosok msg send $test 'run tests'"
```

Open gosok in your browser and watch all three tabs live.

## Periodic Health Checks with Messaging

Use `msg wait` in a loop to build a simple poll-and-respond pattern:

```bash
# In one tab: responder
while true; do
  msg=$(gosok msg wait --timeout 300s)
  if [ $? -eq 0 ]; then
    # Process the message
    echo "Received: $msg"
    gosok notify "Processed" --body "$msg"
  fi
done
```

```bash
# From another tab: sender
gosok msg send <responder-tab-id> "check disk usage"
```

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
