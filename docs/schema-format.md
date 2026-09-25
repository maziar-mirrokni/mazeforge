# Object schema format (version 1)

An **object** is a kind of thing the platform stores, such as Applicant or
License Application. A **record** is one instance of an object, such as the
applicant Jane Doe. Each object is defined by one JSON schema file.

The validation rules live in [server/src/schema/format.ts](../server/src/schema/format.ts);
this document describes them.

## Files

- One object per file: `schemas/<objectId>.json`, at the repo root.
- The file name must match the object's `objectId`.
- The server loads every schema at startup and refuses to start if any is
  invalid, listing every problem found.

## Example

```json
{
  "formatVersion": 1,
  "objectId": "applicant",
  "label": "Applicant",
  "fields": [
    { "fieldId": "fullName", "label": "Full name", "type": "string", "required": true, "maxLength": 200 },
    { "fieldId": "dateOfBirth", "label": "Date of birth", "type": "date" },
    { "fieldId": "licenseType", "label": "License type", "type": "enum",
      "options": ["electrician", "plumber", "general_contractor"] }
  ]
}
```

## Object properties

| Property | Required | Description |
|---|---|---|
| `formatVersion` | yes | Always `1` for this version of the format. |
| `objectId` | yes | Permanent identifier. Generated from `label` at creation; never changes. |
| `label` | yes | Display name. Can be changed freely. |
| `fields` | yes | The object's fields (at least one). Order carries no meaning. |

## Field properties

Every field has:

| Property | Required | Description |
|---|---|---|
| `fieldId` | yes | Permanent identifier, unique within the object. Generated from `label` at creation; never changes. |
| `label` | yes | Display name. Can be changed freely. |
| `type` | yes | One of the field types below. |
| `required` | no | Whether a record must have a value. Defaults to `false`. |

### Field types

| Type | Meaning | Extra properties |
|---|---|---|
| `string` | Single-line text | `maxLength` (optional, positive integer) |
| `text` | Multi-line text | `maxLength` (optional, positive integer) |
| `number` | Number | `min`, `max` (optional; `min` ≤ `max`) |
| `boolean` | Yes/no | none |
| `date` | Calendar date | none |
| `enum` | One value from a fixed list | `options` (required, non-empty, no duplicates) |

Properties not listed here are rejected, which catches typos.

## Built-in record fields

Every record automatically has these fields. No schema field may use their ids.

| Field | Description |
|---|---|
| `id` | Short UUID (22 characters, via the [short-uuid](https://www.npmjs.com/package/short-uuid) library), assigned by the platform when the record is created |
| `createdAt` | When the record was created |
| `updatedAt` | When the record was last updated |

## Ids: generated once, then permanent

`objectId` and `fieldId` are generated from the label **only when the object or
field is created**, by `generateId` in
[server/src/schema/generateId.ts](../server/src/schema/generateId.ts). After
that they are stored in the schema file and never regenerated: changing a label
changes only what users see, not the id or the data stored under it.

Conversion rules:

1. Accents are removed: "Café" → `cafe`.
2. The label is split into words on anything that is not a letter or digit.
3. The first word is lowercased; each later word is capitalized; the words are joined.

| Label | Id |
|---|---|
| Full name | `fullName` |
| Holds a prior license | `holdsAPriorLicense` |
| E-mail | `eMail` |
| Address (line 2) | `addressLine2` |

A label is rejected at creation if its id would be empty (e.g. "!!!" or a label
with no Latin letters or digits), would start with a digit (e.g. "2nd address"),
would duplicate another id in the same scope, or would equal a built-in field.

In V1 the loader enforces that ids exist and are well-formed, but it cannot
detect a hand-edit to an existing id in a JSON file. The schema editor does not
offer id editing.
