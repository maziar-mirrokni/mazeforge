import type { FieldType, ObjectSchema } from "../schema/format.js";
import type { Db } from "./database.js";

/**
 * Maps objects to tables: one STRICT table per object, named obj_<objectId>,
 * with one column per field named by its fieldId. Validation rules (required,
 * maxLength, enum options...) are enforced by the API, not the database.
 */

const TABLE_PREFIX = "obj_";

export const BUILT_IN_COLUMNS = ["id", "createdAt", "updatedAt"];

const COLUMN_TYPES: Record<FieldType, "TEXT" | "REAL" | "INTEGER"> = {
  string: "TEXT",
  text: "TEXT",
  enum: "TEXT",
  date: "TEXT", // YYYY-MM-DD, which sorts correctly as text
  number: "REAL",
  boolean: "INTEGER", // 0 or 1
};

export function tableName(objectId: string): string {
  return TABLE_PREFIX + objectId;
}

/** Quotes an identifier for SQL. Ids are already restricted to [a-zA-Z0-9_]. */
export function q(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function createTableSql(object: ObjectSchema): string {
  const columns = [
    `${q("id")} TEXT PRIMARY KEY`,
    `${q("createdAt")} TEXT NOT NULL`,
    `${q("updatedAt")} TEXT NOT NULL`,
    ...object.fields.map((f) => `${q(f.fieldId)} ${COLUMN_TYPES[f.type]}`),
  ];
  return `CREATE TABLE ${q(tableName(object.objectId))} (\n  ${columns.join(",\n  ")}\n) STRICT`;
}

/**
 * Brings the database in line with the loaded schemas, in one transaction:
 * - new object: create its table
 * - new field: add a column (existing records get null)
 * - field removed from a schema: drop its column and all its values
 * - object removed (no schema file): drop its table and all its records
 *
 * Only tables with the obj_ prefix are touched. Returns a description of
 * each change made, for logging.
 */
export function syncTables(db: Db, schemas: Map<string, ObjectSchema>): string[] {
  const changes: string[] = [];

  const existingTables = new Set(
    (
      db
        .prepare(`SELECT name FROM sqlite_schema WHERE type = 'table' AND name LIKE 'obj\\_%' ESCAPE '\\'`)
        .all() as { name: string }[]
    ).map((row) => row.name),
  );

  db.transaction(() => {
    for (const object of schemas.values()) {
      const table = tableName(object.objectId);

      if (!existingTables.has(table)) {
        db.exec(createTableSql(object));
        changes.push(`created table ${table}`);
        continue;
      }

      const columns = new Set(
        (db.prepare(`SELECT name FROM pragma_table_info(?)`).all(table) as { name: string }[]).map(
          (c) => c.name,
        ),
      );
      const fieldIds = new Set(object.fields.map((f) => f.fieldId));

      for (const field of object.fields) {
        if (!columns.has(field.fieldId)) {
          db.exec(`ALTER TABLE ${q(table)} ADD COLUMN ${q(field.fieldId)} ${COLUMN_TYPES[field.type]}`);
          changes.push(`added column ${table}.${field.fieldId}`);
        }
      }
      for (const column of columns) {
        if (!fieldIds.has(column) && !BUILT_IN_COLUMNS.includes(column)) {
          db.exec(`ALTER TABLE ${q(table)} DROP COLUMN ${q(column)}`);
          changes.push(`dropped column ${table}.${column} and its data`);
        }
      }
    }

    const wanted = new Set([...schemas.keys()].map(tableName));
    for (const table of existingTables) {
      if (!wanted.has(table)) {
        db.exec(`DROP TABLE ${q(table)}`);
        changes.push(`dropped table ${table} and all its records`);
      }
    }
  })();

  return changes;
}
