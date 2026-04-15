# Settings

### [SET.1] Setting

**rules**:
- Settings are key-value pairs with JSON values.
- `GET /api/v1/settings` MUST return all settings.
- `GET /api/v1/settings/{key}` MUST return the setting value. If not set, it MUST fall back to the default value.
- `PUT /api/v1/settings/{key}` MUST create or update the setting.
- `DELETE /api/v1/settings/{key}` MUST reset the setting to its default by deleting the user override.
- The system MUST define default values for known settings.

**fields**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| key | string | Y | Setting identifier |
| value | JSON | Y | Setting value (any valid JSON) |

**auto**:

| Name | Type | Description |
|------|------|-------------|
| updated_at | timestamp | Last update time |

---

### [SET.2] Default Settings

**rules**:
- Default settings MUST be seeded into the database on first run.
- Defaults include shortcut definitions for AI tools.
- When a setting is read and no user override exists, the default MUST be returned.
- When a setting is deleted, the default MUST become active again.

**notes**:
Known default settings include shortcuts for launching AI coding tools (e.g., Claude Code with `--dangerously-skip-permissions` flag).

**refs**:
- SET.1 (setting CRUD)

---

### [SET.3] Shortcuts Setting

**rules**:
- The `shortcuts` key MUST store a JSON array of shortcut objects.
- Each shortcut MUST have `label` (string), `command` (string), and `enabled` (boolean) fields.
- Each shortcut MAY have an `appendEnter` (boolean) field. When `true`, a newline MUST be appended to the command before execution.
- The Shortcuts settings UI MUST display shortcuts in a table with columns: reorder, label, command, appendEnter toggle, enabled toggle, delete.
- Changes MUST be staged locally and only persisted when the user explicitly saves.
- The save button MUST only be active when there are unsaved changes.

**fields**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| label | string | Y | Display name shown on the shortcut button |
| command | string | Y | Shell command to execute |
| enabled | boolean | Y | Whether the shortcut button is visible in the tab bar |
| appendEnter | boolean | - | If true, a newline is appended to the command on execution |

**refs**:
- SET.1 (setting CRUD)
- SET.2 (defaults)
