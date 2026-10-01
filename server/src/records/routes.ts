import { Router, type Request, type Response } from "express";
import type { ObjectSchema } from "../schema/format.js";
import { sendError } from "../http/errors.js";
import type { RecordStore } from "./store.js";
import { validateRecord } from "./validate.js";

type ObjectParams = { objectId: string };
type RecordParams = ObjectParams & { id: string };

/**
 * Generic CRUD routes for every loaded object, mounted at /api/v1/objects.
 * Nothing here is specific to any one object: :objectId is looked up in the
 * loaded schemas, and request bodies are validated against that schema.
 */
export function recordRoutes(schemas: Map<string, ObjectSchema>, store: RecordStore): Router {
  const router = Router();

  /** Looks up the object for :objectId, or sends 404 and returns undefined. */
  function findObject(req: Request<ObjectParams>, res: Response): ObjectSchema | undefined {
    const object = schemas.get(req.params.objectId);
    if (!object) sendError(res, 404, "object_not_found", `Unknown object "${req.params.objectId}"`);
    return object;
  }

  function recordNotFound(res: Response, object: ObjectSchema, id: string): void {
    sendError(res, 404, "record_not_found", `No ${object.label} record with id "${id}"`);
  }

  /** Validates the body, or sends 400 and returns undefined. */
  function validBody(req: Request, res: Response, object: ObjectSchema) {
    const body: unknown = req.body;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      sendError(res, 400, "validation_failed", "Request body must be a JSON object");
      return undefined;
    }
    const result = validateRecord(object, body as Record<string, unknown>);
    if (!result.ok) {
      sendError(res, 400, "validation_failed", "Record is invalid", result.errors);
      return undefined;
    }
    return result.values;
  }

  router.post("/:objectId/records", async (req: Request<ObjectParams>, res) => {
    const object = findObject(req, res);
    if (!object) return;
    const values = validBody(req, res, object);
    if (!values) return;
    res.status(201).json(await store.create(object.objectId, values));
  });

  router.get("/:objectId/records", async (req: Request<ObjectParams>, res) => {
    const object = findObject(req, res);
    if (!object) return;
    res.json({ records: await store.list(object.objectId) });
  });

  router.get("/:objectId/records/:id", async (req: Request<RecordParams>, res) => {
    const object = findObject(req, res);
    if (!object) return;
    const record = await store.get(object.objectId, req.params.id);
    if (!record) return recordNotFound(res, object, req.params.id);
    res.json(record);
  });

  router.put("/:objectId/records/:id", async (req: Request<RecordParams>, res) => {
    const object = findObject(req, res);
    if (!object) return;
    if (!(await store.get(object.objectId, req.params.id))) {
      return recordNotFound(res, object, req.params.id);
    }
    const values = validBody(req, res, object);
    if (!values) return;
    const record = await store.replace(object.objectId, req.params.id, values);
    if (!record) return recordNotFound(res, object, req.params.id);
    res.json(record);
  });

  router.delete("/:objectId/records/:id", async (req: Request<RecordParams>, res) => {
    const object = findObject(req, res);
    if (!object) return;
    if (!(await store.delete(object.objectId, req.params.id))) {
      return recordNotFound(res, object, req.params.id);
    }
    res.status(204).end();
  });

  return router;
}
