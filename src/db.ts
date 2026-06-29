import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "fs";

const DB_PATH = process.env.DB_PATH || "/data/clients.db";
const dir = DB_PATH.substring(0, DB_PATH.lastIndexOf("/"));
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);
db.exec("PRAGMA journal_mode=WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    device_id      TEXT,
    cf_token       TEXT,
    wg_private_key TEXT,
    config         TEXT,
    status         TEXT  DEFAULT 'active',
    error          TEXT,
    created_at     TEXT  DEFAULT (datetime('now')),
    last_refreshed TEXT
  )
`);

export interface Client {
  id: number;
  name: string;
  device_id: string | null;
  cf_token: string | null;
  wg_private_key: string | null;
  config: string | null;
  status: string;
  error: string | null;
  created_at: string | null;
  last_refreshed: string | null;
}

export function all(): Client[] {
  return db.query("SELECT * FROM clients ORDER BY created_at DESC").all() as Client[];
}

export function get(id: number): Client | null {
  return db.query("SELECT * FROM clients WHERE id = ?").get(id) as Client | null;
}

export function create(
  name: string, device_id: string, cf_token: string,
  wg_private_key: string, config: string
): number {
  const now = new Date().toISOString().replace("T", " ").substring(0, 19);
  const r = db.run(
    "INSERT INTO clients (name,device_id,cf_token,wg_private_key,config,last_refreshed) VALUES(?,?,?,?,?,?)",
    [name, device_id, cf_token, wg_private_key, config, now]
  );
  return Number(r.lastInsertRowid);
}

export function updateConfig(id: number, config: string): void {
  const now = new Date().toISOString().replace("T", " ").substring(0, 19);
  db.run("UPDATE clients SET config=?,last_refreshed=?,status='active',error=NULL WHERE id=?", [config, now, id]);
}

export function markError(id: number, error: string): void {
  const now = new Date().toISOString().replace("T", " ").substring(0, 19);
  db.run("UPDATE clients SET status='error',error=?,last_refreshed=? WHERE id=?", [error, now, id]);
}

export function remove(id: number): void {
  db.run("DELETE FROM clients WHERE id=?", [id]);
}
