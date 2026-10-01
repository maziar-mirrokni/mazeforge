# Record API (v1)

Every object defined in [schemas/](../schemas/) automatically gets these
endpoints. Nothing is written per object: the routes look up the object by
`:objectId` and validate request bodies against its schema
([schema-format.md](schema-format.md)).

All paths are under `/api/v1/objects`. `GET /api/health` is the only
unversioned route.

## Endpoints

| Method and path | Action | Success |
|---|---|---|
| `POST /api/v1/objects/:objectId/records` | Create a record | 201, the new record |
| `GET /api/v1/objects/:objectId/records` | List all records, oldest first | 200, `{ "records": [...] }` |
| `GET /api/v1/objects/:objectId/records/:id` | Get one record | 200, the record |
| `PUT /api/v1/objects/:objectId/records/:id` | Replace a record | 200, the updated record |
| `DELETE /api/v1/objects/:objectId/records/:id` | Delete a record | 204, no body |

`objectId` is used exactly as defined (`applicant`, not `applicants`).
Pagination, filtering, sorting, and PATCH are planned in V2-11.

## Records

A record is a flat JSON object with the built-in fields plus every field in the
object's schema. Fields with no value are `null`, never missing.

```json
{
  "id": "3nhRxs9WFqNui3oimCh1xV",
  "createdAt": "2026-10-01T00:24:27.780Z",
  "updatedAt": "2026-10-01T00:24:27.780Z",
  "fullName": "Jane Doe",
  "email": "jane@example.com",
  "dateOfBirth": null,
  "yearsOfExperience": null,
  "holdsAPriorLicense": null,
  "licenseType": "plumber"
}
```

- `id`: 22-character short UUID, assigned on create.
- `createdAt`, `updatedAt`: ISO 8601 UTC timestamps. Both are set on create;
  `updatedAt` changes on every PUT.

## Request bodies (POST and PUT)

The body is a JSON object of field values. **PUT replaces the whole record**:
any field left out is cleared, and required fields must be present.

| Field type | JSON value | Rules |
|---|---|---|
| `string`, `text` | string | `maxLength` if set |
| `number` | number | `min`/`max` if set; numbers sent as strings (`"5"`) are rejected |
| `boolean` | `true` / `false` | |
| `date` | `"YYYY-MM-DD"` | Must be a real calendar date; no time part |
| `enum` | string | Must exactly match one of the field's `options` |

- Missing, `null`, and (for `string`/`text`) `""` all mean "no value" and are
  stored as `null`. A `required` field must have a value.
- Built-in fields (`id`, `createdAt`, `updatedAt`) in the body are silently
  ignored, so a fetched record can be edited and sent back as-is.
- Unknown fields are rejected.
- Every problem is reported at once.

## Errors

Every error has the same shape:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Record is invalid",
    "details": [
      { "fieldId": "fullName", "message": "is required" },
      { "fieldId": "age", "message": "is not a field of Applicant" }
    ]
  }
}
```

| Situation | Status | `code` |
|---|---|---|
| Invalid record, or body is not a JSON object | 400 | `validation_failed` |
| Malformed JSON | 400 | `invalid_json` |
| Unknown object | 404 | `object_not_found` |
| Unknown record id | 404 | `record_not_found` |
| Unknown API route | 404 | `not_found` |
| Unexpected server error | 500 | `internal_error` |

## Storage

Records are stored in SQLite, at `data/mazeforge.db` by default (override with
the `DATABASE_PATH` environment variable). Each object has its own table; see
[schema-format.md](schema-format.md#storage-and-schema-changes) for how tables
follow schema changes.
