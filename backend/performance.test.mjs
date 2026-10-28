import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase } from './database.mjs';
import { LESSONS } from '../src/data/mock.ts';
import { createApi } from './server.mjs';

async function fixture(demoMode, fn) {
  const db = openDatabase(':memory:');
  let price = 20, source = 'alpaca', stale = false;
  const quote = symbol => ({ symbol, price, live: source === 'alpaca', source, currency: 'RON', rate: 4.57, asOf: source === 'alpaca' ? new Date(Date.now() - (stale ? 5 * 86400000 : 0)).toISOString() : null });
  const marketData = { getQuote: async symbol => quote(symbol), getQuotes: async symbols => ({ quotes: symbols.map(quote), rate: 4.57 }) };
  const server = createApi(db, { demoMode, marketData });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const root = `http://127.0.0.1:${server.address().port}/api/accounts`;
  const act = async (id, body, requestId = randomUUID()) => {
    const response = await fetch(`${root}/${id}/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, requestId }) });
    return { status: response.status, data: await response.json() };
  };
  const get = async (id, route = 'performance') => {
    const response = await fetch(`${root}/${id}/${route}`);
    return { status: response.status, data: await response.json() };
  };
  try { await fn({ db, act, get, marketData, setPrice: value => { price = value; }, setSource: value => { source = value; }, setStale: value => { stale = value; } }); }
  finally { await new Promise(resolve => server.close(resolve)); db.close(); }
}
test('tracker persists opening valuations, excludes cash flows and never promotes based on returns', () => fixture(false, async ({ db, act, get, setPrice }) => {
  assert.equal((await act('demo-1', { action: 'performance-start' })).status, 403);
  assert.equal((await get('demo-1')).status, 403);
  assert.equal((await act('demo-2', { action: 'performance-start' })).status, 400);
  await act('demo-2', { action: 'trade', symbol: 'F', side: 'buy', qty: '5' });
  const key = randomUUID();
  const started = await act('demo-2', { action: 'performance-start', openingValue: 1, tierLevel: 3 }, key);
  assert.equal(started.status, 200);
  assert.equal(started.data.state.performance.openingValue, 3500);
  assert.equal(started.data.state.performance.mode, 'market');
  assert.equal((await act('demo-2', { action: 'performance-start', openingValue: 1, tierLevel: 3 }, key)).status, 200);
  assert.equal(db.prepare('SELECT count(*) AS n FROM performance_snapshots').get().n, 1);
  setPrice(22);
  let report = (await get('demo-2')).data;
  assert.equal(report.run.latest.netGain, 10);
  await act('demo-2', { action: 'deposit', amount: '1000' });
  await act('demo-2', { action: 'withdraw', amount: '100' });
  report = (await get('demo-2')).data;
  assert.equal(report.run.latest.netCashFlow, 900);
  assert.equal(report.run.latest.netGain, 10);
  assert.ok(report.snapshots.length >= 3);
  assert.equal(report.promotion, 'tracking');
  const state = (await get('demo-2', 'state')).data;
  assert.equal(state.tierLevel, 2);
  assert.ok(state.performance.id);
  const order = state.transactions.find(t => t.kind === 'trade');
  assert.deepEqual([order.execution.priceRON, order.execution.feesRON, order.execution.source], [20, 0, 'alpaca']);
  await act('demo-2', { action: 'trade', symbol: 'F', side: 'sell', qty: '5' });
  assert.equal((await get('demo-2')).data.run.latest.netGain, 10);
}));
test('missing or stale live prices preserve the last snapshot and cannot settle tracked orders', () => fixture(false, async ({ act, get, setSource, setStale }) => {
  await act('demo-2', { action: 'trade', symbol: 'F', side: 'buy', qty: '2' });
  setSource('static');
  assert.equal((await act('demo-2', { action: 'performance-start' })).status, 400);
  setSource('alpaca');
  await act('demo-2', { action: 'performance-start' });
  const baseline = (await get('demo-2')).data.run.latest;
  setStale(true);
  const report = (await get('demo-2')).data;
  assert.ok(report.dataIssue);
  assert.deepEqual(report.run.latest, baseline);
  assert.equal((await act('demo-2', { action: 'trade', symbol: 'F', side: 'buy', qty: '1' })).status, 400);
  setStale(false); setSource('static');
  assert.equal((await act('demo-2', { action: 'trade', symbol: 'F', side: 'buy', qty: '1' })).status, 400);
}));
test('demo-clock advancement cannot fabricate closing market valuations or promotion', () => fixture(true, async ({ act, get, setSource }) => {
  setSource('static');
  await act('demo-2', { action: 'trade', symbol: 'F', side: 'buy', qty: '2' });
  await act('demo-2', { action: 'performance-start' });
  const initial = (await get('demo-2')).data.run.latest;
  for (let i = 0; i < 4; i++) await act('demo-2', { action: 'advance-month' });
  const report = (await get('demo-2')).data;
  assert.equal(report.elapsedDays, 90);
  assert.equal(report.status, 'ended');
  assert.ok(report.dataIssue.includes('closing historical'));
  assert.deepEqual(report.run.latest, initial);
  assert.equal((await get('demo-2', 'state')).data.tierLevel, 2);
  await act('demo-2', { action: 'reset' });
  assert.equal((await get('demo-2')).data.run, null);
}));
test('market-data waits do not hold a SQLite transaction or overwrite concurrent cash changes', () => fixture(false, async ({ act, get, marketData }) => {
  let release;
  marketData.getQuote = () => new Promise(resolve => { release = resolve; });
  const order = act('demo-2', { action: 'trade', symbol: 'F', side: 'buy', qty: '1' });
  while (!release) await new Promise(resolve => setTimeout(resolve, 1));
  const deposit = await act('demo-2', { action: 'deposit', amount: '100' });
  assert.equal(deposit.status, 200);
  release({ symbol: 'F', price: 20, live: true, source: 'alpaca', currency: 'RON', rate: 4.57, asOf: new Date().toISOString() });
  assert.equal((await order).status, 200);
  assert.equal((await get('demo-2', 'state')).data.cash, 3580);
}));

test('Tier 3 unlocks with a losing portfolio after discipline, full saving months, reserve and lessons', () => fixture(true, async ({ db, act, get, setPrice }) => {
  for (const symbol of ['F', 'ABC']) assert.equal((await act('demo-2', { action: 'trade', symbol, side: 'buy', qty: '5' })).status, 200);
  await act('demo-2', { action: 'performance-start' });
  for (const lesson of LESSONS.filter(l => l.requiresLevel <= 2)) await act('demo-2', { action: 'lesson', lessonId: lesson.id, answer: lesson.question.correct });
  setPrice(5);
  assert.ok((await get('demo-2')).data.run.latest.netGain < 0);
  for (let i = 0; i < 3; i++) {
    await act('demo-2', { action: 'advance-month' });
    const saved = await act('demo-2', { action: 'deposit', amount: '700', tierLevel: 3, eligible: true });
    assert.equal(saved.data.state.tierLevel, 2, 'month must close before it counts');
  }
  const promoted = await act('demo-2', { action: 'advance-month' });
  assert.equal(promoted.data.state.tierLevel, 3);
  assert.ok(promoted.data.state.performance.assessment.promotedAt);
  assert.ok(promoted.data.state.mastery);
  assert.equal(promoted.data.state.cash, 5400, 'promotion never credits an unfunded reward');
  assert.equal((await get('demo-2')).data.promotion, 'promoted');
  assert.equal(db.prepare('SELECT tier FROM accounts WHERE id = ?').get('demo-2').tier, 3);
}));
test('profit and forged eligibility cannot replace saving months or lessons', () => fixture(true, async ({ act, get, setPrice }) => {
  for (const symbol of ['F', 'ABC']) await act('demo-2', { action: 'trade', symbol, side: 'buy', qty: '5' });
  await act('demo-2', { action: 'performance-start', compliantSince: '2020-01-01', savingMonths: 3 });
  setPrice(200);
  assert.ok((await get('demo-2')).data.run.latest.netGain > 0);
  for (let i = 0; i < 4; i++) await act('demo-2', { action: 'advance-month', eligible: true, completedLessons: LESSONS.map(l => l.id) });
  assert.equal((await get('demo-2', 'state')).data.tierLevel, 2);
}));
test('selling into concentration restarts only the discipline timer and preserves history', () => fixture(true, async ({ act, get }) => {
  for (const symbol of ['F', 'ABC']) await act('demo-2', { action: 'trade', symbol, side: 'buy', qty: '5' });
  const initial = await act('demo-2', { action: 'performance-start' });
  await act('demo-2', { action: 'advance-month' });
  const breached = await act('demo-2', { action: 'trade', symbol: 'F', side: 'sell', qty: '5' });
  assert.equal(breached.data.state.performance.assessment.compliantSince, null);
  assert.ok(breached.data.state.performance.assessment.lastBreachAt);
  const repaired = await act('demo-2', { action: 'trade', symbol: 'F', side: 'buy', qty: '5' });
  assert.notEqual(repaired.data.state.performance.assessment.compliantSince, initial.data.state.performance.assessment.compliantSince);
  assert.equal(repaired.data.state.performance.id, initial.data.state.performance.id);
  assert.equal(repaired.data.state.cash, 3300);
  assert.ok((await get('demo-2')).data.snapshots.length);
}));
