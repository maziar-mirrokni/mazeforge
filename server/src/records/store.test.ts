import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { openDatabase } from "../db/database.js";
import { syncTables } from "../db/tables.js";
import type { ObjectSchema } from "../schema/format.js";
import { SqliteRecordStore } from "./store.js";

const applicant: ObjectSchema = {
  formatVersion: 1,
  objectId: "applicant",
  label: "Applicant",
  fields: [
    { fieldId: "fullName", label: "Full name", type: "string" },
    { fieldId: "yearsOfExperience", label: "Years of experience", type: "number" },
    { fieldId: "holdsAPriorLicense", label: "Holds a prior license", type: "boolean" },
  ],
};
const schemas = new Map([["applicant", applicant]]);

test("records survive closing and reopening the database", async () => {
  const file = path.join(await mkdtemp(path.join(os.tmpdir(), "mazeforge-db-")), "test.db");

  const first = openDatabase(file);
  syncTables(first, schemas);
  const created = await new SqliteRecordStore(first, schemas).create("applicant", {
    fullName: "Jane Doe",
    yearsOfExperience: 7.5,
    holdsAPriorLicense: true,
  });
  first.close();

  const second = openDatabase(file);
  assert.deepEqual(syncTables(second, schemas), [], "table already exists");
  const store = new SqliteRecordStore(second, schemas);
  assert.deepEqual(await store.get("applicant", created.id), created);
  assert.deepEqual(await store.list("applicant"), [created]);
  second.close();
});

test("booleans round-trip as true/false, not 0/1", async () => {
  const db = openDatabase(":memory:");
  syncTables(db, schemas);
  const store = new SqliteRecordStore(db, schemas);

  const yes = await store.create("applicant", { fullName: "A", holdsAPriorLicense: true });
  const no = await store.create("applicant", { fullName: "B", holdsAPriorLicense: false });
  const unset = await store.create("applicant", { fullName: "C", holdsAPriorLicense: null });

  assert.equal(yes.holdsAPriorLicense, true);
  assert.equal(no.holdsAPriorLicense, false);
  assert.equal(unset.holdsAPriorLicense, null);
  assert.deepEqual(
    (await store.list("applicant")).map((r) => r.holdsAPriorLicense),
    [true, false, null],
  );
});

test("whole numbers and decimals are returned as numbers", async () => {
  const db = openDatabase(":memory:");
  syncTables(db, schemas);
  const store = new SqliteRecordStore(db, schemas);
  assert.equal((await store.create("applicant", { yearsOfExperience: 7 })).yearsOfExperience, 7);
  assert.equal((await store.create("applicant", { yearsOfExperience: 2.5 })).yearsOfExperience, 2.5);
});
