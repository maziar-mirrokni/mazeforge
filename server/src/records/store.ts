import { generate as generateShortUuid } from "short-uuid";
import type { Db } from "../db/database.js";
import { BUILT_IN_COLUMNS, q, tableName } from "../db/tables.js";
import type { ObjectSchema } from "../schema/format.js";

export type FieldValue = string | number | boolean | null;

/** Values for an object's schema fields, keyed by fieldId. */
export type RecordValues = Record<string, FieldValue>;

/** A stored record: built-in fields plus the object's field values. */
export type StoredRecord = RecordValues & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Storage for records, keyed by objectId. Routes depend only on this
 * interface, so the backing store can change without touching them.
 */
export interface RecordStore {
  create(objectId: string, values: RecordValues): Promise<StoredRecord>;
  /** All records for the object, oldest first. */
  list(objectId: string): Promise<StoredRecord[]>;
  get(objectId: string, id: string): Promise<StoredRecord | undefined>;
  /** Replaces all field values; returns undefined if the record does not exist. */
  replace(objectId: string, id: string, values: RecordValues): Promise<StoredRecord | undefined>;
  /** Returns false if the record does not exist. */
  delete(objectId: string, id: string): Promise<boolean>;
}

type Row = Record<string, string | number | null>;

/**
 * Stores records in SQLite, one table per object (see db/tables.ts). Tables
 * must already match the schemas (syncTables runs at startup).
 */
export class SqliteRecordStore implements RecordStore {
  constructor(
    private readonly db: Db,
    private readonly schemas: Map<string, ObjectSchema>,
  ) {}

  private object(objectId: string): ObjectSchema {
    const object = this.schemas.get(objectId);
    if (!object) throw new Error(`Unknown object "${objectId}"`);
    return object;
  }

  /** Column list for SELECTs: built-ins first, then the object's fields. */
  private selectColumns(object: ObjectSchema): string {
    return [...BUILT_IN_COLUMNS, ...object.fields.map((f) => f.fieldId)].map(q).join(", ");
  }

  /** SQLite has no boolean type: booleans are stored as 0/1. */
  private toColumn(value: FieldValue): string | number | null {
    return typeof value === "boolean" ? Number(value) : value;
  }

  private toRecord(object: ObjectSchema, row: Row): StoredRecord {
    const record: Record<string, FieldValue> = {
      id: row.id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    for (const field of object.fields) {
      const value = row[field.fieldId] ?? null;
      record[field.fieldId] = field.type === "boolean" && value !== null ? value === 1 : value;
    }
    return record as StoredRecord;
  }

  async create(objectId: string, values: RecordValues): Promise<StoredRecord> {
    const object = this.object(objectId);
    const id = generateShortUuid();
    const now = new Date().toISOString();
    const fieldIds = object.fields.map((f) => f.fieldId);
    const columns = [...BUILT_IN_COLUMNS, ...fieldIds];
    this.db
      .prepare(
        `INSERT INTO ${q(tableName(objectId))} (${columns.map(q).join(", ")})
         VALUES (${columns.map(() => "?").join(", ")})`,
      )
      .run(id, now, now, ...fieldIds.map((f) => this.toColumn(values[f] ?? null)));
    return (await this.get(objectId, id))!;
  }

  async list(objectId: string): Promise<StoredRecord[]> {
    const object = this.object(objectId);
    const rows = this.db
      .prepare(
        // rowid breaks ties between records created in the same millisecond.
        `SELECT ${this.selectColumns(object)} FROM ${q(tableName(objectId))} ORDER BY "createdAt", rowid`,
      )
      .all() as Row[];
    return rows.map((row) => this.toRecord(object, row));
  }

  async get(objectId: string, id: string): Promise<StoredRecord | undefined> {
    const object = this.object(objectId);
    const row = this.db
      .prepare(`SELECT ${this.selectColumns(object)} FROM ${q(tableName(objectId))} WHERE "id" = ?`)
      .get(id) as Row | undefined;
    return row && this.toRecord(object, row);
  }

  async replace(objectId: string, id: string, values: RecordValues): Promise<StoredRecord | undefined> {
    const object = this.object(objectId);
    const fieldIds = object.fields.map((f) => f.fieldId);
    const assignments = ["updatedAt", ...fieldIds].map((c) => `${q(c)} = ?`).join(", ");
    const { changes } = this.db
      .prepare(`UPDATE ${q(tableName(objectId))} SET ${assignments} WHERE "id" = ?`)
      .run(new Date().toISOString(), ...fieldIds.map((f) => this.toColumn(values[f] ?? null)), id);
    return changes ? this.get(objectId, id) : undefined;
  }

  async delete(objectId: string, id: string): Promise<boolean> {
    this.object(objectId);
    const { changes } = this.db.prepare(`DELETE FROM ${q(tableName(objectId))} WHERE "id" = ?`).run(id);
    return changes > 0;
  }
}
