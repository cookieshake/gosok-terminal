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
