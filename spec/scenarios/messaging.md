# Messaging Scenarios

### [SC.MSG.1] Send Message

**preconditions**:
- A project with tabs "tab-a" and "tab-b" exists

**scenarios**:

#### Send direct message to another tab

- **Given** Tab "tab-a" and "tab-b" exist in the same project
- **When** A process in "tab-a" runs `gosok send {tab-b-id} "hello"`
- **Then** The message appears in "tab-b"'s inbox

#### Broadcast message to all tabs

- **Given** Tab "tab-a" exists in a project with multiple tabs
- **When** A process in "tab-a" runs `gosok send --all "hello all"`
- **Then** All other tabs see the message in their inbox

#### Post a global message

- **Given** Tabs exist across multiple projects
- **When** A process runs `gosok feed "system message"`
- **Then** All tabs across all projects see the message in their feed

#### Direct message without specifying a recipient

- **Given** Tab "tab-a" exists
- **When** A process in "tab-a" runs `gosok send` without a target tab
- **Then** An error is shown indicating a recipient is required

#### Send with invalid scope

- **When** A process tries to send a message with an unrecognized scope
- **Then** An error is shown indicating the scope is invalid

**refs**:
- MSG.1

---

### [SC.MSG.2] Inbox and Feed

**preconditions**:
- Tab "tab-a" has received direct messages and broadcast messages exist

**scenarios**:

#### Check inbox

- **Given** Tab "tab-a" has received 3 direct messages and broadcast messages exist in its project
- **When** A process in "tab-a" runs `gosok inbox`
- **Then** Direct and broadcast messages are displayed, ordered oldest first

#### Check feed

- **Given** Global messages have been sent
- **When** A user runs `gosok feed`
- **Then** Global messages are displayed, ordered oldest first

#### Scroll through older inbox messages

- **Given** Tab "tab-a" has 20 messages in its inbox
- **When** A process in "tab-a" runs `gosok inbox --since {messageID}`
- **Then** Only messages newer than the specified message are shown

#### Scroll through older feed messages

- **Given** Global messages exist
- **When** A user runs `gosok feed --since {messageID}`
- **Then** Only messages newer than the specified message are shown

**refs**:
- MSG.2

---

### [SC.MSG.3] Read Markers

**scenarios**:

#### Mark inbox as read

- **Given** Tab "tab-a" has unread inbox messages and an unread indicator is visible
- **When** A process in "tab-a" runs `gosok inbox read`
- **Then** The messages are marked as read and the unread indicator disappears in the Web UI

#### Mark feed as read

- **Given** A user has unread feed messages
- **When** The user marks the feed as read
- **Then** The feed unread indicator disappears in the Web UI

**refs**:
- MSG.3

---

### [SC.MSG.4] Wait for Incoming Message

**scenarios**:

#### Wait and receive a message

- **Given** Tab "tab-a" has no new messages
- **When** A process in "tab-a" runs `gosok wait`
- **Then** The command blocks until a new message arrives, then prints the message and exits

#### Wait with timeout and no message arrives

- **Given** Tab "tab-a" has no new messages
- **When** A process in "tab-a" runs `gosok wait --timeout 5` and no message arrives within 5 seconds
- **Then** The command exits with an empty result after the timeout

**refs**:
- MSG.2

---

### [SC.MSG.5] Message Cleanup

**scenarios**:

#### Old messages are automatically purged

- **Given** Messages older than 7 days exist
- **When** The system performs its periodic cleanup
- **Then** Messages older than 7 days are removed, and recent messages remain accessible

**refs**:
- MSG.4
