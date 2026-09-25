# Low-Code Platform — Build Backlog

Format notes for Claude Code: each story is a discrete ~2-hour unit of work with
explicit acceptance criteria and dependencies. Work stories in order within an
epic unless a dependency allows parallelizing. Check the box and add a one-line
completion note (date + brief outcome) when a story is done. Do not mark a
story done unless every acceptance criterion is met and the app still runs.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked

---

## EPIC V1: Bare Minimum Demo

**Goal:** A working low-code platform that can define a data model, auto-generate
an API and UI for it, run a basic status workflow, and demonstrate one real
proof app (a mini licensing workflow) end to end.

**Definition of Done for the epic:** A stranger can watch a 3–5 minute demo and
see an applicant move through a licensing workflow using a UI that was
generated from a schema, not hand-coded per-entity.

### V1-01: Project scaffolding
- **Status:** [x]
- **Estimate:** 2h
- **Depends on:** none
- **Description:** Set up repo, TypeScript config, Node/Express backend
  skeleton, React frontend skeleton, folder structure, core dependencies.
- **Acceptance criteria:**
  - [x] Backend starts with a health-check route returning 200
  - [x] Frontend starts and renders a placeholder page
  - [x] Repo has a README stub and .gitignore
- **Notes:** 2026-09-25: npm workspaces monorepo (server/: Express 5 + TS via tsx, :3001; client/: React 19 + Vite 6, :5173, proxies /api). `npm run dev` starts both; GET /api/health → 200; typecheck and build pass.

### V1-02: Schema format + loader
- **Status:** [ ]
- **Estimate:** 2h
- **Depends on:** V1-01
- **Description:** Define the JSON schema shape for an entity (name, fields,
  types, required flags). Write a loader that reads a schema file into memory.
- **Acceptance criteria:**
  - [ ] Schema format documented (in code comments or a short spec file)
  - [ ] Loader parses one hardcoded example schema without error
  - [ ] Invalid schema shape throws a clear error
- **Notes:**

### V1-03: Dynamic API generator (in-memory)
- **Status:** [ ]
- **Estimate:** 2h
- **Depends on:** V1-02
- **Description:** Given a loaded schema, auto-generate CRUD REST endpoints
  backed by an in-memory store.
- **Acceptance criteria:**
  - [ ] POST/GET/PUT/DELETE work for the hardcoded entity via curl/Postman
  - [ ] Endpoints are generated from the schema, not hand-written per entity
- **Notes:**

### V1-04: Real persistence (SQLite)
- **Status:** [ ]
- **Estimate:** 2h
- **Depends on:** V1-03
- **Description:** Replace in-memory store with SQLite. Dynamically create
  tables from the schema on load.
- **Acceptance criteria:**
  - [ ] Table is created automatically from schema on startup
  - [ ] Same CRUD endpoints from V1-03 now persist across restarts
- **Notes:**

### V1-05: Minimal schema editor UI
- **Status:** [ ]
- **Estimate:** 2h
- **Depends on:** V1-02
- **Description:** Basic form UI to define a new entity and its fields,
  writing to the schema format from V1-02.
- **Acceptance criteria:**
  - [ ] User can create an entity with 2+ fields via the UI, no manual JSON editing
  - [ ] New schema is persisted and loadable by the backend
- **Notes:**

### V1-06: Dynamic form renderer
- **Status:** [ ]
- **Estimate:** 2h
- **Depends on:** V1-04, V1-05
- **Description:** Given an entity schema, auto-render a create/edit form by
  mapping field types to input components.
- **Acceptance criteria:**
  - [ ] Form renders correctly for at least 3 different field types
  - [ ] Submitting the form creates/updates a record via the API
- **Notes:**

### V1-07: Dynamic list/table view
- **Status:** [ ]
- **Estimate:** 2h
- **Depends on:** V1-06
- **Description:** Auto-generate a data grid page for any entity: list, view
  detail, delete. Wire to the V1-06 form for editing.
- **Acceptance criteria:**
  - [ ] List view shows all records for an entity
  - [ ] Clicking a record opens it in the edit form
  - [ ] Delete removes a record and updates the list
- **Notes:**

### V1-08: Basic workflow (status field)
- **Status:** [ ]
- **Estimate:** 2h
- **Depends on:** V1-07
- **Description:** Add a "status" field type with a fixed set of states and
  allowed transitions. UI to move a record between states; invalid
  transitions blocked server-side.
- **Acceptance criteria:**
  - [ ] Status field type is selectable when defining an entity
  - [ ] UI only offers valid next-states for a record's current status
  - [ ] API rejects an invalid transition even if called directly
- **Notes:**

### V1-09: Basic auth
- **Status:** [ ]
- **Estimate:** 2h
- **Depends on:** V1-04
- **Description:** Single login/session layer (no roles yet) protecting API
  and UI routes.
- **Acceptance criteria:**
  - [ ] Unauthenticated requests to API/UI routes are rejected
  - [ ] Valid login grants a session that persists across page reloads
- **Notes:**

### V1-10: Proof app — mini licensing workflow
- **Status:** [ ]
- **Estimate:** 2h
- **Depends on:** V1-08, V1-09
- **Description:** Using the platform itself, define entities for a licensing
  workflow (Applicant, License Application, Review Decision) and run one
  applicant through the full lifecycle using the generated UI.
- **Acceptance criteria:**
  - [ ] All three entities defined via the platform's own schema tool
  - [ ] One applicant can be created, submitted, reviewed, and approved/denied
    entirely through the generated UI
- **Notes:**

### V1-11: Demo polish
- **Status:** [ ]
- **Estimate:** 2h
- **Depends on:** V1-10
- **Description:** Seed realistic demo data, write README, script a 3–5 min
  walkthrough, deploy to a reachable URL or record a backup demo video.
- **Acceptance criteria:**
  - [ ] Realistic seed data loads cleanly on a fresh install
  - [ ] README explains what the project is and how to run it
  - [ ] Either a live deployed URL or a recorded video walkthrough exists
- **Notes:**

---

## EPIC V2: Shiny Bells and Whistles

**Goal:** Layer in enterprise-grade features, ranked by recruiter value-add.
Work top to bottom; stop at any point and the demo is still coherent.

### V2-01: Role-based access control (RBAC)
- **Status:** [ ]
- **Estimate:** 2h
- **Depends on:** V1-09
- **Description:** Define roles/permissions per entity, enforce in the API,
  hide/show UI elements accordingly.
- **Acceptance criteria:**
  - [ ] At least 2 roles exist with different entity-level permissions
  - [ ] API enforces permissions even if UI is bypassed
  - [ ] UI hides actions the current role can't perform
- **Notes:**

### V2-02: API governance layer
- **Status:** [ ]
- **Estimate:** 2h
- **Depends on:** V1-03
- **Description:** Add rate limiting, API key management, and basic versioning
  to the auto-generated endpoints.
- **Acceptance criteria:**
  - [ ] Requests beyond a configured rate limit are rejected with a clear error
  - [ ] API key required for generated endpoints
  - [ ] At least one endpoint demonstrates a versioned path (e.g. /v1/, /v2/)
- **Notes:**

### V2-03: AI-assisted scaffolding
- **Status:** [ ]
- **Estimate:** 2h
- **Depends on:** V1-05
- **Description:** "Describe your app" text box that calls an AI model to
  generate a starter data model + form from natural language.
- **Acceptance criteria:**
  - [ ] Text prompt produces a valid schema in the V1-02 format
  - [ ] Generated schema is editable in the V1-05 schema editor before saving
- **Notes:**

### V2-04: Entity relationships
- **Status:** [ ]
- **Estimate:** 2h
- **Depends on:** V1-07
- **Description:** Support foreign keys / one-to-many relationships between
  entities, with auto-generated joined views.
- **Acceptance criteria:**
  - [ ] Schema supports a "reference" field type pointing to another entity
  - [ ] Detail view for a record shows its related child records
- **Notes:**

### V2-05: Visual workflow builder
- **Status:** [ ]
- **Estimate:** 2h
- **Depends on:** V1-08
- **Description:** Replace the dropdown-based status UI with a node/edge
  visual state-machine editor (e.g. React Flow).
- **Acceptance criteria:**
  - [ ] States and transitions can be added/edited visually
  - [ ] Changes in the visual editor update the enforced transition rules
- **Notes:**

### V2-06: Audit trail
- **Status:** [ ]
- **Estimate:** 2h
- **Depends on:** V1-04
- **Description:** Track every change to a record (who, what, when), with a
  history view per record.
- **Acceptance criteria:**
  - [ ] Every create/update/delete is logged with actor and timestamp
  - [ ] A record's history is viewable in the UI
- **Notes:**

### V2-07: Conditional field logic
- **Status:** [ ]
- **Estimate:** 2h
- **Depends on:** V1-06
- **Description:** Let a schema define field-level visibility/validation
  rules (e.g. show field X only if status = Y).
- **Acceptance criteria:**
  - [ ] Schema supports at least one conditional rule type
  - [ ] Form renderer correctly shows/hides or validates based on the rule
- **Notes:**

### V2-08: Notifications / webhooks
- **Status:** [ ]
- **Estimate:** 2h
- **Depends on:** V1-08
- **Description:** Trigger an email or outbound webhook on workflow
  transitions (e.g. notify applicant on approval).
- **Acceptance criteria:**
  - [ ] At least one status transition triggers a notification
  - [ ] Notification includes relevant record context
- **Notes:**

### V2-09: Visual drag-and-drop builder
- **Status:** [ ]
- **Estimate:** 2h
- **Depends on:** V1-05, V1-06
- **Description:** Upgrade the schema editor and form renderer into an actual
  drag-and-drop interface.
- **Acceptance criteria:**
  - [ ] Fields can be added/reordered via drag-and-drop
  - [ ] Resulting layout is reflected in the generated form
- **Notes:**

### V2-10: Theming / export
- **Status:** [ ]
- **Estimate:** 2h
- **Depends on:** V1-11
- **Description:** Basic branding customization per generated app, plus an
  "export as standalone app" option.
- **Acceptance criteria:**
  - [ ] At least colors/logo can be customized per app instance
  - [ ] Export produces a runnable standalone artifact
- **Notes:**

---

## Progress tracking

| Epic | Total stories | Done | Remaining hours |
|---|---|---|---|
| V1 | 11 | 1 | 20h |
| V2 | 10 | 0 | 20h |
