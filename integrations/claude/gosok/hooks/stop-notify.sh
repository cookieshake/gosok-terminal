#!/usr/bin/env bash
# Stop hook: push a gosok notification when Claude finishes a response.
# Extracts the stop reason + last-assistant summary from the payload when
# available; otherwise sends a plain status. Silent-fail throughout.

[ "${GOSOK_PLUGIN_NOTIFY_ON_STOP:-1}" = "0" ] && exit 0

command -v gosok >/dev/null 2>&1 || exit 0

payload=$(cat 2>/dev/null || echo '{}')

# Claude Code Stop payload looks like:
#   {"stop_hook_reason": "end_turn"|"stop_tool_use", "cwd": "...", "transcript_path": "..."}
# Transcripts are JSONL — read in reverse to find the last assistant message.
parsed=$(printf '%s' "$payload" | python3 -c '
import json, os, sys

def field(d, *keys):
    for k in keys:
        v = d.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""

try:
    payload = json.loads(sys.stdin.read() or "{}")
except Exception:
    payload = {}

reason = field(payload, "stop_hook_reason", "reason") or "end_turn"
project = os.path.basename(field(payload, "cwd"))

summary = ""
tp = field(payload, "transcript_path")
if tp and os.path.exists(tp):
    try:
        with open(tp, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
        for line in reversed(lines):
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except Exception:
                continue
            msg = entry.get("message") or entry
            if msg.get("role") != "assistant":
                continue
            content = msg.get("content", "")
            texts = []
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        texts.append(block.get("text", ""))
            elif isinstance(content, str):
                texts.append(content)
            text = "\n".join(t for t in texts if t.strip())
            for raw in text.splitlines():
                raw = raw.strip()
                if raw and not raw.startswith("#"):
                    summary = raw[:120]
                    break
            if summary:
                break
    except Exception:
        pass

def flat(s):
    return s.replace("\t", " ").replace("\n", " ")

print(f"{flat(reason)}\t{flat(project)}\t{flat(summary)}")
' 2>/dev/null)

IFS=$'\t' read -r REASON PROJECT SUMMARY <<<"$parsed"
REASON="${REASON:-end_turn}"
[ -z "$PROJECT" ] && PROJECT=$(basename "$PWD")

case "$REASON" in
  end_turn)      status="💬 입력 대기" ;;
  stop_tool_use) status="✅ 작업 완료" ;;
  *)             status="⚠️ $REASON" ;;
esac

body="$status"
[ -n "$SUMMARY" ] && body="$status"$'\n'"$SUMMARY"

gosok notify "Claude [$PROJECT]" --body "$body" --flag >/dev/null 2>&1 || true
exit 0
