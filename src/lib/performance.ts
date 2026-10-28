import type { DemoState } from "../data/mock.ts";
export interface PerformanceQuote { symbol: string; price: number; live: boolean; source: string; currency: string; rate: number; asOf: string | null }
export interface Valuation {
  observedAt: string; marketObservedAt: string; accountValue: number; holdingsValue: number;
  netCashFlow: number; netGain: number; returnPercent: number | null; feesRON: number;
  quotes: PerformanceQuote[];
}
export interface PerformanceRun {
  id: string; startedAt: string; endsAt: string; mode: "market" | "demo"; fxRate: number;
  openingValue: number; openingCash: number; openingHoldingsValue: number;
  openingTransactionIds: string[]; latest: Valuation;
  assessment?: {
    enrolledAt: string; monthlyTarget: number; requiredReserve: number;
    minPositions: number; maxPositionPercent: number; investPercent: number;
    compliantSince: string | null; lastBreachAt: string | null;
    promotedAt?: string;
  };
}
export interface PerformanceReport {
  run: PerformanceRun | null; elapsedDays: number; status: "not-started" | "tracking" | "ended";
  dataIssue: string | null; snapshots: Valuation[]; promotion: "pending" | "tracking" | "promoted";
}
const round = (value: number) => Math.round(value * 100) / 100;
const DAY = 86400000;
export function financialFingerprint(s: DemoState) {
  return JSON.stringify([s.cash, s.holdings, s.transactions.map(t => t.id), s.performance?.id]);
}
export function elapsedDays(run: PerformanceRun, now: Date) {
  return Math.max(0, Math.min(90, Math.floor((now.getTime() - new Date(run.startedAt).getTime()) / DAY)));
}
export function valuePortfolio(s: DemoState, quotes: PerformanceQuote[], mode: "market" | "demo", marketNow: Date, fxRate: number) {
  let holdingsValue = 0;
  const used: PerformanceQuote[] = [];
  for (const [symbol, holding] of Object.entries(s.holdings)) {
    if (!holding.qty) continue;
    const quote = quotes.find(q => q.symbol === symbol);
    if (!quote || !Number.isFinite(quote.price) || quote.price <= 0) throw new Error(`No usable price for ${symbol}. Last valuation is preserved.`);
    if (mode === "market") {
      const age = quote.asOf ? marketNow.getTime() - new Date(quote.asOf).getTime() : NaN;
      if (!quote.live || quote.source !== "alpaca" || quote.currency !== "RON" || !Number.isFinite(age) || age > 4 * DAY || age < -300000) throw new Error(`A recent timestamped market price is required for ${symbol}; fallback prices cannot value this tracker.`);
      if (quote.rate !== fxRate) throw new Error("The configured RON conversion rate changed. Restore the opening rate before refreshing this tracker.");
    }
    holdingsValue += holding.qty * quote.price;
    used.push(quote);
  }
  if (!Number.isSafeInteger(Math.round((s.cash + holdingsValue) * 100))) throw new Error("Portfolio value exceeds supported precision.");
  return { accountValue: round(s.cash + holdingsValue), holdingsValue: round(holdingsValue), quotes: used };
}
export function startPerformance(s: DemoState, quotes: PerformanceQuote[], id: string, now: Date, marketNow: Date, demoMode: boolean, fxRate: number): PerformanceRun {
  if (s.tierLevel !== 2) throw new Error("Performance tracking starts at Tier 2.");
  if (s.performance) throw new Error("A tracking period already exists for this account.");
  if (!Object.values(s.holdings).some(h => h.qty > 0)) throw new Error("Make your first investment before starting the tracker.");
  if (!Number.isFinite(fxRate) || fxRate <= 0) throw new Error("A valid RON conversion rate is required.");
  const mode = demoMode ? "demo" : "market";
  const value = valuePortfolio(s, quotes, mode, marketNow, fxRate);
  if (value.accountValue <= 0) throw new Error("A positive opening account value is required.");
  const latest: Valuation = { ...value, observedAt: now.toISOString(), marketObservedAt: marketNow.toISOString(), netCashFlow: 0, netGain: 0, returnPercent: 0, feesRON: 0 };
  return { id, startedAt: now.toISOString(), endsAt: new Date(now.getTime() + 90 * DAY).toISOString(), mode, fxRate, openingValue: value.accountValue, openingCash: s.cash, openingHoldingsValue: value.holdingsValue, openingTransactionIds: s.transactions.map(t => t.id), latest };
}
export function performanceValuation(s: DemoState, quotes: PerformanceQuote[], now: Date, marketNow: Date): Valuation {
  const run = s.performance;
  if (!run) throw new Error("Start a tracking period first.");
  if (now.getTime() < new Date(run.startedAt).getTime()) throw new Error("Tracking clock precedes the opening valuation. Restore its presentation clock or use a separate database.");
  if (now.getTime() > new Date(run.endsAt).getTime()) throw new Error("The 90-day window has ended. A closing historical valuation is required; the last in-window snapshot is shown.");
  const openingIds = new Set(run.openingTransactionIds);
  let netCashFlow = 0, weightedFlows = 0, feesRON = 0;
  const duration = now.getTime() - new Date(run.startedAt).getTime();
  for (const t of s.transactions) {
    if (openingIds.has(t.id) || t.status !== "completed") continue;
    const timestamp = new Date(t.date).getTime();
    if (!Number.isFinite(timestamp) || timestamp < new Date(run.startedAt).getTime() || timestamp > now.getTime()) throw new Error("Transaction times do not match the tracking period. Refresh is paused.");
    if (t.kind === "deposit" || t.kind === "withdrawal") {
      const flow = t.kind === "deposit" ? t.amount : -t.amount;
      netCashFlow += flow;
      weightedFlows += flow * (duration > 0 ? (now.getTime() - timestamp) / duration : 0);
    } else if (t.kind === "trade" && t.execution) {
      if (run.mode === "market" && (t.execution.source !== "alpaca" || t.execution.rate !== run.fxRate)) throw new Error("An order used incompatible price data; performance refresh is paused.");
      if (!Number.isFinite(t.execution.feesRON) || t.execution.feesRON < 0) throw new Error("Invalid recorded order fees require reconciliation.");
      feesRON += t.execution.feesRON;
    } else throw new Error("An unclassified transaction needs reconciliation before performance can be calculated.");
  }
  const value = valuePortfolio(s, quotes, run.mode, marketNow, run.fxRate);
  const netGain = round(value.accountValue - run.openingValue - netCashFlow);
  const denominator = run.openingValue + weightedFlows;
  // Timestamp-weighted Modified Dietz estimate, not a guaranteed/exact TWR.
  const returnPercent = denominator > 0 ? Math.round(netGain / denominator * 1000000) / 10000 : null;
  return { ...value, observedAt: now.toISOString(), marketObservedAt: marketNow.toISOString(), netCashFlow: round(netCashFlow), netGain, returnPercent, feesRON: round(feesRON) };
}
