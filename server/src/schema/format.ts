import { z } from "zod";

/**
 * Object schema format, version 1. Full spec: docs/schema-format.md
 *
 * An object (e.g. "Applicant") is defined by one JSON file,
 * schemas/<objectId>.json. Records are instances of an object.
 *
 * objectId and fieldId are generated from the label once, at creation time
 * (see generateId.ts), and never change afterwards. The loader only reads them.
 */

export const SCHEMA_FORMAT_VERSION = 1;

/**
 * Built-in fields every record gets automatically. No schema field may use
 * these ids.
 *   id         short UUID (short-uuid library), assigned when the record is created
 *   createdAt  timestamp of creation
 *   updatedAt  timestamp of the last update
 */
export const BUILT_IN_FIELD_IDS = ["id", "createdAt", "updatedAt"] as const;

const ID_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

// Reports a missing property as "is required" rather than zod's generic type error.
const requiredString = () =>
  z.string({ error: (iss) => (iss.input === undefined ? "is required" : "must be a string") });

const idSchema = requiredString().regex(
  ID_PATTERN,
  "must be camelCase: a lowercase letter followed by letters or digits",
);

const labelSchema = requiredString().trim().min(1, "must not be empty");

// Checked per field (not on the whole object) so the error is reported
// alongside any other problems in the file.
const fieldIdSchema = idSchema.refine(
  (id) => !(BUILT_IN_FIELD_IDS as readonly string[]).includes(id),
  { error: (iss) => `"${String(iss.input)}" is a built-in field and cannot be redefined` },
);

// Properties shared by every field type.
const baseField = {
  fieldId: fieldIdSchema,
  label: labelSchema,
  required: z.boolean().optional(),
};

const maxLengthSchema = z.number().int().positive().optional();

const stringField = z.strictObject({
  ...baseField,
  type: z.literal("string"), // single-line text
  maxLength: maxLengthSchema,
});

const textField = z.strictObject({
  ...baseField,
  type: z.literal("text"), // multi-line text
  maxLength: maxLengthSchema,
});

const numberField = z
  .strictObject({
    ...baseField,
    type: z.literal("number"),
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .refine((f) => f.min === undefined || f.max === undefined || f.min <= f.max, {
    message: "min must not be greater than max",
    path: ["min"],
  });

const booleanField = z.strictObject({
  ...baseField,
  type: z.literal("boolean"),
});

const dateField = z.strictObject({
  ...baseField,
  type: z.literal("date"),
});

const enumField = z.strictObject({
  ...baseField,
  type: z.literal("enum"), // one value from a fixed list
  options: z
    .array(z.string().min(1, "must not be empty"))
    .min(1, "must list at least one option")
    .refine((opts) => new Set(opts).size === opts.length, "must not contain duplicates"),
});

export const FIELD_TYPES = ["string", "text", "number", "boolean", "date", "enum"] as const;

export const fieldSchema = z.discriminatedUnion("type", [
  stringField,
  textField,
  numberField,
  booleanField,
  dateField,
  enumField,
]);

export const objectSchema = z
  .strictObject({
    formatVersion: z.literal(SCHEMA_FORMAT_VERSION),
    objectId: idSchema,
    label: labelSchema,
    // Field order carries no meaning; form layout is defined separately.
    fields: z.array(fieldSchema).min(1, "must define at least one field"),
  })
  .superRefine((obj, ctx) => {
    const seen = new Set<string>();
    obj.fields.forEach((field, i) => {
      if (seen.has(field.fieldId)) {
        ctx.addIssue({
          code: "custom",
          path: ["fields", i, "fieldId"],
          message: `duplicate fieldId "${field.fieldId}"`,
        });
      }
      seen.add(field.fieldId);
    });
  });

export type FieldType = (typeof FIELD_TYPES)[number];
export type FieldSchema = z.infer<typeof fieldSchema>;
export type ObjectSchema = z.infer<typeof objectSchema>;
