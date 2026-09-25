import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadSchemas, SchemaLoadError } from "./loader.js";

const repoSchemasDir = path.resolve(import.meta.dirname, "../../../schemas");

function validObject(overrides: Record<string, unknown> = {}) {
  return {
    formatVersion: 1,
    objectId: "applicant",
    label: "Applicant",
    fields: [{ fieldId: "fullName", label: "Full name", type: "string", required: true }],
    ...overrides,
  };
}

/** Writes the given files into a fresh temp dir and returns its path. */
async function schemaDir(files: Record<string, unknown>): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mazeforge-schemas-"));
  for (const [name, content] of Object.entries(files)) {
    await writeFile(
      path.join(dir, name),
      typeof content === "string" ? content : JSON.stringify(content),
    );
  }
  return dir;
}

/** Asserts loading fails and returns the reported errors. */
async function loadErrors(dir: string): Promise<string[]> {
  try {
    await loadSchemas(dir);
  } catch (err) {
    assert.ok(err instanceof SchemaLoadError, `expected SchemaLoadError, got ${err}`);
    return err.errors;
  }
  assert.fail("expected loadSchemas to throw");
}

test("loads the example applicant schema", async () => {
  const schemas = await loadSchemas(repoSchemasDir);
  const applicant = schemas.get("applicant");
  assert.ok(applicant);
  assert.equal(applicant.label, "Applicant");
  assert.deepEqual(
    applicant.fields.map((f) => f.fieldId),
    ["fullName", "email", "dateOfBirth", "yearsOfExperience", "holdsAPriorLicense", "licenseType"],
  );
});

test("loads every field type", async () => {
  const dir = await schemaDir({
    "sample.json": validObject({
      objectId: "sample",
      fields: [
        { fieldId: "a", label: "A", type: "string", maxLength: 10 },
        { fieldId: "b", label: "B", type: "text" },
        { fieldId: "c", label: "C", type: "number", min: 0, max: 5 },
        { fieldId: "d", label: "D", type: "boolean" },
        { fieldId: "e", label: "E", type: "date" },
        { fieldId: "f", label: "F", type: "enum", options: ["x", "y"] },
      ],
    }),
  });
  const schemas = await loadSchemas(dir);
  assert.equal(schemas.get("sample")?.fields.length, 6);
});

test("rejects a field with no fieldId", async () => {
  const dir = await schemaDir({
    "applicant.json": validObject({ fields: [{ label: "Full name", type: "string" }] }),
  });
  const errors = await loadErrors(dir);
  assert.match(errors.join("\n"), /applicant\.json: fields\[0\]\.fieldId/);
});

test("rejects an object with no objectId", async () => {
  const { objectId: _, ...noId } = validObject();
  const errors = await loadErrors(await schemaDir({ "applicant.json": noId }));
  assert.match(errors.join("\n"), /applicant\.json: objectId/);
});

test("rejects an unknown field type", async () => {
  const dir = await schemaDir({
    "applicant.json": validObject({
      fields: [{ fieldId: "photo", label: "Photo", type: "image" }],
    }),
  });
  const errors = await loadErrors(dir);
  assert.match(errors.join("\n"), /applicant\.json: fields\[0\]\.type/);
});

test("rejects unknown properties, such as the old 'name' key", async () => {
  const dir = await schemaDir({
    "applicant.json": validObject({
      fields: [{ fieldId: "fullName", name: "fullName", label: "Full name", type: "string" }],
    }),
  });
  const errors = await loadErrors(dir);
  assert.match(errors.join("\n"), /fields\[0\].*name/);
});

test("rejects an enum with no options", async () => {
  const dir = await schemaDir({
    "applicant.json": validObject({
      fields: [{ fieldId: "licenseType", label: "License type", type: "enum", options: [] }],
    }),
  });
  const errors = await loadErrors(dir);
  assert.match(errors.join("\n"), /fields\[0\]\.options: must list at least one option/);
});

test("rejects a number field whose min exceeds max", async () => {
  const dir = await schemaDir({
    "applicant.json": validObject({
      fields: [{ fieldId: "age", label: "Age", type: "number", min: 10, max: 1 }],
    }),
  });
  const errors = await loadErrors(dir);
  assert.match(errors.join("\n"), /min must not be greater than max/);
});

test("rejects duplicate fieldIds", async () => {
  const dir = await schemaDir({
    "applicant.json": validObject({
      fields: [
        { fieldId: "email", label: "Email", type: "string" },
        { fieldId: "email", label: "E-mail", type: "string" },
      ],
    }),
  });
  const errors = await loadErrors(dir);
  assert.match(errors.join("\n"), /fields\[1\]\.fieldId: duplicate fieldId "email"/);
});

test("rejects fields that redefine a built-in field", async () => {
  const dir = await schemaDir({
    "applicant.json": validObject({
      fields: [
        { fieldId: "id", label: "ID", type: "string" },
        { fieldId: "createdAt", label: "Created at", type: "date" },
      ],
    }),
  });
  const errors = (await loadErrors(dir)).join("\n");
  assert.match(errors, /"id" is a built-in field/);
  assert.match(errors, /"createdAt" is a built-in field/);
});

test("rejects a file name that does not match the objectId", async () => {
  const errors = await loadErrors(await schemaDir({ "person.json": validObject() }));
  assert.match(errors.join("\n"), /person\.json: file name must match objectId "applicant"/);
});

test("accepts a file saved with a UTF-8 byte-order mark", async () => {
  const dir = await schemaDir({ "applicant.json": "﻿" + JSON.stringify(validObject()) });
  const schemas = await loadSchemas(dir);
  assert.ok(schemas.has("applicant"));
});

test("reports malformed JSON", async () => {
  const errors = await loadErrors(await schemaDir({ "applicant.json": "{ not json" }));
  assert.match(errors.join("\n"), /^applicant\.json: /);
});

test("reports errors from every invalid file at once", async () => {
  const dir = await schemaDir({
    "applicant.json": validObject({ label: "" }),
    "license.json": validObject({ objectId: "license", formatVersion: 2 }),
  });
  const errors = await loadErrors(dir);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /applicant\.json: label: must not be empty/);
  assert.match(errors[1], /license\.json: formatVersion/);
});
