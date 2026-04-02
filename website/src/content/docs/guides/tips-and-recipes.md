---
title: Tips & Recipes
description: Practical patterns and hook examples
---

## Git Hook: Queue Commits During Work Hours

If you want commits to appear as if they were made outside work hours, this `commit-msg` hook intercepts commits during business hours (weekdays 09:00-20:00) and queues them to a `_queue/{branch}` branch with a timestamp outside business hours.

The hook analyzes your branch's commit history to suggest a natural-looking time, or you can specify one manually.

### Setup

Save this as your global `commit-msg` hook:

```bash
# Set global hooks directory
git config --global core.hookspath ~/.git-hooks
mkdir -p ~/.git-hooks
```

Create `~/.git-hooks/commit-msg`:

```bash
#!/bin/sh
# Queue commits to _queue/{branch} during business hours (weekdays 09:00-20:00)

day=$(date +%u)   # 1=Mon, 7=Sun
hour=$(date +%H)

# Allow commits outside business hours
if [ "$day" -lt 1 ] || [ "$day" -gt 5 ] || [ "$hour" -lt 9 ] || [ "$hour" -ge 20 ]; then
  exit 0
fi

# Skip if already on a queue branch
branch=$(git symbolic-ref --short HEAD 2>/dev/null)
if [ -z "$branch" ]; then
  exit 0  # detached HEAD
fi
case "$branch" in _queue/*) exit 0 ;; esac

msg=$(cat "$1")
queue_branch="_queue/$branch"

# Analyze branch history for off-hours patterns
suggest_time() {
  off_hours=$(git log --format='%ad' --date=format:'%H' "$branch" 2>/dev/null \
    | awk '($1+0 < 9) || ($1+0 >= 20)' \
    | sort | uniq -c | sort -rn | head -5)

  if [ -n "$off_hours" ]; then
    peak_hour=$(echo "$off_hours" | head -1 | awk '{print $2}')
    peak_min=$(git log --format='%ad' --date=format:'%H:%M' "$branch" 2>/dev/null \
      | grep "^${peak_hour}:" | head -5 | awk -F: '{print $2}' | shuf -n1 2>/dev/null || echo "30")
    [ -z "$peak_min" ] && peak_min="30"
  else
    peak_hour="20"
    peak_min="30"
  fi

  if [ "$hour" -lt 20 ]; then
    if [ "$peak_hour" -ge 20 ]; then
      target_date=$(date +%Y-%m-%d)
    else
      target_date=$(date -v+1d +%Y-%m-%d 2>/dev/null || date -d "+1 day" +%Y-%m-%d)
    fi
  fi

  echo "${target_date} ${peak_hour}:${peak_min}:00"
}

suggested=$(suggest_time)

# Create commit on queue branch with the suggested timestamp
tree=$(git write-tree)
if git show-ref --verify --quiet "refs/heads/$queue_branch"; then
  parent=$(git rev-parse "$queue_branch")
else
  parent=$(git rev-parse HEAD)
fi

export GIT_AUTHOR_DATE="$suggested"
export GIT_COMMITTER_DATE="$suggested"
commit=$(echo "$msg" | git commit-tree "$tree" -p "$parent")
git update-ref "refs/heads/$queue_branch" "$commit"

echo ""
echo "  Commit queued to $queue_branch (time: $suggested)"
echo "  Checkout: git checkout $queue_branch"
echo "  Merge later: git checkout $branch && git merge $queue_branch && git branch -d $queue_branch"
echo ""
exit 1
```

```bash
chmod +x ~/.git-hooks/commit-msg
```

### How It Works

1. During work hours, `git commit` is intercepted
2. The hook creates the commit on `_queue/{branch}` with an off-hours timestamp
3. You checkout the queue branch to continue working: `git checkout _queue/main`
4. After work hours, merge back:

```bash
git checkout main
git merge _queue/main
git branch -d _queue/main
```

The timestamp suggestion is based on your most frequent off-hours commit times on the branch, so patterns look natural.

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
