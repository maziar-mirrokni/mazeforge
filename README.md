# mazeforge
A low-code platform engine built from scratch — schema-driven APIs, visual builders, and workflow automation.

> Work in progress. See [BACKLOG.md](BACKLOG.md) for the build plan and status.

## Stack

- **server/**: Node + Express + TypeScript (port 3001)
- **client/**: React + Vite + TypeScript (port 5173, proxies `/api` to the server)

## Getting started

Requires Node 20+.

```sh
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Health check: http://localhost:3001/api/health

Run the tests with `npm test`.

## Object schemas

Objects are defined as JSON files in [schemas/](schemas/). See
[docs/schema-format.md](docs/schema-format.md) for the format.

## License

[MIT](LICENSE)
