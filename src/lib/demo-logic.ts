import { DEMO_CONFIG, type Tier } from "../config/demo.ts";
import { LESSONS, STOCKS, type DemoState, type Transaction } from "../data/mock.ts";

export type Result = { ok: true; state: DemoState; message: string } | { ok: false; error: string };

export function parseAmount(raw: string): number | string {
  const t = raw.trim().replace(",", ".");
  if (!t) return "Enter an amount.";
  if (/^-/.test(t) && !isNaN(Number(t))) return "Amount must be greater than zero.";
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return "Enter a number with up to 2 decimals.";
  const n = Number(t);
  if (!Number.isSafeInteger(Math.round(n * 100)) || n > 100000000) return "Amount is too large.";
  if (n <= 0) return "Amount must be greater than zero.";
  return n;
}

const round = (n: number) => Math.round(n * 100) / 100;
const txn = (t: Omit<Transaction, "id" | "date" | "status">): Transaction => ({
  ...t, id: `t${Date.now()}${Math.floor(Math.random() * 1000)}`, date: new Date().toISOString(), status: "completed",
});

export function deposit(s: DemoState, raw: string): Result {
  const a = parseAmount(raw);
  if (typeof a === "string") return { ok: false, error: a };
  return { ok: true, message: `Deposited RON ${a.toFixed(2)}`, state: { ...s, cash: round(s.cash + a), transactions: [txn({ description: "Simulated deposit", amount: a, direction: "in" }), ...s.transactions] } };
}

export function withdraw(s: DemoState, raw: string): Result {
  const a = parseAmount(raw);
  if (typeof a === "string") return { ok: false, error: a };
  if (a > s.cash) return { ok: false, error: `Exceeds available cash of RON ${s.cash.toFixed(2)}.` };
  return { ok: true, message: `Withdrew RON ${a.toFixed(2)}`, state: { ...s, cash: round(s.cash - a), transactions: [txn({ description: "Simulated withdrawal", amount: a, direction: "out" }), ...s.transactions] } };
}

export function getTier(s: DemoState): Tier {
  if (s.tierLevel !== undefined) return DEMO_CONFIG.tiers.find((t) => t.level === s.tierLevel) ?? DEMO_CONFIG.tiers[0];
  const lessons = s.completedLessons.length;
  let cur: Tier = DEMO_CONFIG.tiers[0];
  for (const t of DEMO_CONFIG.tiers) if (s.cash >= t.minBalance && lessons >= t.minLessons) cur = t;
  return cur;
}
export function getNextTier(s: DemoState): Tier | null {
  const t = getTier(s);
  return DEMO_CONFIG.tiers.find((x) => x.level === t.level + 1) ?? null;
}

export function investedCost(s: DemoState) {
  return round(Object.values(s.holdings).reduce((a, h) => a + h.cost, 0));
}
export function holdingsValue(s: DemoState) {
  return round(Object.entries(s.holdings).reduce((a, [sym, h]) => a + h.qty * (STOCKS.find((x) => x.symbol === sym)?.price ?? 0), 0));
}

// `priceOverride` (RON) lets the server settle a trade at a live Alpaca price. For the static demo catalogue it defaults to the listed price when omitted. A symbol outside the catalogue is tradable only when a valid live price is supplied, so this stays a pure, deterministic rule.
export function trade(s: DemoState, symbol: string, side: "buy" | "sell", rawQty: string, priceOverride?: number): Result {
  const stock = STOCKS.find((x) => x.symbol === symbol);
  const override = typeof priceOverride === "number" && Number.isFinite(priceOverride) && priceOverride > 0 ? round(priceOverride) : undefined;
  if (!stock && override === undefined) return { ok: false, error: "Unknown stock." };
  if (!/^\d+$/.test(rawQty.trim()) || Number(rawQty) <= 0) return { ok: false, error: "Enter a whole number of shares, at least 1." };
  const qty = Number(rawQty);
  if (!Number.isSafeInteger(qty) || qty > 1000000) return { ok: false, error: "Invalid share quantity." };
  const price = override ?? stock!.price;
  const tier = getTier(s);
  if (tier.level < 2) return { ok: false, error: "You need a higher tier to invest. Investments unlock at tier 2." };
  const total = round(qty * price);
  const h = s.holdings[symbol] ?? { qty: 0, cost: 0 };
  if (side === "buy") {
    if (total > s.cash) return { ok: false, error: `Total RON ${total.toFixed(2)} exceeds cash of RON ${s.cash.toFixed(2)}.` };
    const room = round(tier.investAllowance - investedCost(s));
    if (total > room) return { ok: false, error: `Exceeds your ${tier.name} allowance. Remaining: RON ${Math.max(0, room).toFixed(2)}.` };
    return { ok: true, message: `Bought ${qty} ${symbol}`, state: { ...s, cash: round(s.cash - total), holdings: { ...s.holdings, [symbol]: { qty: h.qty + qty, cost: round(h.cost + total) } }, transactions: [txn({ description: `Buy ${qty} ${symbol} @ RON ${price.toFixed(2)}`, amount: total, direction: "out" }), ...s.transactions] } };
  }
  if (qty > h.qty) return { ok: false, error: `You own ${h.qty} ${symbol}.` };
  const holdings = { ...s.holdings };
  const left = h.qty - qty;
  if (left === 0) delete holdings[symbol];
  else holdings[symbol] = { qty: left, cost: round((h.cost * left) / h.qty) };
  return { ok: true, message: `Sold ${qty} ${symbol}`, state: { ...s, cash: round(s.cash + total), holdings, transactions: [txn({ description: `Sell ${qty} ${symbol} @ RON ${price.toFixed(2)}`, amount: total, direction: "in" }), ...s.transactions] } };
}

export function rewardLockReason(s: DemoState, rewardId: string): string | null {
  const r = DEMO_CONFIG.rewards.find((x) => x.id === rewardId);
  if (!r) return "Unknown reward.";
  const tier = getTier(s);
  if (tier.level < r.minTierLevel) {
    const need = DEMO_CONFIG.tiers.find((t) => t.level === r.minTierLevel)!;
    return `Requires the ${need.name} tier (level ${need.level}).`;
  }
  return null;
}

export function redeem(s: DemoState, rewardId: string, code: string): Result {
  if (s.redeemed[rewardId]) return { ok: true, message: "Already redeemed", state: s };
  const lock = rewardLockReason(s, rewardId);
  if (lock) return { ok: false, error: lock };
  return { ok: true, message: "Reward redeemed", state: { ...s, redeemed: { ...s.redeemed, [rewardId]: code } } };
}

export function lessonStatus(s: DemoState, lessonId: string): "locked" | "available" | "completed" {
  if (s.completedLessons.includes(lessonId)) return "completed";
  const l = LESSONS.find((x) => x.id === lessonId);
  return l && getTier(s).level >= l.requiresLevel ? "available" : "locked";
}

export function completeLesson(s: DemoState, lessonId: string): Result {
  const st = lessonStatus(s, lessonId);
  if (st === "locked") return { ok: false, error: "This lesson is locked." };
  if (st === "completed") return { ok: true, message: "Already completed", state: s };
  return { ok: true, message: "Lesson completed", state: { ...s, completedLessons: [...s.completedLessons, lessonId] } };
}

export interface Milestone { id: string; label: string; current: number; target: number; unit: string; passed: boolean }
export function milestones(s: DemoState): Milestone[] {
  const deposits = s.transactions.filter((t) => t.direction === "in" && /deposit/i.test(t.description)).length;
  const trades = s.transactions.filter((t) => /^(Buy|Sell) /.test(t.description)).length;
  const L = s.completedLessons.length;
  const m = (id: string, label: string, current: number, target: number, unit: string): Milestone => ({ id, label, current, target, unit, passed: current >= target });
  return [
    m("m-dep", "Make 3 deposits", deposits, 3, "deposits"),
    m("m-500", "Hold RON 1,000 in savings", s.cash, 1000, "RON"),
    m("m-l2", "Complete 2 lessons", L, 2, "lessons"),
    m("m-1500", "Hold RON 5,000 in savings", s.cash, 5000, "RON"),
    m("m-l4", "Complete 4 lessons", L, 4, "lessons"),
    m("m-trade", "Place a first simulated trade", trades, 1, "trades"),
  ];
}

export function nextTierRequirements(s: DemoState) {
  const next = getNextTier(s);
  if (!next) return null;
  return {
    tier: next,
    items: [
      { label: `Savings balance of RON ${next.minBalance.toLocaleString()}`, current: s.cash, target: next.minBalance, unit: "RON", met: s.cash >= next.minBalance },
      { label: `${next.minLessons} lessons completed`, current: s.completedLessons.length, target: next.minLessons, unit: "lessons", met: s.completedLessons.length >= next.minLessons },
    ],
  };
}
