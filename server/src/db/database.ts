import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type Db = Database.Database;

/** Opens (or creates) the database. Pass ":memory:" for a throwaway database. */
export function openDatabase(filePath: string): Db {
  if (filePath !== ":memory:") mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  // WAL lets reads proceed while a write is in progress.
  db.pragma("journal_mode = WAL");
  // Enforced from the start, ready for references between objects (V2-04).
  db.pragma("foreign_keys = ON");
  return db;
}
