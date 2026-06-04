#!/usr/bin/env bash
# Stop hook: push a gosok notification when Claude finishes a response.
# Silent-fail: never block Claude if gosok is missing or unreachable.

[ "${GOSOK_PLUGIN_NOTIFY_ON_STOP:-1}" = "0" ] && exit 0

# Discard the stdin payload — we do not currently use any field from it.
cat >/dev/null 2>&1 || true

command -v gosok >/dev/null 2>&1 || exit 0

title=$(basename "$PWD")
gosok notify --body "Claude 응답 완료" --flag "$title" >/dev/null 2>&1 || true
exit 0
