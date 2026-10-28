import { accountNow } from './demo-clock.mjs';
import { financialFingerprint, performanceValuation, elapsedDays } from '../src/lib/performance.ts';
export function saveSnapshot(db, accountId, run) {
  db.prepare('INSERT INTO performance_snapshots (account_id, run_id, observed_at, body_json) VALUES (?, ?, ?, ?)').run(accountId, run.id, run.latest.observedAt, JSON.stringify(run.latest));
}
export function performanceReport(db, state, demoMode, issue = null) {
  const run = state.performance ?? null;
  const now = accountNow(state, demoMode);
  const snapshots = run ? db.prepare('SELECT body_json FROM performance_snapshots WHERE account_id = ? AND run_id = ? ORDER BY id DESC LIMIT 20').all(state.accountId, run.id).map(row => JSON.parse(row.body_json)).reverse() : [];
  return { run, elapsedDays: run ? elapsedDays(run, now) : 0, status: !run ? 'not-started' : now >= new Date(run.endsAt) ? 'ended' : 'tracking', dataIssue: issue, snapshots, promotion: state.tierLevel === 3 ? 'promoted' : run?.assessment ? 'tracking' : 'pending' };
}
export async function refreshPerformance(db, id, read, marketData, demoMode) {
  const before = read(id);
  if (!before.performance) return performanceReport(db, before, demoMode);
  const now = accountNow(before, demoMode);
  if (now > new Date(before.performance.endsAt)) return performanceReport(db, before, demoMode, 'Window ended. Last in-window valuation shown; closing historical valuation remains pending.');
  let locked = false;
  try {
    const bundle = await marketData.getQuotes(Object.keys(before.holdings));
    db.exec('BEGIN IMMEDIATE'); locked = true;
    const current = read(id);
    if (financialFingerprint(current) !== financialFingerprint(before)) throw new Error('Account changed while prices loaded. Refresh to capture the updated portfolio.');
    const latest = performanceValuation(current, bundle.quotes, accountNow(current, demoMode), new Date());
    const old = current.performance.latest;
    const changed = latest.accountValue !== old.accountValue || latest.netCashFlow !== old.netCashFlow || latest.holdingsValue !== old.holdingsValue || latest.feesRON !== old.feesRON || latest.returnPercent !== old.returnPercent;
    const record = changed || new Date(latest.observedAt) - new Date(old.observedAt) >= 3600000;
    if (record) {
      const next = { ...current, performance: { ...current.performance, latest } };
      db.prepare('UPDATE accounts SET state_json = ? WHERE id = ?').run(JSON.stringify(next), id);
      saveSnapshot(db, id, next.performance);
      db.exec('COMMIT'); locked = false;
      return performanceReport(db, next, demoMode);
    }
    db.exec('COMMIT'); locked = false;
    return performanceReport(db, current, demoMode);
  } catch (error) {
    if (locked) db.exec('ROLLBACK');
    return performanceReport(db, read(id), demoMode, error.message);
  }
}
