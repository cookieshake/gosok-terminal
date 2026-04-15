# Notifications

### [NOTIF.1] Notification

**rules**:
- `POST /api/v1/notify` MUST publish a notification to the Event Hub.
- A notification MUST have a `title`.
- A notification MAY have a `body`, `tab_id`, and `flag`.
- Notifications are NOT persisted; they are broadcast in real-time only.

**fields**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| title | string | Y | Notification title |
| body | string | - | Notification body |
| tab_id | ULID | - | Associated tab ID |
| flag | bool | - | Notification flag (e.g., for UI behavior) |

**errors**:
- Missing title → 400 Bad Request

**refs**:
- WS.4 (events WebSocket delivery)
