import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from './database.mjs';
import { createApi } from './server.mjs';
let db, server, base;
before(async () => {
  db = openDatabase(':memory:'); server = createApi(db);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
const state = async id => (await fetch(`${base}/accounts/${id}/state`)).json();
async function action(id, input, requestId = randomUUID()) {
  const response = await fetch(`${base}/accounts/${id}/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, requestId }) });
  return { status: response.status, data: await response.json() };
}
test('three seeded RON accounts have distinct correct tiers and ranges', async () => {
  const accounts = await (await fetch(`${base}/accounts`)).json();
  assert.deepEqual(accounts.map(a => [a.id, a.tier, a.balance]), [['demo-1', 1, 750], ['demo-2', 2, 3500], ['demo-3', 3, 8500]]);
});
test('tier 1 cannot bypass investment restriction with forged tier or cash', async () => {
  const before = await state('demo-1');
  const result = await action('demo-1', { action: 'trade', symbol: 'F', side: 'buy', qty: '1', tierLevel: 3, cash: 10000 });
  assert.equal(result.status, 403);
  assert.match(result.data.error, /higher tier/);
  assert.deepEqual(await state('demo-1'), before);
});
test('tier 2 and tier 3 can buy and sell; state is authoritative', async () => {
  for (const id of ['demo-2', 'demo-3']) {
    const before = await state(id);
    const buy = await action(id, { action: 'trade', symbol: 'F', side: 'buy', qty: '2' });
    assert.equal(buy.status, 200);
    assert.equal(buy.data.state.holdings.F.qty, 2);
    assert.equal(buy.data.state.cash, before.cash - 24.36);
    const sell = await action(id, { action: 'trade', symbol: 'F', side: 'sell', qty: '2' });
    assert.equal(sell.data.state.cash, before.cash);
  }
});
test('invalid amounts, insufficient cash, holdings and allowance fail without changes', async () => {
  const before = await state('demo-2');
  for (const input of [
    { action: 'deposit', amount: '-1' }, { action: 'deposit', amount: 'Infinity' },
    { action: 'withdraw', amount: '999999' },
    { action: 'trade', symbol: 'F', side: 'buy', qty: '1.5' },
    { action: 'trade', symbol: 'F', side: 'sell', qty: '1' },
    { action: 'trade', symbol: 'AAPL', side: 'buy', qty: '2' },
    { action: 'trade', symbol: 'F', side: 'invalid', qty: '1' },
  ]) assert.equal((await action('demo-2', input)).status, 400);
  assert.deepEqual(await state('demo-2'), before);
});
test('duplicate deposit is applied once and request IDs cannot change meaning', async () => {
  const id = randomUUID();
  const input = { action: 'deposit', amount: '10.25' };
  const before = await state('demo-1');
  assert.equal((await action('demo-1', input, id)).status, 200);
  assert.equal((await action('demo-1', input, id)).status, 200);
  assert.equal((await state('demo-1')).cash, before.cash + 10.25);
  assert.equal((await action('demo-1', { ...input, amount: '20' }, id)).status, 409);
});
test('concurrent withdrawals cannot overspend the account', async () => {
  await action('demo-1', { action: 'reset' });
  const results = await Promise.all([action('demo-1', { action: 'withdraw', amount: '500' }), action('demo-1', { action: 'withdraw', amount: '500' })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
  assert.equal((await state('demo-1')).cash, 250);
});
test('reward codes persist and lessons require a valid server-checked answer', async () => {
  const first = await action('demo-1', { action: 'redeem', rewardId: 'r-coffee' });
  const second = await action('demo-1', { action: 'redeem', rewardId: 'r-coffee' });
  assert.equal(first.data.state.redeemed['r-coffee'], second.data.state.redeemed['r-coffee']);
  assert.equal((await action('demo-1', { action: 'redeem', rewardId: 'r-books' })).status, 400);
  assert.equal((await action('demo-1', { action: 'lesson', lessonId: 'l-budget', answer: 0 })).status, 400);
  assert.equal((await action('demo-1', { action: 'lesson', lessonId: 'l-budget', answer: 2 })).status, 200);
  assert.equal((await action('demo-1', { action: 'lesson', lessonId: 'unknown', answer: 0 })).status, 400);
  const lessons = await (await fetch(`${base}/lessons`)).json();
  assert.ok(lessons.length >= 5);
});
test('reset affects only selected account', async () => {
  const other = await state('demo-2');
  const reset = await action('demo-1', { action: 'reset' });
  assert.equal(reset.data.state.cash, 750);
  assert.equal(reset.data.state.tierLevel, 1);
  assert.deepEqual(await state('demo-2'), other);
});
test('SQLite persists account changes across reopening and seed reruns', () => {
  const folder = mkdtempSync(join(tmpdir(), 'stagewise-db-'));
  const path = join(folder, 'test.sqlite');
  try {
    let disk = openDatabase(path);
    disk.prepare('UPDATE accounts SET cash_bani = 12345 WHERE id = ?').run('demo-1');
    disk.close();
    disk = openDatabase(path);
    assert.equal(disk.prepare('SELECT cash_bani FROM accounts WHERE id = ?').get('demo-1').cash_bani, 12345);
    disk.close();
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
