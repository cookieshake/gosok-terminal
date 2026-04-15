# Project Scenarios

### [SC.PROJ.1] Project CRUD

**preconditions**:
- gosok server is running

**scenarios**:

#### [Web UI] Create a project from the sidebar

- **Given** The user is viewing the Web UI
- **When** The user clicks the "Add Project" button in the sidebar and enters name "my-project" with path "/home/user/project"
- **Then** The new project "my-project" appears in the sidebar project list

#### [Web UI] Create a project with missing fields

- **When** The user attempts to create a project without filling in the name or path
- **Then** The UI shows a validation error and the project is not created

#### [CLI] Create a project

- **Given** No project exists with name "my-project"
- **When** The user runs `gosok project create my-project --path /home/user/project`
- **Then** The CLI confirms the project was created and displays its name, path, and ID

#### [CLI] Create a project with missing fields

- **When** The user runs `gosok project create` without providing a name or path
- **Then** The CLI shows a usage error indicating required fields are missing

#### [Web UI] View project list in sidebar

- **Given** Projects "alpha" and "beta" exist
- **When** The user opens the Web UI
- **Then** Both projects appear in the sidebar, ordered by their configured sort order

#### [CLI] List projects

- **Given** Projects "alpha" and "beta" exist
- **When** The user runs `gosok ps`
- **Then** The CLI outputs a list of projects in sort order showing name and path

#### [Web UI] Select a project

- **Given** Multiple projects exist in the sidebar
- **When** The user clicks on a project name in the sidebar
- **Then** The project view opens showing that project's tabs and details

#### [Web UI] Rename a project

- **Given** A project exists with name "old-name"
- **When** The user edits the project name to "new-name" in the UI
- **Then** The sidebar updates to show "new-name"

#### [CLI] Update a project

- **Given** A project exists with name "old-name"
- **When** The user runs `gosok project update <id> --name new-name`
- **Then** The CLI confirms the project was renamed

#### [Web UI] Delete a project with stopped tabs

- **Given** A project exists with tabs that are all stopped
- **When** The user deletes the project from the UI
- **Then** The project and all its tabs disappear from the sidebar
- **Note** Tabs should be stopped before deleting the project

#### [CLI] Delete a project with stopped tabs

- **Given** A project exists with tabs that are all stopped
- **When** The user runs `gosok project delete <id>`
- **Then** The CLI confirms the project and its tabs were deleted

#### Delete project with running tabs

- **Given** A project exists with running tabs
- **When** The user deletes the project (via Web UI or CLI)
- **Then** The project and its tabs are removed, but running PTY sessions become orphaned
- **Note** This is a known issue: running tabs are NOT stopped before deletion

**refs**:
- PROJ.1, PROJ.2

---

### [SC.PROJ.2] Project Reorder

**preconditions**:
- Three projects exist: A, B, C

**scenarios**:

#### [Web UI] Drag to reorder projects

- **Given** Projects A, B, C appear in the sidebar in that order
- **When** The user drags project C above project A
- **Then** The sidebar updates to show order C, A, B and the order persists on refresh

**refs**:
- PROJ.3
