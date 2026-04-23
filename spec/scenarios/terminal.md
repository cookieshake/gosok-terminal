# Terminal Scenarios

### [SC.TERM.1] Terminal Session Lifecycle

**scenarios**:

#### User starts a tab and sees terminal output

- **Given** The user has created a project with a shell command
- **When** The user starts the tab
- **Then** The terminal displays a live shell prompt and accepts keyboard input

#### Terminal shows process exit

- **Given** A tab is running a command (e.g., `echo hello`)
- **When** The command finishes executing
- **Then** The terminal displays the command output and indicates that the process has exited

#### User sees output stop when tab is destroyed

- **Given** A tab is running a long-lived process
- **When** The user destroys the tab
- **Then** The terminal stops producing output and the session is no longer available

**refs**:
- TERM.1

---

### [SC.TERM.2] Scrollback and Output Replay

**scenarios**:

#### User reconnects and sees previous output

- **Given** A tab has been running and producing output
- **When** The user navigates away and returns to the tab
- **Then** The terminal displays all previous output (scrollback) so the user can review what happened

#### User reconnects after a long time and gets full replay

- **Given** A tab has produced a large amount of output over time
- **When** The user reopens the terminal after being away for an extended period
- **Then** The terminal replays as much previous output as possible so the user can catch up

#### Output consistency under heavy load

- **Given** A tab is running a command that produces rapid continuous output (e.g., `yes` or a build log)
- **When** The user watches the terminal in real time
- **Then** The output appears in order without corruption or missing lines

**refs**:
- TERM.2

---

### [SC.TERM.3] Output Recovery and Multi-Viewer

**scenarios**:

#### User on slow connection misses some output, then reconnects and catches up

- **Given** A tab is producing output while the user has a degraded network connection
- **When** The user's connection recovers or they refresh the page
- **Then** The terminal replays any output the user missed, allowing them to catch up

#### Multiple users viewing the same terminal

- **Given** A tab is running a process
- **When** Two users open the same tab in separate browser windows
- **Then** Both users see the same terminal output independently and in real time

**refs**:
- TERM.3, WS.3

---

### [SC.TERM.4] Terminal Resize

**scenarios**:

#### User resizes browser window and terminal adjusts

- **Given** A terminal tab is open and displaying output
- **When** The user resizes their browser window or the terminal pane
- **Then** The terminal adjusts its columns and rows to fit the new size, and subsequent output wraps correctly

**refs**:
- TERM.4

---

### [SC.TERM.5] Keyboard Shortcuts Routing

**scenarios**:

#### macOS user uses Cmd+F to search the page

- **Given** The user is on macOS with a terminal tab open
- **When** The user presses `Cmd+F`
- **Then** The browser's find-in-page dialog opens instead of sending the keystroke to the terminal

#### macOS user uses Ctrl+A to jump to line start

- **Given** The user is on macOS with a shell running in the terminal
- **When** The user presses `Ctrl+A`
- **Then** The cursor moves to the beginning of the current line (readline behavior)

#### Windows user uses Ctrl+F to search the page

- **Given** The user is on Windows with a terminal tab open
- **When** The user presses `Ctrl+F`
- **Then** The browser's find-in-page dialog opens instead of sending the keystroke to the terminal

#### Windows user uses Ctrl+A to jump to line start

- **Given** The user is on Windows with a shell running in the terminal
- **When** The user presses `Ctrl+A`
- **Then** The cursor moves to the beginning of the current line (readline behavior)

#### User copies selected text with Ctrl+C / Cmd+C

- **Given** The user has selected text in the terminal
- **When** The user presses `Ctrl+C` (Windows/Linux) or `Cmd+C` (macOS)
- **Then** The selected text is copied to the clipboard and no SIGINT is sent

#### User sends SIGINT with Ctrl+C when nothing is selected

- **Given** The user has no text selected in the terminal
- **When** The user presses `Ctrl+C`
- **Then** SIGINT is sent to the foreground process

**refs**:
- TERM.5

---

### [SC.TERM.6] Mobile Keyboard Behavior

**scenarios**:

#### User taps terminal to open the keyboard

- **Given** The user is on a mobile device with a terminal tab open
- **When** The user taps the terminal area
- **Then** The soft keyboard appears and the terminal accepts text input

#### Terminal resizes when keyboard opens

- **Given** The user is on a mobile device with a terminal tab open
- **When** The soft keyboard opens
- **Then** The terminal shrinks to fit the remaining visible area and rerenders correctly

#### Layout snaps back when keyboard closes

- **Given** The user is on a mobile device and the soft keyboard is open
- **When** The user dismisses the soft keyboard
- **Then** The terminal expands back to full height and the page scroll position resets to the top

**refs**:
- TERM.6
