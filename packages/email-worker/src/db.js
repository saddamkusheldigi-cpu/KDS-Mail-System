import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../../");
const DB_DIR = process.env.DATA_DIR || rootDir;
const DB_FILE = path.join(DB_DIR, "inbox_mailer.db");

let db = null;

export function getWorkerDb() {
  if (db) return db;
  fs.mkdirSync(DB_DIR, { recursive: true });
  db = new DatabaseSync(DB_FILE);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  return db;
}
