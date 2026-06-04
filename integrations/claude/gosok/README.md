# gosok Claude Code Plugin

A Claude Code plugin that lets Claude drive [gosok-terminal](https://github.com/cookieshake/gosok-terminal) via its CLI.

## What's inside

- `skills/gosok-cli/` — a single skill teaching Claude the `gosok` CLI surface and common workflows
- `hooks/stop-notify.sh` — pushes a `gosok notify` when Claude finishes a response
- `hooks/notification-notify.sh` — pushes a `gosok notify` when Claude needs user input / permission
- `hooks/session-start-context.sh` — injects current gosok server state into the session context

## Requirements

- The `gosok` binary on `PATH` (build with `make build` in the gosok-terminal repo)
- A running gosok server (`make dev` or `bin/gosok`) — optional; hooks silent-fail when it's down

## Install (local)

From the gosok-terminal repo root:

```
/plugin install ./integrations/claude/gosok
```

## Environment variables

| Variable | Default | Effect |
|----------|---------|--------|
| `GOSOK_API_URL` | `http://localhost:18435` | gosok server base URL |
| `GOSOK_TAB_ID` | (unset) | When set, `gosok send`/`inbox`/`wait` default to this tab |
| `GOSOK_PLUGIN_NOTIFY_ON_STOP` | `1` | Set to `0` to disable Stop → notify |
| `GOSOK_PLUGIN_NOTIFY_ON_INPUT` | `1` | Set to `0` to disable Notification → notify |
| `GOSOK_PLUGIN_SESSION_CONTEXT` | `1` | Set to `0` to disable SessionStart context injection |

## Troubleshooting

- **No notifications arrive:** check `command -v gosok` and `curl -fsS $GOSOK_API_URL/api/v1/projects`.
- **SessionStart block missing:** the server was unreachable within 1 s, or `GOSOK_PLUGIN_SESSION_CONTEXT=0`.
- **Hook errors visible in Claude:** they should not be — all hooks `|| true` their gosok calls. File a bug if you see one.
