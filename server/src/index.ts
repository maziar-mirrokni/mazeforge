import path from "node:path";
import { createApp } from "./app.js";
import { openDatabase } from "./db/database.js";
import { syncTables } from "./db/tables.js";
import { SqliteRecordStore } from "./records/store.js";
import type { ObjectSchema } from "./schema/format.js";
import { loadSchemas, SchemaLoadError } from "./schema/loader.js";

const port = Number(process.env.PORT ?? 3001);
// Both resolve relative to the repo root, from src/ (dev) and dist/ (build).
const repoRoot = path.resolve(import.meta.dirname, "../..");
const schemasDir = path.join(repoRoot, "schemas");
const databasePath = process.env.DATABASE_PATH ?? path.join(repoRoot, "data", "mazeforge.db");

let schemas: Map<string, ObjectSchema>;
try {
  schemas = await loadSchemas(schemasDir);
  console.log(`Loaded ${schemas.size} object schema(s): ${[...schemas.keys()].join(", ") || "none"}`);
} catch (err) {
  if (err instanceof SchemaLoadError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}

const db = openDatabase(databasePath);
console.log(`Database: ${databasePath}`);
for (const change of syncTables(db, schemas)) console.log(`  schema sync: ${change}`);

const server = createApp({ schemas, store: new SqliteRecordStore(db, schemas) }).listen(port, () => {
  console.log(`mazeforge server listening on http://localhost:${port}`);
});

// Close the database cleanly so WAL contents are written back to the main file.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close();
    db.close();
    process.exit(0);
  });
}
