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
