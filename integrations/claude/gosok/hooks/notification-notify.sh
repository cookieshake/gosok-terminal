#!/usr/bin/env bash
# Notification hook: forward Claude's user-input/permission prompts to gosok notify.
# Silent-fail.

[ "${GOSOK_PLUGIN_NOTIFY_ON_INPUT:-1}" = "0" ] && exit 0

payload=$(cat 2>/dev/null || true)

command -v gosok >/dev/null 2>&1 || exit 0

# Best-effort message extraction. Tries common field names. Falls back to a fixed string.
msg=$(printf '%s' "$payload" \
  | python3 -c '
import json, sys
try:
    d = json.loads(sys.stdin.read() or "{}")
except Exception:
    d = {}
for k in ("message", "body", "text", "description"):
    v = d.get(k)
    if isinstance(v, str) and v.strip():
        print(v.strip()[:200])
        break
else:
    print("Claude is waiting for input")
' 2>/dev/null)

[ -z "$msg" ] && msg="Claude is waiting for input"

gosok notify "input needed" --body "$msg" --flag >/dev/null 2>&1 || true
exit 0
