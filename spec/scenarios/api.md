# API Scenarios

### [SC.API.1] Response Format Consistency

**scenarios**:

#### Successful creation returns the created resource

- **Given** A user creates a new resource (project, tab, etc.) via Web UI or CLI
- **When** The system processes the creation
- **Then** The newly created resource with all its fields is returned to the caller

#### Successful update returns the updated resource

- **Given** A user updates an existing resource via Web UI or CLI
- **When** The system processes the update
- **Then** The updated resource with all its fields is returned to the caller

#### Successful deletion confirms removal

- **Given** A user deletes a resource via Web UI or CLI
- **When** The system processes the deletion
- **Then** The system confirms the resource has been removed without returning content

#### Errors include a descriptive message

- **Given** A user performs an invalid action
- **When** The system rejects the request
- **Then** A descriptive error message is returned explaining what went wrong

**refs**:
- API.1, API.2

---

### [SC.API.2] Cross-Origin Access

**scenarios**:

#### Browser preflight succeeds from a different origin

- **Given** A developer runs the frontend dev server on a different port than the backend
- **When** The browser sends a preflight check before making a request
- **Then** The system permits the cross-origin request to proceed

#### Cross-origin request from frontend dev server

- **Given** The frontend dev server is running on a different origin (e.g., localhost:5173)
- **When** The Web UI makes a request to the backend
- **Then** The request succeeds and the response is accessible to the frontend

**refs**:
- API.3

---

### [SC.API.3] Health Check

**scenarios**:

#### System reports healthy status

- **Given** The gosok server is running
- **When** A monitoring system or user checks the server health
- **Then** The system reports that it is healthy and operational

**refs**:
- API.4

---

### [SC.API.4] Direct URL Navigation (SPA Routing)

**scenarios**:

#### User opens the app at the root URL

- **Given** The gosok server is running with the embedded frontend
- **When** A user navigates to the root URL in their browser
- **Then** The Web UI loads and is fully functional

#### User navigates directly to a project URL

- **Given** The gosok server is running with the embedded frontend
- **When** A user navigates directly to a deep link like `/projects/some-id` in their browser
- **Then** The Web UI loads and displays the correct project view (SPA client-side routing)

#### Browser loads static assets (JS, CSS)

- **Given** The gosok server is running with the embedded frontend
- **When** The browser requests JavaScript, CSS, or other static assets
- **Then** The assets load correctly with proper content types

**refs**:
- API.5
