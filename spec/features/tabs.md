# Tabs

### [TAB.1] Tab Definition

**rules**:
- A tab MUST belong to a project.
- A tab MUST have a `tab_type`.
- Valid tab types include `shell` and `editor` (hardcoded), plus any types defined in the `ai_tools` settings. Validation depends on the current ai_tools configuration.
- Tabs MUST be ordered by `sort_order` ascending within a project.
- A tab MAY have a custom `command` and `args` that override the default for its type.
- A tab MAY have custom `env` variables (key-value pairs).
- A tab MAY have a dynamic `title` set by OSC escape sequences from the running process.

**fields**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| project_id | ULID | Y | Parent project ID |
| name | string | Y | Tab display name |
| tab_type | string | Y | Tab type (shell, editor, or any type from ai_tools settings) |
| command | string | - | Custom command (overrides type default) |
| args | string[] | - | Command arguments (JSON array) |
| env | object | - | Custom environment variables (JSON object) |
| sort_order | integer | Y | Display order within project |
| title | string | - | Dynamic title from OSC sequences |

**auto**:

| Name | Type | Description |
|------|------|-------------|
| id | ULID | Primary key |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update time |

**errors**:
- Invalid tab_type → 400 Bad Request
- Parent project not found → 404 Not Found
- Tab not found → 404 Not Found

**refs**:
- PROJ.1 (parent project)

---

### [TAB.2] Tab Lifecycle

**rules**:
- A tab MUST start in `stopped` status.
- `POST .../start` MUST transition status from `stopped` to `running`.
- `POST .../stop` MUST send SIGINT (os.Interrupt) to the PTY process and transition to `stopped`.
- `POST .../restart` MUST stop then start the tab.
- Starting a tab MUST create a PTY session and return its session ID.
- Stopping a tab MUST destroy the PTY session.
- When a PTY process exits on its own, the tab status MUST transition to `stopped`.

**lifecycle**:

| State | Transition | Next State | Condition |
|-------|-----------|------------|-----------|
| stopped | start | running | PTY session created successfully |
| running | stop | stopped | SIGINT sent, process terminated |
| running | exit | stopped | Process exited on its own |
| running | restart | running | Stop then start |

**notes**:
- Starting an already running tab MUST return the current status (no error).
- Stopping an already stopped tab MUST return successfully (no error).

**refs**:
- TERM.1 (PTY session)

---

### [TAB.3] Tab Environment Injection

**rules**:
- When a tab starts, the system MUST inject the following environment variables: `GOSOK_TAB_ID`, `GOSOK_TAB_NAME`, `GOSOK_PROJECT_NAME`, `GOSOK_API_URL`, `GOSOK_BIN`.
- Custom `env` from the tab definition MUST be merged into the process environment.
- AI tool paths MUST be prepended to `PATH`.

**refs**:
- TAB.1 (env field)
- TAB.2 (start transition)

---

### [TAB.4] Tab CRUD

**rules**:
- `GET /api/v1/projects/{pid}/tabs` MUST return all tabs for the project, ordered by `sort_order`.
- `POST /api/v1/projects/{pid}/tabs` MUST create a new tab in the project.
- `GET /api/v1/tabs/{id}` MUST return the tab with status information.
- `PUT /api/v1/tabs/{id}` MUST update the tab fields.
- `DELETE /api/v1/tabs/{id}` MUST stop the tab (if running) and delete it.
- Tab listing MUST include current `TabStatus` (status, session_id, last_activity).

**refs**:
- TAB.1 (tab definition)
- TAB.2 (lifecycle)

---

### [TAB.5] Tab Reorder

**rules**:
- `PUT /api/v1/tabs/reorder` MUST accept an ordered list of tab IDs.
- The server MUST update `sort_order` for each tab based on its position in the list.

**fields**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| ids | string[] | Y | Ordered list of tab IDs |

**refs**:
- TAB.1 (sort_order field)

---

### [TAB.6] Tab Write

**rules**:
- `POST /api/v1/tabs/{id}/write` MUST write input to the tab's PTY stdin.
- The request body MUST be JSON with an `input` field: `{"input": "..."}`.
- The tab MUST be in `running` status.

**errors**:
- Tab not found → 404 Not Found

**refs**:
- TAB.2 (running status)
- TERM.1 (PTY session)

---

### [TAB.7] Tab Screen

**rules**:
- `GET /api/v1/tabs/{id}/screen` MUST return the last N lines of terminal output.
- The `lines` query parameter controls how many lines to return (default: 24).
- The `bytes` query parameter MAY be used instead to request by byte count.

**refs**:
- TERM.2 (ring buffer)
