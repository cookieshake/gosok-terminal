# CLI

### [CLI.1] CLI Overview

**rules**:
- The gosok binary MUST support CLI subcommands as top-level commands.
- CLI commands MUST call the REST API on localhost.
- The API URL MUST be determined from `GOSOK_API_URL` environment variable or default to `http://localhost:18435`.

---

### [CLI.2] Project Commands

**rules**:
- `gosok ps` (alias: `gosok projects`) MUST list all projects.
- `gosok project create <name> --path <dir>` MUST create a project. The name is a positional argument.
- `gosok project update` MUST update a project by ID.
- `gosok project delete` MUST delete a project by ID.

---

### [CLI.3] Tab Commands

**rules**:
- `gosok ls` (alias: `gosok tabs`) MUST list all tabs for a project.
- `gosok tab create` MUST create a tab with `--name`, `--type`, and optional `--command`, `--args`.
- `gosok tab start` MUST start a tab by ID.
- `gosok tab stop` MUST stop a tab by ID.
- `gosok tab update` MUST update a tab by ID.
- `gosok tab delete` MUST delete a tab by ID.
- `gosok screen` MUST print the last N lines of terminal output (top-level command).
- `gosok write` MUST write text to a tab's PTY stdin (top-level command).

---

### [CLI.4] Message Commands

**rules**:
- `gosok send <tab-id> <message>` MUST send a direct message to the specified tab. `gosok send --all <message>` MUST broadcast a message to all tabs.
- `gosok feed [message]` MUST post a global message when a message argument is provided, or display the global feed when no argument is given (top-level command).
- `gosok inbox [tab-id]` MUST display the tab's inbox (top-level command). Defaults to `$GOSOK_TAB_ID`.
- `gosok inbox read [tab-id]` MUST mark the tab's inbox as read (top-level command).
- `gosok wait [--timeout <duration>] [tab-id]` MUST block until a new message arrives or timeout (top-level command).

---

### [CLI.5] Other Commands

**rules**:
- `gosok notify <title>` MUST send a notification. The title is a positional argument. Supports `--body` and `--flag` options.
- `gosok setting list` MUST list all settings.
- `gosok setting get` MUST get a setting by key.
- `gosok setting set` MUST set a setting value.
- `gosok setting delete` MUST delete a setting.
