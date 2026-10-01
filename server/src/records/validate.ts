import { BUILT_IN_FIELD_IDS, type FieldSchema, type ObjectSchema } from "../schema/format.js";
import type { FieldValue, RecordValues } from "./store.js";

export interface FieldError {
  fieldId: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; values: RecordValues }
  | { ok: false; errors: FieldError[] };

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a YYYY-MM-DD string naming a real calendar date (rejects 2026-02-30). */
function isCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/**
 * Checks one field's value. Returns the normalized value, or an error message.
 * Missing, null, and (for string/text) "" all mean "no value" and become null.
 */
function validateField(field: FieldSchema, raw: unknown): { value: FieldValue } | { error: string } {
  const empty = raw === undefined || raw === null || ((field.type === "string" || field.type === "text") && raw === "");
  if (empty) return field.required ? { error: "is required" } : { value: null };

  switch (field.type) {
    case "string":
    case "text":
      if (typeof raw !== "string") return { error: "must be a string" };
      if (field.maxLength !== undefined && raw.length > field.maxLength) {
        return { error: `must be at most ${field.maxLength} characters` };
      }
      return { value: raw };

    case "number":
      if (typeof raw !== "number") return { error: "must be a number" };
      if (field.min !== undefined && raw < field.min) return { error: `must be at least ${field.min}` };
      if (field.max !== undefined && raw > field.max) return { error: `must be at most ${field.max}` };
      return { value: raw };

    case "boolean":
      if (typeof raw !== "boolean") return { error: "must be true or false" };
      return { value: raw };

    case "date":
      if (typeof raw !== "string" || !isCalendarDate(raw)) {
        return { error: "must be a valid date in YYYY-MM-DD format" };
      }
      return { value: raw };

    case "enum":
      if (typeof raw !== "string" || !field.options.includes(raw)) {
        return { error: `must be one of: ${field.options.join(", ")}` };
      }
      return { value: raw };
  }
}

/**
 * Validates a request body as a full record for the given object (PUT and
 * POST both send every field). Built-in fields in the body are ignored;
 * unknown fields are rejected. Collects every error rather than stopping at
 * the first.
 */
export function validateRecord(object: ObjectSchema, body: Record<string, unknown>): ValidationResult {
  const errors: FieldError[] = [];
  const values: RecordValues = {};
  const known = new Set(object.fields.map((f) => f.fieldId));

  for (const field of object.fields) {
    const result = validateField(field, body[field.fieldId]);
    if ("error" in result) errors.push({ fieldId: field.fieldId, message: result.error });
    else values[field.fieldId] = result.value;
  }

  for (const key of Object.keys(body)) {
    if (!known.has(key) && !(BUILT_IN_FIELD_IDS as readonly string[]).includes(key)) {
      errors.push({ fieldId: key, message: `is not a field of ${object.label}` });
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, values };
}
