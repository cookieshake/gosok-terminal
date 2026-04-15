# API

### [API.1] Response Format

**rules**:
- Successful responses MUST return the resource or resource list as JSON.
- List responses MUST return a JSON array.
- Create responses MUST return 201 status with the created resource.
- Update responses MUST return 200 status with the updated resource.
- Delete responses MUST return 204 No Content.

---

### [API.2] Error Response

**rules**:
- Error responses MUST be JSON with a human-readable `error` field.
- Error responses MUST use appropriate HTTP status codes.

**fields**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| error | string | Y | Human-readable error message |

**examples**:

```json
{
  "error": "project not found"
}
```

---

### [API.3] CORS

**rules**:
- The server MUST allow cross-origin requests.
- CORS headers MUST include `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`.
- OPTIONS preflight requests MUST be handled and return 204 No Content.

---

### [API.4] Health Check

**rules**:
- `GET /api/v1/health` MUST return 200 with `{"status": "ok"}`.
- The health check MUST NOT require authentication.

---

### [API.5] Static File Serving

**rules**:
- In production, the embedded frontend MUST be served at the root path `/`.
- SPA routing: any path not matching `/api/*` MUST serve `index.html`.
- Static assets (JS, CSS, images) MUST be served with appropriate content types.
