import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { env } from '@/src/env';
import * as schema from '@/src/db/schema';

// Ensure the directory for the DB file exists (first boot on a fresh volume).
mkdirSync(dirname(env.DATABASE_PATH), { recursive: true });

// Single connection — single user, single container, one writer (spec §10.5).
export const sqlite = new Database(env.DATABASE_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

export type DB = typeof db;
