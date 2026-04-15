# Messaging

### [MSG.1] Message

**rules**:
- A message MUST have a scope: `direct`, `broadcast`, or `global`.
- `direct` scope MUST include a `to_tab_id` and MAY include a `from_tab_id`.
- `broadcast` scope MUST include a `from_tab_id` and delivers to all tabs.
- `global` scope delivers to all tabs across all projects.
- Messages MUST be persisted in the database.
- On creation, a message MUST be published to the Event Hub.

**fields**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| scope | string | Y | One of: direct, broadcast, global |
| from_tab_id | ULID | - | Sender tab ID |
| to_tab_id | ULID | - | Recipient tab ID (direct only) |
| body | string | Y | Message content |

**auto**:

| Name | Type | Description |
|------|------|-------------|
| id | ULID | Primary key |
| created_at | timestamp | Creation time |

**errors**:
- direct scope without to_tab_id → 400 Bad Request
- Invalid scope value → 400 Bad Request

---

### [MSG.2] Inbox and Feed

**rules**:
- `GET /api/v1/messages/inbox/{tabID}` MUST return direct AND broadcast messages addressed to the tab.
- `GET /api/v1/messages/feed` MUST return only global messages.
- Both endpoints MUST support pagination via the `since` query parameter (returns messages created after the given timestamp/ID).
- Results MUST be ordered by creation time ascending.

**refs**:
- MSG.1 (message scopes)

---

### [MSG.3] Read Markers

**rules**:
- `PUT /api/v1/messages/inbox/{tabID}/read` MUST update the read marker for the tab's inbox.
- `PUT /api/v1/messages/feed/read/{tabID}` MUST update the read marker for the tab's feed.
- The read marker stores the `last_read_id` (message ULID).
- Subsequent inbox/feed queries MAY use the read marker to indicate unread counts.

**fields**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| last_read_id | ULID | Y | Last read message ID |

---

### [MSG.4] Message Cleanup

**rules**:
- A background goroutine MUST run every 24 hours.
- It MUST delete messages older than 7 days.
- Cleanup MUST NOT block normal message operations.
