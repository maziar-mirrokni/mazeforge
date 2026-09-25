# mazeforge
A low-code platform engine built from scratch — schema-driven APIs, visual builders, and workflow automation.

> Work in progress. See [BACKLOG.md](BACKLOG.md) for the build plan and status.

## How it works

You describe your data as **objects** (for example, Applicant or License
Application), each defined by a JSON schema. The platform generates the API,
forms, and list views for each object from its schema, instead of them being
hand-coded per object. A **record** is one instance of an object, such as a
single applicant.

- Each object has a **label** (display name) and **fields**, each with a label
  and a type: `string`, `text`, `number`, `boolean`, `date`, or `enum`.
- `objectId` and `fieldId` are generated from the label when the object or
  field is created, and never change afterwards. Renaming a label changes only
  what users see, so stored data is never orphaned.
- Every record automatically gets an `id` (a short UUID), `createdAt`, and
  `updatedAt`.

Full details: [docs/schema-format.md](docs/schema-format.md).

## Status

| Done | Next |
|---|---|
| Project scaffolding; schema format and loader | Generated CRUD API for each object |

The proof app for V1 is a mini licensing workflow: an applicant is created,
submitted, reviewed, and approved or denied entirely through generated UI.

## Getting started

Requires Node 22+.

```sh
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Health check: http://localhost:3001/api/health

The server loads every schema in `schemas/` at startup and refuses to start if
any is invalid, listing each problem with its file and location.

| Command | What it does |
|---|---|
| `npm run dev` | Start server and client with live reload |
| `npm test` | Run the test suite |
| `npm run typecheck` | Type-check server and client |
| `npm run build` | Production build of server and client |

## Project layout

| Path | Contents |
|---|---|
| `server/` | Node + Express + TypeScript API (port 3001) |
| `client/` | React + Vite + TypeScript UI (port 5173, proxies `/api` to the server) |
| `schemas/` | Object schemas, one JSON file per object |
| `docs/` | Specifications |
| `BACKLOG.md` | Build plan and progress |

## License

[MIT](LICENSE)
