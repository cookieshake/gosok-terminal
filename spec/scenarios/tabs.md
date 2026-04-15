# Tab Scenarios

### [SC.TAB.1] Tab CRUD

**preconditions**:
- A project exists

**scenarios**:

#### [Web UI] Create a tab

- **Given** The user is viewing a project
- **When** The user clicks "Add Tab" and enters name "shell-1" with type "shell"
- **Then** A new tab "shell-1" appears in the project's tab bar

#### [CLI] Create a tab

- **Given** A project exists
- **When** The user runs `gosok tab create <project-id> --name shell-1 --type shell`
- **Then** The CLI confirms the tab was created and displays its name and ID

#### [Web UI] Create a tab with unrecognized type

- **Given** The user is viewing a project
- **When** The user creates a tab with an unrecognized type
- **Then** The tab is created but AI tool injection settings are not applied for the unrecognized type

#### [Web UI] View tabs in a project

- **Given** A project has tabs "t1" and "t2"
- **When** The user selects the project in the sidebar
- **Then** Both tabs appear in the tab bar ordered by their configured sort order, each showing its current status (running/stopped)

#### [CLI] List tabs

- **Given** A project has tabs "t1" and "t2"
- **When** The user runs `gosok ls <project-id>`
- **Then** The CLI outputs the tabs in sort order with their names and statuses

#### [Web UI] Select a tab

- **Given** A project has multiple tabs
- **When** The user clicks on a tab in the tab bar
- **Then** The terminal pane switches to show that tab's content and the selected tab is visually highlighted

#### [Web UI] Rename a tab

- **Given** A tab exists with name "old"
- **When** The user edits the tab name to "new" in the UI
- **Then** The tab bar updates to show "new"

#### [CLI] Update a tab

- **Given** A tab exists with name "old"
- **When** The user runs `gosok tab update <id> --name new`
- **Then** The CLI confirms the tab was renamed

#### [Web UI] Delete a stopped tab

- **Given** A stopped tab exists
- **When** The user deletes the tab from the UI
- **Then** The tab disappears from the tab bar

#### [Web UI] Delete a running tab

- **Given** A running tab exists
- **When** The user deletes the tab from the UI
- **Then** The tab is stopped and then removed from the tab bar

#### [CLI] Delete a tab

- **Given** A tab exists (running or stopped)
- **When** The user runs `gosok tab delete <id>`
- **Then** If running, the tab is stopped first; the CLI confirms the tab was deleted

**refs**:
- TAB.1, TAB.4

---

### [SC.TAB.2] Tab Lifecycle

**preconditions**:
- A project and a stopped tab exist

**scenarios**:

#### [Web UI] Start a tab

- **Given** A tab shows "stopped" status
- **When** The user clicks the "Start" button for the tab
- **Then** The tab status indicator changes to "running" and the terminal pane shows an active session

#### [CLI] Start a tab

- **Given** A tab is stopped
- **When** The user runs `gosok tab start <id>`
- **Then** The CLI confirms the tab is now running with a session ID

#### Start an already running tab

- **Given** A tab is already running
- **When** The user attempts to start it again (via Web UI or CLI)
- **Then** No error occurs; the tab remains running (idempotent)

#### [Web UI] Stop a tab

- **Given** A tab shows "running" status
- **When** The user clicks the "Stop" button for the tab
- **Then** The tab status indicator changes to "stopped" and the terminal session ends

#### [CLI] Stop a tab

- **Given** A tab is running
- **When** The user runs `gosok tab stop <id>`
- **Then** The CLI confirms the tab is now stopped

#### Stop an already stopped tab

- **Given** A tab is already stopped
- **When** The user attempts to stop it again (via Web UI or CLI)
- **Then** No error occurs; the tab remains stopped (idempotent)

#### [Web UI] Restart a tab

- **Given** A tab shows "running" status
- **When** The user clicks the "Restart" button for the tab
- **Then** The tab briefly transitions and returns to "running" with a fresh terminal session

#### Process exits on its own

- **Given** A tab is running a process that exits (e.g., a script completes)
- **When** The process terminates
- **Then** The tab status automatically transitions to "stopped" and the Web UI reflects this change

**refs**:
- TAB.2

---

### [SC.TAB.3] Tab Reorder

**preconditions**:
- A project with three tabs exists

**scenarios**:

#### [Web UI] Drag to reorder tabs

- **Given** Tabs A, B, C appear in the tab bar in that order
- **When** The user drags tab C before tab A
- **Then** The tab bar updates to show order C, A, B and the order persists on refresh

**refs**:
- TAB.5

---

### [SC.TAB.4] Tab Write

**preconditions**:
- A running tab exists

**scenarios**:

#### [Web UI] Type in the terminal

- **Given** A tab is running and the user has selected it
- **When** The user types `ls` and presses Enter in the terminal pane
- **Then** The command is sent to the running process and the output appears in the terminal

#### [CLI] Write to a running tab

- **Given** A tab is running
- **When** The user runs `gosok write <id> "ls\n"`
- **Then** The text is sent to the tab's process and the CLI confirms the write

#### [CLI] Write to a stopped tab

- **Given** A tab is stopped
- **When** The user runs `gosok write <id> "ls\n"`
- **Then** The CLI shows an error indicating no active session exists

**refs**:
- TAB.6

---

### [SC.TAB.5] Tab Screen

**scenarios**:

#### [CLI] Read recent terminal output by lines

- **Given** A running tab has produced output
- **When** The user runs `gosok screen <id> --lines 10`
- **Then** The CLI displays the last 10 lines of terminal output

#### [CLI] Read recent terminal output by bytes

- **Given** A running tab has produced output
- **When** The user runs `gosok screen <id> --bytes 1024`
- **Then** The CLI displays the last 1024 bytes of terminal output

#### [Web UI] View terminal output

- **Given** A tab is running and producing output
- **When** The user selects the tab in the Web UI
- **Then** The terminal pane shows the live output including scrollback history

**refs**:
- TAB.7

---

### [SC.TAB.6] Tab Environment Injection

**preconditions**:
- A tab exists in a project

**scenarios**:

#### Environment variables available in tab process

- **Given** A tab is started (via Web UI or CLI)
- **When** The user runs `env` in the terminal
- **Then** The output includes `GOSOK_TAB_ID`, `GOSOK_TAB_NAME`, and other gosok-specific environment variables

**refs**:
- TAB.2

---

### [SC.TAB.7] Tab Dynamic Title Update

**scenarios**:

#### [CLI] Update tab title dynamically

- **Given** A tab exists
- **When** A process inside the tab (or an external script) updates the tab title to "new-title" via `gosok tab title <id> "new-title"`
- **Then** The tab's display name in the Web UI tab bar updates to "new-title"

#### [Web UI] See dynamic title change

- **Given** A tab is visible in the tab bar
- **When** A running process inside the tab programmatically updates the tab title
- **Then** The tab bar reflects the new title in real time without requiring a refresh

**refs**:
- TAB.1
