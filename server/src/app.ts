import express from "express";
import type { ObjectSchema } from "./schema/format.js";
import type { RecordStore } from "./records/store.js";
import { recordRoutes } from "./records/routes.js";
import { apiErrorHandler, apiNotFound } from "./http/errors.js";

export interface AppDeps {
  schemas: Map<string, ObjectSchema>;
  store: RecordStore;
}

// Builds the Express app without binding a port, so it can be reused in tests.
export function createApp({ schemas, store }: AppDeps) {
  const app = express();
  // strict: false lets valid non-object JSON (e.g. "text") through, so routes
  // can report "must be a JSON object" instead of a misleading parse error.
  app.use(express.json({ strict: false }));

  // Infrastructure route; deliberately outside the versioned API.
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/v1/objects", recordRoutes(schemas, store));

  app.use("/api", apiNotFound);
  app.use(apiErrorHandler);

  return app;
}
