#!/usr/bin/env bash
# SessionStart hook: inject a short status block describing gosok server state
# and current projects/tabs. Output goes to stdout and becomes part of Claude's
# initial context. Silent-fail: any error suppresses the whole block.

[ "${GOSOK_PLUGIN_SESSION_CONTEXT:-1}" = "0" ] && exit 0

api="${GOSOK_API_URL:-http://localhost:18435}"

# Discard stdin payload.
cat >/dev/null 2>&1 || true

projects_json=$(curl -fsS --max-time 2 "$api/api/v1/projects" 2>/dev/null) || {
  echo "gosok server not reachable at $api — start it with \`make dev\` or \`bin/gosok\` to enable tab control."
  exit 0
}

tabs_json=$(printf '%s' "$projects_json" \
  | python3 -c '
import json, sys, urllib.request
api = "'"$api"'"
try:
    projects = json.loads(sys.stdin.read())
except Exception:
    projects = []
out = []
for p in projects[:10]:
    pid = p.get("id", "")
    name = p.get("name") or p.get("path", "")
    try:
        with urllib.request.urlopen(f"{api}/api/v1/projects/{pid}/tabs", timeout=2) as r:
            tabs = json.loads(r.read())
    except Exception:
        tabs = []
    out.append((name, len(tabs)))
for name, count in out:
    print(f"- {name}: {count} tab(s)")
' 2>/dev/null)

cat <<EOF
gosok server reachable at $api.

Projects:
${tabs_json:-  (none)}

Use the \`gosok-cli\` skill to drive tabs and messages.
EOF

exit 0
