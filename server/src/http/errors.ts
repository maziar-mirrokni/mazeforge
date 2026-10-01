import type { ErrorRequestHandler, RequestHandler, Response } from "express";

/**
 * Every API error uses this body shape:
 *   { "error": { "code": "...", "message": "...", "details"?: [...] } }
 */
export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown[],
): void {
  res.status(status).json({ error: { code, message, ...(details && { details }) } });
}

/** JSON 404 for unmatched /api routes, instead of Express's HTML page. */
export const apiNotFound: RequestHandler = (_req, res) => {
  sendError(res, 404, "not_found", "No such API route");
};

/** Turns malformed JSON bodies and unexpected exceptions into the standard error shape. */
export const apiErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err?.type === "entity.parse.failed") {
    sendError(res, 400, "invalid_json", "Request body is not valid JSON");
    return;
  }
  console.error(err);
  sendError(res, 500, "internal_error", "Internal server error");
};
