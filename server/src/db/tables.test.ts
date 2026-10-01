import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { FieldSchema, ObjectSchema } from "../schema/format.js";
import { openDatabase, type Db } from "./database.js";
import { syncTables } from "./tables.js";

function object(objectId: string, fields: FieldSchema[]): ObjectSchema {
  return { formatVersion: 1, objectId, label: objectId, fields };
}

const fullName: FieldSchema = { fieldId: "fullName", label: "Full name", type: "string" };
const email: FieldSchema = { fieldId: "email", label: "Email", type: "string" };

function schemaMap(...objects: ObjectSchema[]) {
  return new Map(objects.map((o) => [o.objectId, o]));
}

function columns(db: Db, table: string): Record<string, string> {
  const rows = db.prepare(`SELECT name, type FROM pragma_table_info(?)`).all(table) as {
    name: string;
    type: string;
  }[];
  return Object.fromEntries(rows.map((r) => [r.name, r.type]));
}

function tables(db: Db): string[] {
  return (
    db.prepare(`SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name`).all() as { name: string }[]
  ).map((r) => r.name);
}

describe("syncTables", () => {
  test("creates a STRICT table with one typed column per field", () => {
    const db = openDatabase(":memory:");
    const changes = syncTables(
      db,
      schemaMap(
        object("applicant", [
          { fieldId: "fullName", label: "Full name", type: "string" },
          { fieldId: "bio", label: "Bio", type: "text" },
          { fieldId: "licenseType", label: "License type", type: "enum", options: ["a"] },
          { fieldId: "dateOfBirth", label: "Date of birth", type: "date" },
          { fieldId: "yearsOfExperience", label: "Years", type: "number" },
          { fieldId: "holdsAPriorLicense", label: "Prior", type: "boolean" },
        ]),
      ),
    );
    assert.deepEqual(changes, ["created table obj_applicant"]);
    assert.deepEqual(columns(db, "obj_applicant"), {
      id: "TEXT",
      createdAt: "TEXT",
      updatedAt: "TEXT",
      fullName: "TEXT",
      bio: "TEXT",
      licenseType: "TEXT",
      dateOfBirth: "TEXT",
      yearsOfExperience: "REAL",
      holdsAPriorLicense: "INTEGER",
    });
    const { strict } = db.prepare(`SELECT strict FROM pragma_table_list WHERE name = ?`).get("obj_applicant") as {
      strict: number;
    };
    assert.equal(strict, 1);
  });

  test("makes no changes when tables already match", () => {
    const db = openDatabase(":memory:");
    const schemas = schemaMap(object("applicant", [fullName]));
    syncTables(db, schemas);
    assert.deepEqual(syncTables(db, schemas), []);
  });

  test("adds a column for a new field; existing records get null", () => {
    const db = openDatabase(":memory:");
    syncTables(db, schemaMap(object("applicant", [fullName])));
    db.prepare(`INSERT INTO obj_applicant VALUES ('r1', 't', 't', 'Jane')`).run();

    const changes = syncTables(db, schemaMap(object("applicant", [fullName, email])));
    assert.deepEqual(changes, ["added column obj_applicant.email"]);
    assert.deepEqual(db.prepare(`SELECT fullName, email FROM obj_applicant`).get(), {
      fullName: "Jane",
      email: null,
    });
  });

  test("drops the column and its data when a field is removed", () => {
    const db = openDatabase(":memory:");
    syncTables(db, schemaMap(object("applicant", [fullName, email])));
    db.prepare(`INSERT INTO obj_applicant VALUES ('r1', 't', 't', 'Jane', 'jane@example.com')`).run();

    const changes = syncTables(db, schemaMap(object("applicant", [fullName])));
    assert.deepEqual(changes, ["dropped column obj_applicant.email and its data"]);
    assert.deepEqual(Object.keys(columns(db, "obj_applicant")), ["id", "createdAt", "updatedAt", "fullName"]);
    assert.deepEqual(db.prepare(`SELECT * FROM obj_applicant`).get(), {
      id: "r1",
      createdAt: "t",
      updatedAt: "t",
      fullName: "Jane",
    });
  });

  test("drops the table when an object is removed, leaving other tables alone", () => {
    const db = openDatabase(":memory:");
    syncTables(db, schemaMap(object("applicant", [fullName]), object("license", [fullName])));
    db.exec(`CREATE TABLE settings (key TEXT)`); // not an object table

    const changes = syncTables(db, schemaMap(object("applicant", [fullName])));
    assert.deepEqual(changes, ["dropped table obj_license and all its records"]);
    assert.deepEqual(tables(db), ["obj_applicant", "settings"]);
  });
});
