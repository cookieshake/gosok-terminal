# Projects

### [PROJ.1] Project

**rules**:
- A project MUST be associated with a filesystem path.
- The path SHOULD be an absolute path to an existing directory.
- Projects MUST be ordered by `sort_order` ascending.
- Deleting a project MUST delete all associated tabs.

**fields**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Y | Project name |
| path | string | Y | Filesystem path |
| description | string | - | Optional description |
| sort_order | integer | Y | Display order |

**auto**:

| Name | Type | Description |
|------|------|-------------|
| id | ULID | Primary key |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update time |

**errors**:
- Project not found → 404 Not Found

---

### [PROJ.2] Project CRUD

**rules**:
- `GET /api/v1/projects` MUST return all projects ordered by `sort_order`.
- `POST /api/v1/projects` MUST create a new project and return it.
- `GET /api/v1/projects/{id}` MUST return the project with the given ID.
- `PUT /api/v1/projects/{id}` MUST update the project fields.
- `DELETE /api/v1/projects/{id}` MUST delete the project and all its tabs.

**refs**:
- PROJ.1 (project definition)

---

### [PROJ.3] Project Reorder

**rules**:
- `PUT /api/v1/projects/reorder` MUST accept an ordered list of project IDs.
- The server MUST update `sort_order` for each project based on its position in the list.

**fields**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| ids | string[] | Y | Ordered list of project IDs |

**refs**:
- PROJ.1 (sort_order field)
