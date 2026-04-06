# CLI Scenarios

### [SC.CLI.1] Project Management

**preconditions**:
- The gosok server is running

**scenarios**:

#### List all projects

- **Given** Projects have been created
- **When** The user runs `gosok ps`
- **Then** All projects are listed with their names and paths

#### Create a new project

- **When** The user runs `gosok project create my-project --path /home/user/project`
- **Then** The project is created and its details are printed

#### Update a project

- **Given** A project named "my-project" exists
- **When** The user runs `gosok project update {id} --name "new-name"`
- **Then** The project name is updated and the change is confirmed

#### Delete a project

- **Given** A project exists
- **When** The user runs `gosok project delete {id}`
- **Then** The project and its tabs are removed

**refs**:
- CLI.2

---

### [SC.CLI.2] Tab Management

**preconditions**:
- A project exists and the gosok server is running

**scenarios**:

#### List tabs in a project

- **Given** A project has several tabs
- **When** The user runs `gosok ls`
- **Then** All tabs are listed with their name, type, and running status

#### Create a new tab

- **When** The user runs `gosok tab create {pid} --name shell --type shell`
- **Then** A new tab is created in the project and its details are printed

#### Start and stop a tab

- **Given** A stopped tab exists
- **When** The user runs `gosok tab start {id}` then later `gosok tab stop {id}`
- **Then** The tab starts its process, and then the process is stopped

#### View terminal screen output

- **Given** A running tab has produced terminal output
- **When** The user runs `gosok screen {id}`
- **Then** The last screenful of terminal output (24 lines) is printed

#### Send input to a running tab

- **Given** A running tab exists
- **When** The user runs `gosok write {id} "echo hello"`
- **Then** The text is sent as input to the tab's terminal, as if the user typed it

**refs**:
- CLI.3

---

### [SC.CLI.3] Inter-Tab Communication

**preconditions**:
- Tabs exist in a project, `GOSOK_TAB_ID` is set for the current tab

**scenarios**:

#### Send a direct message to another tab

- **When** A process runs `gosok send {tabID} "hello"`
- **Then** The message is delivered to the specified tab's inbox

#### Broadcast a message to all tabs

- **When** A process runs `gosok send --all "hello all"`
- **Then** All tabs receive the message in their inbox

#### Check inbox for incoming messages

- **When** A process runs `gosok inbox`
- **Then** All direct and broadcast messages for the current tab are printed

#### Check the global feed

- **When** A process runs `gosok feed`
- **Then** Global messages are printed

#### Post a global message

- **When** A process runs `gosok feed "hello world"`
- **Then** The message is posted to the global feed

#### Wait for an incoming message

- **When** A process runs `gosok wait --timeout 5s`
- **Then** The command blocks until a message arrives or 5 seconds elapse, then exits

#### Mark messages as read

- **When** A process runs `gosok inbox read`
- **Then** Inbox messages are marked as read and the unread indicator clears

**refs**:
- CLI.4

---

### [SC.CLI.4] Notifications and Settings

**scenarios**:

#### Send a notification from a tab process

- **When** A process runs `gosok notify "Done"`
- **Then** A notification appears in the Web UI for all connected users

#### List all settings

- **When** The user runs `gosok setting list`
- **Then** All current settings and their values are printed

#### Set, get, and delete a setting

- **When** The user runs `gosok setting set font_size 16`
- **Then** The setting is saved
- **When** The user runs `gosok setting get font_size`
- **Then** The value `16` is printed
- **When** The user runs `gosok setting delete font_size`
- **Then** The setting is removed and the default value is restored

**refs**:
- CLI.5
