import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type SessionStatus =
  | "active"
  | "broken"
  | "cancelled"
  | "too_short"
  | "attest_failed"
  | "attested";

export interface FocusSession {
  id: string;
  wallet: string;
  commitment: string;
  day_index: number;
  focus_minutes: number;
  started_at: number;
  last_heartbeat: number;
  ended_at: number | null;
  status: SessionStatus;
  tx_signature: string | null;
  error: string | null;
}

export type Db = Database.Database;

export function openDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_nonces (
      nonce TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      message TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS focus_sessions (
      id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      commitment TEXT NOT NULL,
      day_index INTEGER NOT NULL,
      focus_minutes INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      last_heartbeat INTEGER NOT NULL,
      ended_at INTEGER,
      status TEXT NOT NULL,
      tx_signature TEXT,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS focus_sessions_wallet_status ON focus_sessions (wallet, status);
    -- At most one in-flight session per wallet, and one attested session per commitment-day.
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_per_wallet
      ON focus_sessions (wallet) WHERE status = 'active';
    CREATE UNIQUE INDEX IF NOT EXISTS one_attested_per_day
      ON focus_sessions (commitment, day_index) WHERE status = 'attested';
  `);
  return db;
}
