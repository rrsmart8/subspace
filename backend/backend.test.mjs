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
  db = openDatabase(':memory:'); server = createApi(db, { demoMode: false });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
const state = async id => { const { serverNow, ...value } = await (await fetch(`${base}/accounts/${id}/state`)).json(); return value; };
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

test('server enforces stored percentage cap across repeated orders and deposits', async () => {
  await action('demo-2', { action: 'reset' });
  assert.equal((await action('demo-2', { action: 'trade', symbol: 'F', side: 'buy', qty: '28', investPercent: 100 })).status, 200);
  assert.equal((await action('demo-2', { action: 'trade', symbol: 'F', side: 'buy', qty: '1', investPercent: 100 })).status, 400);
  await action('demo-2', { action: 'deposit', amount: '100' });
  assert.equal((await action('demo-2', { action: 'trade', symbol: 'F', side: 'buy', qty: '1' })).status, 200);
  await action('demo-3', { action: 'reset' });
  // 25% of 8,500 = 2,125 RON: 174 Ford shares fit, 175 do not.
  assert.equal((await action('demo-3', { action: 'trade', symbol: 'F', side: 'buy', qty: '175' })).status, 400);
  assert.equal((await action('demo-3', { action: 'trade', symbol: 'F', side: 'buy', qty: '174' })).status, 200);
});

test('account setup validates income, creates Tier 1 in SQLite, and safely retries', async () => {
  const requestId = randomUUID();
  const input = { requestId, name: 'Test User', email: 'new@example.com', monthlyIncome: '6000', tierLevel: 3, cash: 100000 };
  const create = async value => {
    const response = await fetch(`${base}/accounts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
    return { status: response.status, data: await response.json() };
  };
  assert.equal((await create({ ...input, monthlyIncome: '-1' })).status, 400);
  const first = await create(input);
  assert.equal(first.status, 201);
  assert.equal(first.data.tierLevel, 1);
  assert.equal(first.data.cash, 0);
  assert.equal(first.data.profile.monthlyIncome, 6000);
  assert.equal((await create(input)).data.accountId, first.data.accountId);
  assert.equal((await create({ ...input, requestId: randomUUID() })).status, 409);
  assert.equal((await state(first.data.accountId)).profile.monthlyIncome, 6000);
  assert.equal((await action(first.data.accountId, { action: 'trade', symbol: 'F', side: 'buy', qty: '1' })).status, 403);
  assert.equal((await action(first.data.accountId, { action: 'reset' })).data.state.cash, 0);
});

test('server promotes Tier 1 only with the full income streak, balance and lessons', async () => {
  const id = 'demo-1';
  await action(id, { action: 'reset' });
  const seeded = await state(id);
  const now = new Date();
  const months = [2, 1, 0].map(offset => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1, 12)));
  // For tests running on the first day before noon, keep the current deposit in the past.
  months[2] = now;
  const transactions = months.map((date, index) => ({ id: `streak-${index}`, date: date.toISOString(), description: 'Deposit', kind: 'deposit', amount: 500, direction: 'in', status: 'completed' }));
  const candidate = { ...seeded, cash: 1500, savingsStartedAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1)).toISOString(), completedLessons: ['l-budget', 'l-emergency'], transactions };
  const write = value => db.prepare('UPDATE accounts SET tier = 1, cash_bani = ?, state_json = ? WHERE id = ?').run(Math.round(value.cash * 100), JSON.stringify(value), id);
  write({ ...candidate, transactions: transactions.slice(1) });
  assert.equal((await state(id)).tierLevel, 1);
  write({ ...candidate, completedLessons: [] });
  assert.equal((await state(id)).tierLevel, 1);
  write({ ...candidate, cash: 1000 });
  assert.equal((await state(id)).tierLevel, 1);
  write(candidate);
  assert.equal((await state(id)).tierLevel, 2);
  assert.equal(db.prepare('SELECT tier FROM accounts WHERE id = ?').get(id).tier, 2);
});

test('mastery endpoints reject lower tiers and forged quarter/reward fields', async () => {
  const before = await state('demo-3');
  assert.ok(before.mastery?.enrolledAt);
  assert.equal((await action('demo-2', { action: 'mastery-reward', quarterId: '2099-Q1', amountRON: 10000, eligible: true })).status, 400);
  assert.equal((await action('demo-3', { action: 'mastery-reward', quarterId: '2099-Q1', amountRON: 10000, eligible: true })).status, 400);
  assert.equal((await action('demo-3', { action: 'mastery-answer', quarterId: '2099-Q1', scenarioId: 'cash-flow', answer: 2 })).status, 400);
  assert.equal((await state('demo-3')).cash, before.cash);
  assert.deepEqual((await state('demo-3')).mastery.rewardClaims, {});
});
