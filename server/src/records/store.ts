import { generate as generateShortUuid } from "short-uuid";

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
 * interface, so the backing store can change (V1-04: SQLite) without
 * touching them. Returned records are copies; mutating them has no effect.
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

/** Keeps records in memory; everything is lost on restart. */
export class InMemoryRecordStore implements RecordStore {
  // Map preserves insertion order, which gives oldest-first listing.
  private readonly records = new Map<string, Map<string, StoredRecord>>();

  private table(objectId: string): Map<string, StoredRecord> {
    let table = this.records.get(objectId);
    if (!table) {
      table = new Map();
      this.records.set(objectId, table);
    }
    return table;
  }

  async create(objectId: string, values: RecordValues): Promise<StoredRecord> {
    const now = new Date().toISOString();
    const record: StoredRecord = { ...values, id: generateShortUuid(), createdAt: now, updatedAt: now };
    this.table(objectId).set(record.id, record);
    return { ...record };
  }

  async list(objectId: string): Promise<StoredRecord[]> {
    return [...this.table(objectId).values()].map((r) => ({ ...r }));
  }

  async get(objectId: string, id: string): Promise<StoredRecord | undefined> {
    const record = this.table(objectId).get(id);
    return record && { ...record };
  }

  async replace(objectId: string, id: string, values: RecordValues): Promise<StoredRecord | undefined> {
    const table = this.table(objectId);
    const existing = table.get(id);
    if (!existing) return undefined;
    const record: StoredRecord = {
      ...values,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    table.set(id, record);
    return { ...record };
  }

  async delete(objectId: string, id: string): Promise<boolean> {
    return this.table(objectId).delete(id);
  }
}
