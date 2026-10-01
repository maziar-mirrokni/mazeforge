import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { openDatabase, type Db } from "../db/database.js";
import { syncTables } from "../db/tables.js";
import type { ObjectSchema } from "../schema/format.js";
import { SqliteRecordStore, type RecordStore } from "./store.js";

const applicant: ObjectSchema = {
  formatVersion: 1,
  objectId: "applicant",
  label: "Applicant",
  fields: [
    { fieldId: "fullName", label: "Full name", type: "string", required: true, maxLength: 20 },
    { fieldId: "bio", label: "Bio", type: "text" },
    { fieldId: "yearsOfExperience", label: "Years of experience", type: "number", min: 0, max: 60 },
    { fieldId: "holdsAPriorLicense", label: "Holds a prior license", type: "boolean" },
    { fieldId: "dateOfBirth", label: "Date of birth", type: "date" },
    { fieldId: "licenseType", label: "License type", type: "enum", options: ["electrician", "plumber"] },
  ],
};

const schemas = new Map([["applicant", applicant]]);

let server: Server;
let base: string;
let db: Db | undefined;
let store: RecordStore;

before(async () => {
  // The app reads the store through this wrapper, so each test can start empty.
  const delegate: RecordStore = {
    create: (...a) => store.create(...a),
    list: (...a) => store.list(...a),
    get: (...a) => store.get(...a),
    replace: (...a) => store.replace(...a),
    delete: (...a) => store.delete(...a),
  };
  const app = createApp({ schemas, store: delegate });
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/objects`;
});

after(() => {
  server.close();
  db?.close();
});

beforeEach(() => {
  db?.close();
  db = openDatabase(":memory:");
  syncTables(db, schemas);
  store = new SqliteRecordStore(db, schemas);
});

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

const create = (values: Record<string, unknown>) => call("POST", "/applicant/records", values);

describe("CRUD lifecycle", () => {
  test("create, get, list, replace, delete", async () => {
    const created = await create({ fullName: "Jane Doe", licenseType: "plumber" });
    assert.equal(created.status, 201);
    const { id, createdAt, updatedAt } = created.body;
    assert.match(id, /^[1-9A-HJ-NP-Za-km-z]{22}$/, "22-char base58 short UUID");
    assert.equal(createdAt, updatedAt);
    assert.ok(!Number.isNaN(Date.parse(createdAt)));
    assert.deepEqual(created.body, {
      id,
      createdAt,
      updatedAt,
      fullName: "Jane Doe",
      bio: null,
      yearsOfExperience: null,
      holdsAPriorLicense: null,
      dateOfBirth: null,
      licenseType: "plumber",
    });

    const fetched = await call("GET", `/applicant/records/${id}`);
    assert.equal(fetched.status, 200);
    assert.deepEqual(fetched.body, created.body);

    const listed = await call("GET", "/applicant/records");
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body, { records: [created.body] });

    await new Promise((r) => setTimeout(r, 5)); // so updatedAt visibly changes
    const replaced = await call("PUT", `/applicant/records/${id}`, {
      fullName: "Jane Smith",
      yearsOfExperience: 7,
    });
    assert.equal(replaced.status, 200);
    assert.equal(replaced.body.id, id);
    assert.equal(replaced.body.createdAt, createdAt);
    assert.ok(replaced.body.updatedAt > createdAt);
    assert.equal(replaced.body.fullName, "Jane Smith");
    assert.equal(replaced.body.yearsOfExperience, 7);
    assert.equal(replaced.body.licenseType, null, "PUT replaces the whole record");

    const deleted = await call("DELETE", `/applicant/records/${id}`);
    assert.equal(deleted.status, 204);
    assert.equal(deleted.body, undefined);
    assert.equal((await call("GET", `/applicant/records/${id}`)).status, 404);
    assert.deepEqual((await call("GET", "/applicant/records")).body, { records: [] });
  });

  test("lists records oldest first", async () => {
    for (const name of ["First", "Second", "Third"]) await create({ fullName: name });
    const { body } = await call("GET", "/applicant/records");
    assert.deepEqual(
      body.records.map((r: { fullName: string }) => r.fullName),
      ["First", "Second", "Third"],
    );
  });

  test("accepts every field type", async () => {
    const values = {
      fullName: "Jane",
      bio: "Line one\nLine two",
      yearsOfExperience: 2.5,
      holdsAPriorLicense: false,
      dateOfBirth: "1990-02-28",
      licenseType: "electrician",
    };
    const { status, body } = await create(values);
    assert.equal(status, 201);
    assert.deepEqual({ ...body, id: undefined, createdAt: undefined, updatedAt: undefined }, {
      ...values,
      id: undefined,
      createdAt: undefined,
      updatedAt: undefined,
    });
  });
});

describe("validation", () => {
  async function fieldErrors(values: unknown) {
    const { status, body } = await call("POST", "/applicant/records", values);
    assert.equal(status, 400);
    assert.equal(body.error.code, "validation_failed");
    return Object.fromEntries(
      (body.error.details ?? []).map((d: { fieldId: string; message: string }) => [d.fieldId, d.message]),
    );
  }

  test("reports every problem at once", async () => {
    const errors = await fieldErrors({ fullName: "", licenseType: "pilot", age: 40 });
    assert.deepEqual(errors, {
      fullName: "is required",
      licenseType: "must be one of: electrician, plumber",
      age: "is not a field of Applicant",
    });
  });

  test("treats missing, null, and empty string as no value", async () => {
    assert.deepEqual(await fieldErrors({}), { fullName: "is required" });
    assert.deepEqual(await fieldErrors({ fullName: null }), { fullName: "is required" });
    const { body } = await create({ fullName: "Jane", bio: "" });
    assert.equal(body.bio, null, "empty string stored as null");
  });

  test("checks types strictly", async () => {
    const errors = await fieldErrors({
      fullName: 42,
      bio: true,
      yearsOfExperience: "5",
      holdsAPriorLicense: "yes",
      dateOfBirth: 19900101,
      licenseType: 1,
    });
    assert.deepEqual(errors, {
      fullName: "must be a string",
      bio: "must be a string",
      yearsOfExperience: "must be a number",
      holdsAPriorLicense: "must be true or false",
      dateOfBirth: "must be a valid date in YYYY-MM-DD format",
      licenseType: "must be one of: electrician, plumber",
    });
  });

  test("enforces maxLength, min, and max", async () => {
    assert.deepEqual(await fieldErrors({ fullName: "x".repeat(21) }), {
      fullName: "must be at most 20 characters",
    });
    assert.deepEqual(await fieldErrors({ fullName: "Jane", yearsOfExperience: -1 }), {
      yearsOfExperience: "must be at least 0",
    });
    assert.deepEqual(await fieldErrors({ fullName: "Jane", yearsOfExperience: 61 }), {
      yearsOfExperience: "must be at most 60",
    });
  });

  test("rejects dates that are not real calendar dates", async () => {
    for (const dateOfBirth of ["2026-02-30", "2026-13-01", "26-01-01", "2026-01-01T00:00:00Z"]) {
      assert.deepEqual(await fieldErrors({ fullName: "Jane", dateOfBirth }), {
        dateOfBirth: "must be a valid date in YYYY-MM-DD format",
      });
    }
    assert.equal((await create({ fullName: "Jane", dateOfBirth: "2024-02-29" })).status, 201);
  });

  test("silently ignores built-in fields in the body", async () => {
    const { status, body } = await create({
      fullName: "Jane",
      id: "chosen-by-client",
      createdAt: "2000-01-01T00:00:00.000Z",
      updatedAt: "2000-01-01T00:00:00.000Z",
    });
    assert.equal(status, 201);
    assert.notEqual(body.id, "chosen-by-client");
    assert.notEqual(body.createdAt, "2000-01-01T00:00:00.000Z");

    // A fetched record can be sent straight back with PUT.
    const put = await call("PUT", `/applicant/records/${body.id}`, { ...body, fullName: "Janet" });
    assert.equal(put.status, 200);
    assert.equal(put.body.createdAt, body.createdAt);
  });

  test("validates PUT the same way as POST", async () => {
    const { body } = await create({ fullName: "Jane" });
    const res = await call("PUT", `/applicant/records/${body.id}`, { licenseType: "pilot" });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.details.length, 2);
  });

  test("rejects a body that is not a JSON object", async () => {
    for (const body of [[], "plain", undefined]) {
      const res = await call("POST", "/applicant/records", body === "plain" ? '"plain"' : body);
      assert.equal(res.status, 400);
      assert.equal(res.body.error.message, "Request body must be a JSON object");
    }
  });
});

describe("errors", () => {
  test("malformed JSON", async () => {
    const res = await call("POST", "/applicant/records", "{ not json");
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, {
      error: { code: "invalid_json", message: "Request body is not valid JSON" },
    });
  });

  test("unknown object", async () => {
    for (const [method, path] of [
      ["GET", "/license/records"],
      ["POST", "/license/records"],
      ["GET", "/license/records/abc"],
      ["PUT", "/license/records/abc"],
      ["DELETE", "/license/records/abc"],
    ]) {
      const res = await call(method, path, method === "POST" || method === "PUT" ? {} : undefined);
      assert.equal(res.status, 404, `${method} ${path}`);
      assert.equal(res.body.error.code, "object_not_found");
    }
  });

  test("unknown record id", async () => {
    for (const method of ["GET", "PUT", "DELETE"]) {
      const res = await call(method, "/applicant/records/doesNotExist", method === "PUT" ? { fullName: "x" } : undefined);
      assert.equal(res.status, 404, method);
      assert.deepEqual(res.body.error, {
        code: "record_not_found",
        message: 'No Applicant record with id "doesNotExist"',
      });
    }
  });

  test("unversioned and unknown API routes return JSON 404", async () => {
    const root = base.replace("/api/v1/objects", "");
    for (const path of ["/api/objects/applicant/records", "/api/v1/nope"]) {
      const res = await fetch(root + path);
      assert.equal(res.status, 404, path);
      assert.equal((await res.json()).error.code, "not_found");
    }
  });
});
