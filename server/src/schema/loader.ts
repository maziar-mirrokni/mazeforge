import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { objectSchema, type ObjectSchema } from "./format.js";

/** Raised when one or more schema files are invalid. Lists every problem found. */
export class SchemaLoadError extends Error {
  constructor(readonly errors: string[]) {
    super(`Invalid schema:\n  - ${errors.join("\n  - ")}`);
    this.name = "SchemaLoadError";
  }
}

function formatPath(segments: PropertyKey[]): string {
  return segments
    .map((s, i) => (typeof s === "number" ? `[${s}]` : i === 0 ? String(s) : `.${String(s)}`))
    .join("");
}

/** Reads and validates one schema file. */
export async function loadSchemaFile(filePath: string): Promise<ObjectSchema> {
  const name = path.basename(filePath);

  let raw: unknown;
  try {
    // Strip a UTF-8 byte-order mark, which some Windows editors add.
    raw = JSON.parse((await readFile(filePath, "utf8")).replace(/^﻿/, ""));
  } catch (err) {
    throw new SchemaLoadError([`${name}: ${(err as Error).message}`]);
  }

  const result = objectSchema.safeParse(raw);
  if (!result.success) {
    throw new SchemaLoadError(
      result.error.issues.map((issue) => {
        const where = issue.path.length ? `${formatPath(issue.path)}: ` : "";
        return `${name}: ${where}${issue.message}`;
      }),
    );
  }

  const expected = `${result.data.objectId}.json`;
  if (name !== expected) {
    throw new SchemaLoadError([
      `${name}: file name must match objectId "${result.data.objectId}" (expected ${expected})`,
    ]);
  }

  return result.data;
}

/**
 * Loads every *.json schema in a directory, keyed by objectId. Collects the
 * errors from all files before throwing, so every problem is reported at once.
 */
export async function loadSchemas(dir: string): Promise<Map<string, ObjectSchema>> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (err) {
    throw new SchemaLoadError([`cannot read schema directory ${dir}: ${(err as Error).message}`]);
  }

  const schemas = new Map<string, ObjectSchema>();
  const errors: string[] = [];

  for (const file of entries.filter((f) => f.endsWith(".json")).sort()) {
    try {
      const schema = await loadSchemaFile(path.join(dir, file));
      schemas.set(schema.objectId, schema);
    } catch (err) {
      if (err instanceof SchemaLoadError) errors.push(...err.errors);
      else throw err;
    }
  }

  if (errors.length) throw new SchemaLoadError(errors);
  return schemas;
}
