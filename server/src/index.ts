import path from "node:path";
import { createApp } from "./app.js";
import { InMemoryRecordStore } from "./records/store.js";
import type { ObjectSchema } from "./schema/format.js";
import { loadSchemas, SchemaLoadError } from "./schema/loader.js";

const port = Number(process.env.PORT ?? 3001);
// Resolves to <repo>/schemas from both src/ (dev) and dist/ (build).
const schemasDir = path.resolve(import.meta.dirname, "../../schemas");

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

createApp({ schemas, store: new InMemoryRecordStore() }).listen(port, () => {
  console.log(`mazeforge server listening on http://localhost:${port}`);
});
