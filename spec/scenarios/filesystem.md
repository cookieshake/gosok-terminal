# Filesystem Scenarios

### [SC.FS.1] Directory Browsing

**scenarios**:

#### Browse directories in the editor file browser

- **Given** A project points to "/home/user/project" which contains directories "src", "docs", ".git"
- **When** The user opens the file browser for that project in the Web UI
- **Then** The directories "src", "docs", ".git" are listed

#### Browse a nonexistent path

- **Given** A project points to a path that no longer exists
- **When** The user opens the file browser for that project
- **Then** An error is shown indicating the path was not found

**refs**:
- FS.1

---

### [SC.FS.2] File Listing

**scenarios**:

#### View files in a directory

- **Given** The directory "/home/user/project" contains files "main.go" and "README.md"
- **When** The user navigates to that directory in the file browser
- **Then** The files "main.go" and "README.md" are listed with their details

**refs**:
- FS.2

---

### [SC.FS.3] File Read/Write

**scenarios**:

#### Open and read a file

- **Given** The file "main.go" exists in the project directory with content
- **When** The user clicks on "main.go" in the file browser
- **Then** The file content is displayed in the editor

#### Open a nonexistent file

- **Given** The file "missing.go" does not exist in the project directory
- **When** The user tries to open "missing.go"
- **Then** An error is shown indicating the file was not found

#### Create or edit a file

- **Given** The user has a file open in the editor (or creates a new file)
- **When** The user edits the content and saves
- **Then** The file is written to disk with the new content

**refs**:
- FS.3, FS.4

---

### [SC.FS.4] Git Changes

**scenarios**:

#### View unstaged changes for a project

- **Given** A project points to a git repository with unstaged changes
- **When** The user opens the git changes view for that project in the Web UI
- **Then** A list of changed files with their status (modified, added, deleted) is shown

#### View staged changes for a project

- **Given** A project points to a git repository with staged changes
- **When** The user switches to the staged changes view
- **Then** A list of staged files with their status is shown

#### View diff for a specific file

- **Given** A project has a file "main.go" with uncommitted changes
- **When** The user clicks on "main.go" in the changes list
- **Then** The diff for that file is displayed

#### Project is not a git repository

- **Given** A project points to a directory that is not a git repository
- **When** The user tries to view git changes
- **Then** An error is shown indicating the project is not a git repository

**refs**:
- FS.5
