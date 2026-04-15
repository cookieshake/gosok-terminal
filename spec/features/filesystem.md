# Filesystem

### [FS.1] Directory Listing

**rules**:
- `GET /api/v1/fs/dirs?path={path}` MUST return a list of directories at the given path.
- The path MUST be an absolute filesystem path.
- Results MUST include directory names.
- Hidden directories (starting with `.`) MUST be excluded by default and included when `?hidden=true` query parameter is set.

**errors**:
- Path does not exist → 404 Not Found
- Path is not a directory → 400 Bad Request
- Permission denied → 403 Forbidden

---

### [FS.2] File Listing

**rules**:
- `GET /api/v1/fs/files?path={path}` MUST return a list of files at the given path.
- The path MUST be an absolute filesystem path.
- Results MUST include file names.

**errors**:
- Path does not exist → 404 Not Found
- Path is not a directory → 400 Bad Request

---

### [FS.3] File Read

**rules**:
- `GET /api/v1/fs/file?path={path}` MUST return the file content.
- The path MUST be an absolute filesystem path to a file.

**errors**:
- File does not exist → 404 Not Found
- Path is a directory → 400 Bad Request

---

### [FS.4] File Write

**rules**:
- `PUT /api/v1/fs/file?path={path}` MUST write the content to the specified file path.
- The path MUST be provided as a query parameter.
- The request body MUST be JSON with a `content` field: `{"content": "..."}`.
- Parent directories MUST already exist (the server does NOT create them automatically).

**errors**:
- Permission denied → 403 Forbidden

---

### [FS.5] Git Diff

**rules**:
- `GET /api/v1/projects/{id}/diff` MUST return a structured list of changed files, each as `{path, status}` objects derived from `git diff --name-status`.
- The `staged` query parameter controls whether to show staged changes (`git diff --cached`) or unstaged changes (`git diff`).
- `GET /api/v1/projects/{id}/diff/file` MUST return the raw diff text for a single file specified by the `path` query parameter.
- The project path MUST be a git repository.

**errors**:
- Project not found → 404 Not Found
- Path is not a git repository → 400 Bad Request
