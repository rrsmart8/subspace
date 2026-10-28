import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LESSONS } from '../src/data/mock.ts';

const here = dirname(fileURLToPath(import.meta.url));
export function openDatabase(path = process.env.SQLITE_PATH || resolve(here, 'data/stagewise.sqlite')) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;');
  db.exec(readFileSync(resolve(here, 'schema.sql'), 'utf8'));
  db.exec(readFileSync(resolve(here, 'seed.sql'), 'utf8'));
  const insert = db.prepare('INSERT OR IGNORE INTO lessons (id, content_json) VALUES (?, ?)');
  for (const lesson of LESSONS) insert.run(lesson.id, JSON.stringify(lesson));
  return db;
}
export function readAccount(db, id) {
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  return row ? { ...JSON.parse(row.state_json), accountId: row.id, tierLevel: row.tier, cash: row.cash_bani / 100 } : null;
}
