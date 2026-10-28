import { accountNow, stampAccount } from './demo-clock.mjs';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promoteSavingsTier } from '../src/lib/demo-logic.ts';
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
  // Add income/enrollment metadata without replacing existing balances or history.
  for (const row of db.prepare('SELECT id, state_json FROM accounts').all()) {
    const state = JSON.parse(row.state_json);
    const incomes = { 'demo-1': 5000, 'demo-2': 7000, 'demo-3': 10000 };
    if (!state.profile.monthlyIncome && incomes[row.id]) {
      state.profile.monthlyIncome = incomes[row.id];
      state.savingsStartedAt = new Date().toISOString();
      db.prepare('UPDATE accounts SET state_json = ? WHERE id = ?').run(JSON.stringify(state), row.id);
    }
  }
  return db;
}
export function readAccount(db, id, { demoMode = false } = {}) {
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  if (!row) return null;
  const state = { ...JSON.parse(row.state_json), accountId: row.id, tierLevel: row.tier, cash: row.cash_bani / 100 };
  if (state.tierLevel === 3 && !state.mastery) {
    state.mastery = { enrolledAt: accountNow(state, demoMode).toISOString(), answers: {}, rewardClaims: {} };
    db.prepare('UPDATE accounts SET state_json = ? WHERE id = ?').run(JSON.stringify(state), id);
  }
  const next = promoteSavingsTier(state, accountNow(state, demoMode));
  if (next.tierLevel !== state.tierLevel) db.prepare('UPDATE accounts SET tier = ?, state_json = ? WHERE id = ?').run(next.tierLevel, JSON.stringify(next), id);
  return stampAccount(next, demoMode);
}
