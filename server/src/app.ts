import express from "express";

// Builds the Express app without binding a port, so it can be reused in tests.
export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  return app;
}
