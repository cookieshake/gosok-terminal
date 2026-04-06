# Spec Format Definition

This document defines a generic spec format, not tied to any specific project.
It can be used as-is or extended for any software project.

---

## Requirement Keywords (RFC 2119 / RFC 8174)

The following keywords have special meaning throughout the spec **only when capitalized**.

| Keyword | Meaning |
|---------|---------|
| **MUST** / **REQUIRED** | Absolute requirement |
| **MUST NOT** | Absolute prohibition |
| **SHOULD** / **RECOMMENDED** | Exception allowed with valid reason |
| **SHOULD NOT** | Follow unless there is a valid reason not to |
| **MAY** / **OPTIONAL** | Optional |

Lowercase must, should, etc. are interpreted as plain English.

---

## Document Structure

```
spec/
├── README.md              # Project introduction
├── spec-format.md         ← This document (generic)
├── glossary.md            # Glossary
│
├── architecture/          # System overview
│   ├── 01-introduction.md
│   ├── 02-constraints.md
│   ├── 03-context.md
│   ├── 04-solution-strategy.md
│   ├── 05-building-blocks.md
│   ├── 06-runtime.md
│   └── 07-deployment.md
│
├── features/              # Feature-level detailed specs
│   └── {feature}.md
│
└── scenarios/             # User behavior scenarios
    └── {feature}.md
```

### Folder Roles

| Folder | Format | Key Question |
|--------|--------|-------------|
| `architecture/` | Architecture (Arc42-based, defined below) | "What is the system and why is it structured this way?" |
| `features/` | Spec items (fixed fields) | "How exactly does this feature work?" |
| `scenarios/` | Scenarios (Gherkin) | "What happens when the user does X?" |

### Arc42 Mapping

`architecture/`, `features/`, and `scenarios/` borrow from the Arc42 architecture documentation template.

| Arc42 Section | Location |
|--------------|----------|
| §1 Introduction and Goals | `architecture/01-introduction.md` |
| §2 Constraints | `architecture/02-constraints.md` |
| §3 Context | `architecture/03-context.md` |
| §4 Solution Strategy | `architecture/04-solution-strategy.md` |
| §5 Building Blocks | `architecture/05-building-blocks.md` (overview) + `features/` (detail) |
| §6 Runtime View | `architecture/06-runtime.md` (overview) + `scenarios/` (detail) |
| §7 Deployment | `architecture/07-deployment.md` |
| §8 Cross-cutting Concerns | `features/` (access-control.md, etc.) |

### Reading Order

1. First time: `architecture/` → `features/` → `scenarios/`
2. Specific feature: `features/{file}` → `scenarios/{file}`
3. Unfamiliar terms: `glossary.md`
4. Writing specs: The rest of this document

---

## Spec Types

| Type | Location | Format |
|------|----------|--------|
| **Architecture** | `architecture/` | Fixed sections (Arc42-based, defined below) |
| **Spec** | `features/` | Fixed fields (defined below) |
| **Scenario** | `scenarios/` | Gherkin (Given/When/Then) |

---

## Architecture (architecture/)

Each Arc42 section has prescribed content.

| File | Section | Content |
|------|---------|---------|
| `01-introduction.md` | Introduction and Goals | Product purpose, key requirements, quality goals, stakeholders |
| `02-constraints.md` | Constraints | Technical constraints (language, DB, runtime), non-functional requirements (performance limits, security policies) |
| `03-context.md` | Context | System boundary, external integrations, diagrams |
| `04-solution-strategy.md` | Solution Strategy | Key technology choices and rationale, architecture decisions, trade-offs |
| `05-building-blocks.md` | Building Blocks | Major module structure, inter-module dependencies (overview) |
| `06-runtime.md` | Runtime View | Key execution flows (overview): request handling, auth, upload, actions |
| `07-deployment.md` | Deployment | Infrastructure setup, environment variables, execution methods |

Each file describes its section content in free-form Markdown.
Spec item fixed fields (id, status, rules, etc.) are not used.

---

## Spec Items (features/)

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| **id** | Y | Unique identifier |
| **title** | Y | One-line title |
| **rules** | Y | Behavioral rules using MUST/SHOULD/MAY keywords |
| **fields** | - | When data structure exists. Name/type/required/description table |
| **lifecycle** | - | When state transitions exist. State/transition/next state/condition table |
| **errors** | - | Errors on rule violation. `{condition} → {result}` format |
| **notes** | - | Design rationale, background, implementation hints |
| **refs** | - | Related spec ID list |
| **examples** | - | Code, YAML, HTTP request examples |

### ID Scheme

`{section}.{number}` format. Extend with dots for sub-items.

```
AUTH.1             # features/auth.md item 1
AUTH.1.1           # Sub-item of AUTH.1
```

Section abbreviations are defined per project. Recommended to map 1:1 with `features/` filenames.

### Rules Writing Guide

Each rule is a single sentence containing one of MUST/SHOULD/MAY.

```markdown
- Username MUST be globally unique.
- Deleted records MUST NOT be queryable.
- List queries SHOULD support pagination.
```

Conditional rules:

```markdown
- If auth is not enabled, access control keywords MUST NOT be used.
```

### Fields Writing Guide

Used when defining data structures. Table format.

```markdown
**fields**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| error.code | string | Y | Error code |
| error.message | string | Y | Human-readable message |
| error.details | object | - | Per-field error details |
```

Mark auto-generated fields separately:

```markdown
**auto**:

| Name | Type | Description |
|------|------|-------------|
| id | ULID | primary key |
| created_at | timestamp | Creation time |
```

### Lifecycle Writing Guide

Used for models with state transitions. Table format.

```markdown
**lifecycle**:

| State | Transition | Next State | Condition |
|-------|-----------|------------|-----------|
| pending | approve | approved | Admin approval |
| pending | expire | expired | Deadline exceeded |
```

### Errors Writing Guide

Separate condition and result with `→`.

```markdown
**errors**:
- Unknown field included in request → 400 BAD_REQUEST
- Required field missing → 422 VALIDATION_ERROR
```

### Refs Writing Guide

Reference by other spec IDs. Short description in parentheses.

```markdown
**refs**:
- AUTH.1 (authentication rules)
- API.3 (error response format)
```

---

## Scenario (scenarios/)

Gherkin format. Describes user behavior flows with Given/When/Then.

**Recommended practice**: Every sub-scenario (each Given/When/Then block) SHOULD have a corresponding integration test. Scenarios are not just documentation — they are the specification for test cases. A feature is not considered complete until all of its scenarios pass as automated tests.

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| **id** | Y | Unique identifier. `SC.{section}.{number}` |
| **title** | Y | Feature title |
| **preconditions** | - | Common preconditions for scenarios |
| **scenarios** | Y | List of Given/When/Then scenarios |
| **refs** | - | Related spec IDs |

### Scenario ID

Same format as spec items: `SC.{section}.{number}`. Section abbreviations correspond to `scenarios/` filenames.

### Writing Example

```markdown
### [SC.AUTH.1] Signup

**preconditions**:
- Password authentication is enabled

**scenarios**:

#### Successful signup

- **Given** No user exists with that email
- **When** A signup request is made
- **Then** Account is created and token is returned

#### Duplicate signup

- **Given** A user exists with that email
- **When** Signup is requested with the same email
- **Then** 409 CONFLICT is returned

**refs**:
- AUTH.3 (account policy)
```

---

## Full Example (Spec Item)

```markdown
### [AUTH.2] Token

**rules**:
- The server MUST auto-generate and manage the symmetric key.
- It MUST be a single-token system. No separate refresh token is issued.
- Renewal with an expired token MUST NOT be allowed.

**fields**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| token | string | Y | Authentication token |
| user | object | Y | User information |

**errors**:
- Renewal attempt with expired token → 401 UNAUTHORIZED
- Invalid token → 401 UNAUTHORIZED

**notes**:
On renewal, a new token is issued and the expiration is reset.

**refs**:
- AUTH.1 (auth resource)
- API.1 (response format)
```
