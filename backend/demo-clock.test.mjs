import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { advanceCalendarMonth } from './demo-clock.mjs';
import { openDatabase } from './database.mjs';
import { createApi } from './server.mjs';

test('calendar advancement clamps month-end and handles leap years, year rollover and DST', () => {
  assert.equal(advanceCalendarMonth(new Date('2026-01-31T12:00:00Z')).toISOString(), '2026-02-28T10:00:00.000Z');
  assert.equal(advanceCalendarMonth(new Date('2028-01-31T12:00:00Z')).toISOString(), '2028-02-29T10:00:00.000Z');
  assert.equal(advanceCalendarMonth(new Date('2026-12-31T12:00:00Z')).toISOString(), '2027-01-31T10:00:00.000Z');
  assert.equal(advanceCalendarMonth(new Date('2026-03-15T12:00:00Z')).toISOString(), '2026-04-15T09:00:00.000Z');
});
async function withApi(demoMode, fn) {
  const db = openDatabase(':memory:');
  const server = createApi(db, { demoMode });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const get = async id => (await fetch(`${base}/accounts/${id}/state`)).json();
  const act = async (id, input, requestId = randomUUID()) => {
    const response = await fetch(`${base}/accounts/${id}/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, requestId }) });
    return { status: response.status, data: await response.json() };
  };
  try { await fn({ base, db, get, act }); }
  finally { await new Promise(resolve => server.close(resolve)); db.close(); }
}
test('disabled servers hide and reject demo controls even with forged client flags', () => withApi(false, async ({ get, act }) => {
  assert.equal((await get('demo-1')).demoTimelineEnabled, false);
  assert.equal((await act('demo-1', { action: 'advance-month', demoTimelineEnabled: true })).status, 403);
}));
test('judge journey: create, learn, deposit and advance through three months to Tier 2', () => withApi(true, async ({ base, get, act, db }) => {
  const response = await fetch(`${base}/accounts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: randomUUID(), name: 'Demo Presenter', email: 'presenter@example.com', monthlyIncome: '5000', demoClockOffsetMs: 999999999999 }) });
  const created = await response.json();
  const id = created.accountId;
  assert.equal(created.demoTimelineEnabled, true);
  assert.equal(created.demoClockOffsetMs, undefined);
  const otherBefore = await get('demo-2');
  await act(id, { action: 'lesson', lessonId: 'l-budget', answer: 2 });
  await act(id, { action: 'lesson', lessonId: 'l-emergency', answer: 1 });
  let result = await act(id, { action: 'deposit', amount: '500' });
  assert.equal(result.data.state.tierLevel, 1);
  for (let month = 0; month < 2; month++) {
    const before = await get(id);
    const advance = await act(id, { action: 'advance-month' });
    assert.equal(advance.status, 200);
    assert.equal(advance.data.state.cash, before.cash);
    assert.deepEqual(advance.data.state.transactions, before.transactions);
    const deposit = await act(id, { action: 'deposit', amount: '500', date: '2099-01-01', tierLevel: 3 });
    assert.equal(deposit.status, 200);
    assert.ok(Math.abs(new Date(deposit.data.state.transactions[0].date) - new Date(advance.data.state.serverNow)) < 10000);
  }
  const final = await get(id);
  assert.equal(final.tierLevel, 2);
  assert.equal(final.cash, 1500);
  assert.equal(final.transactions.length, 3);
  assert.equal(db.prepare('SELECT tier FROM accounts WHERE id = ?').get(id).tier, 2);
  const otherAfter = await get('demo-2');
  assert.equal(otherAfter.demoClockOffsetMs, otherBefore.demoClockOffsetMs);
  assert.equal(otherAfter.cash, otherBefore.cash);
  assert.equal(final.demoClockOffsetMs, (await get(id)).demoClockOffsetMs);
}));
test('skipping a month breaks the streak; retries advance once and reset restores real time', () => withApi(true, async ({ get, act }) => {
  await act('demo-1', { action: 'reset' });
  await act('demo-1', { action: 'deposit', amount: '500' });
  const key = randomUUID();
  const first = await act('demo-1', { action: 'advance-month' }, key);
  const repeated = await act('demo-1', { action: 'advance-month' }, key);
  assert.equal(first.data.state.demoClockOffsetMs, repeated.data.state.demoClockOffsetMs);
  await act('demo-1', { action: 'advance-month' });
  const state = await get('demo-1');
  const { savingsProgress } = await import('../src/lib/demo-logic.ts');
  assert.equal(savingsProgress(state, new Date(state.serverNow)).streak, 0);
  assert.equal(state.cash, 1250);
  const reset = await act('demo-1', { action: 'reset' });
  assert.equal(reset.data.state.demoClockOffsetMs, 0);
  assert.ok(Math.abs(new Date(reset.data.state.serverNow) - Date.now()) < 10000);
}));
