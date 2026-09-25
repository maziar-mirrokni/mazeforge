import { test } from "node:test";
import assert from "node:assert/strict";
import { generateId } from "./generateId.js";

test("converts labels to camelCase", () => {
  assert.equal(generateId("Applicant"), "applicant");
  assert.equal(generateId("License Application"), "licenseApplication");
  assert.equal(generateId("Full name"), "fullName");
  assert.equal(generateId("Holds a prior license"), "holdsAPriorLicense");
  assert.equal(generateId("SSN"), "ssn");
});

test("drops punctuation and extra whitespace", () => {
  assert.equal(generateId("  Years   of experience! "), "yearsOfExperience");
  assert.equal(generateId("E-mail"), "eMail");
  assert.equal(generateId("Address (line 2)"), "addressLine2");
});

test("strips accents", () => {
  assert.equal(generateId("Café owner"), "cafeOwner");
});

test("rejects labels with no usable characters", () => {
  assert.throws(() => generateId("!!!"), /no letters or digits/);
  assert.throws(() => generateId(""), /no letters or digits/);
});

test("rejects labels whose id would start with a digit", () => {
  assert.throws(() => generateId("2nd address"), /starts with a digit/);
});
