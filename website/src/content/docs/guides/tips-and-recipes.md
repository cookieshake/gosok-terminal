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

gosok binds to `0.0.0.0` (all interfaces) by default, so it is reachable from the network — but it has **no built-in authentication**. Never expose it directly to untrusted networks.

### SSH Tunnel (Recommended)

The simplest and most secure approach. Run gosok on the remote server listening on localhost, then tunnel from your machine:

```bash
# On the remote server
GOSOK_PORT=18435 ./gosok

# On your local machine
ssh -L 18435:localhost:18435 user@remote-server
```

Open `http://localhost:18435` in your local browser. All traffic is encrypted through SSH.

To keep the tunnel in the background:

```bash
ssh -fNL 18435:localhost:18435 user@remote-server
```

### Reverse Proxy with TLS

For team access, put gosok behind a reverse proxy that handles TLS and authentication.

**Caddy** (automatic HTTPS):

```
gosok.example.com {
    basicauth {
        admin $2a$14$... # caddy hash-password
    }
    reverse_proxy localhost:18435
}
```

**nginx**:

```nginx
server {
    listen 443 ssl;
    server_name gosok.example.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        auth_basic "gosok";
        auth_basic_user_file /etc/nginx/.htpasswd;

        proxy_pass http://localhost:18435;
        proxy_http_version 1.1;

        # WebSocket support (required for terminal I/O)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

:::caution
WebSocket proxying is required. Without the `Upgrade` / `Connection` headers, terminal sessions will not connect.
:::

### Docker with Port Binding

Bind to a specific interface to limit exposure:

```bash
# Only accessible from localhost
docker run -p 127.0.0.1:18435:18435 -v gosok-data:/data gosok-terminal

# Accessible from all interfaces (use with a firewall)
docker run -p 18435:18435 -v gosok-data:/data gosok-terminal
```
