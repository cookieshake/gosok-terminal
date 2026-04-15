# Notification Scenarios

### [SC.NOTIF.1] Send Notification

**scenarios**:

#### Send a simple notification

- **Given** A user has the Web UI open
- **When** A tab process runs `gosok notify "Build complete"`
- **Then** A notification with the title "Build complete" appears in the Web UI

#### Send a notification with all fields

- **Given** A user has the Web UI open
- **When** A tab process runs `gosok notify "Error" --body "Build failed" --flag`
- **Then** A notification appears in the Web UI showing the title, body, originating tab, and flagged status

#### Send a notification without a title

- **When** A tab process runs `gosok notify` without providing a title
- **Then** An error is shown indicating that a title is required

**refs**:
- NOTIF.1
