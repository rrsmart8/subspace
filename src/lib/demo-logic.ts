import { MASTERY_SCENARIOS } from "../data/mastery.ts";
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
const txn = (t: Omit<Transaction, "id" | "date" | "status">, now: Date): Transaction => ({
  ...t, id: `t${Date.now()}${Math.floor(Math.random() * 1000)}`, date: now.toISOString(), status: "completed",
});

export function deposit(s: DemoState, raw: string, now: Date = new Date()): Result {
  const a = parseAmount(raw);
  if (typeof a === "string") return { ok: false, error: a };
  return { ok: true, message: `Deposited RON ${a.toFixed(2)}`, state: { ...s, cash: round(s.cash + a), transactions: [txn({ description: "Deposit", kind: "deposit", amount: a, direction: "in" }, now), ...s.transactions] } };
}

export function withdraw(s: DemoState, raw: string, now: Date = new Date()): Result {
  const a = parseAmount(raw);
  if (typeof a === "string") return { ok: false, error: a };
  if (a > s.cash) return { ok: false, error: `Exceeds available cash of RON ${s.cash.toFixed(2)}.` };
  return { ok: true, message: `Withdrew RON ${a.toFixed(2)}`, state: { ...s, cash: round(s.cash - a), transactions: [txn({ description: "Withdrawal", kind: "withdrawal", amount: a, direction: "out" }, now), ...s.transactions] } };
}

export function getTier(s: DemoState): Tier {
  if (s.tierLevel !== undefined) return DEMO_CONFIG.tiers.find((t) => t.level === s.tierLevel) ?? DEMO_CONFIG.tiers[0];
  const lessons = s.completedLessons.length;
  let cur: Tier = DEMO_CONFIG.tiers[0];
  for (const t of DEMO_CONFIG.tiers.slice(0, 2)) if (s.cash >= t.minBalance && lessons >= t.minLessons) cur = t;
  const progress = savingsProgress(s);
  return cur.level >= 2 && (!progress.qualified || s.cash < progress.requiredBalance) ? DEMO_CONFIG.tiers[0] : cur;
}
export function getNextTier(s: DemoState): Tier | null {
  const t = getTier(s);
  return DEMO_CONFIG.tiers.find((x) => x.level === t.level + 1) ?? null;
}

export function investedCost(s: DemoState) {
  return round(Object.values(s.holdings).reduce((a, h) => a + h.cost, 0));
}
// Cost basis keeps a purchase from reducing its own allocation denominator.
// Round down to bani so the budget never exceeds the configured percentage.
export function investmentBudget(s: DemoState) {
  const percent = getTier(s).investPercent;
  const used = investedCost(s);
  const capital = round(s.cash + used);
  const capitalBani = Math.round(capital * 100);
  const limit = Math.floor(capitalBani * percent / 100) / 100;
  return { percent, capital, limit, used, remaining: Math.max(0, round(limit - used)) };
}

export function holdingsValue(s: DemoState) {
  return round(Object.entries(s.holdings).reduce((a, [sym, h]) => a + h.qty * (STOCKS.find((x) => x.symbol === sym)?.price ?? 0), 0));
}

// `priceOverride` (RON) lets the server settle a trade at a live Alpaca price. For the static demo catalogue it defaults to the listed price when omitted. A symbol outside the catalogue is tradable only when a valid live price is supplied, so this stays a pure, deterministic rule.
export function trade(s: DemoState, symbol: string, side: "buy" | "sell", rawQty: string, priceOverride?: number, now: Date = new Date()): Result {
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
    const room = investmentBudget(s).remaining;
    if (total > room) return { ok: false, error: `Exceeds your ${tier.name} allowance. Remaining: RON ${Math.max(0, room).toFixed(2)}.` };
    return { ok: true, message: `Bought ${qty} ${symbol}`, state: { ...s, cash: round(s.cash - total), holdings: { ...s.holdings, [symbol]: { qty: h.qty + qty, cost: round(h.cost + total) } }, transactions: [txn({ description: `Buy ${qty} ${symbol} @ RON ${price.toFixed(2)}`, amount: total, direction: "out" }, now), ...s.transactions] } };
  }
  if (qty > h.qty) return { ok: false, error: `You own ${h.qty} ${symbol}.` };
  const holdings = { ...s.holdings };
  const left = h.qty - qty;
  if (left === 0) delete holdings[symbol];
  else holdings[symbol] = { qty: left, cost: round((h.cost * left) / h.qty) };
  return { ok: true, message: `Sold ${qty} ${symbol}`, state: { ...s, cash: round(s.cash + total), holdings, transactions: [txn({ description: `Sell ${qty} ${symbol} @ RON ${price.toFixed(2)}`, amount: total, direction: "in" }, now), ...s.transactions] } };
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

export interface Milestone { id: string; label: string; current: number | null; target: number; unit: string; passed: boolean }
export function milestones(s: DemoState, now: Date = new Date()): Milestone[] {
  const tier = getTier(s);
  const savings = savingsProgress(s, now);
  const policy = DEMO_CONFIG.savingsQualification;
  const evaluation = DEMO_CONFIG.investmentEvaluation;
  const m = (id: string, label: string, current: number | null, target: number, unit: string): Milestone => ({ id, label, current, target, unit, passed: current !== null && current >= target && target > 0 });
  const reserve = m("m-reserve", `Keep ${policy.consecutiveMonths} monthly contributions in savings`, s.cash, savings.requiredBalance, "RON");
  const lessons = (target: number) => m("m-lessons", `Complete ${target} lessons`, new Set(s.completedLessons.filter(id => LESSONS.some(l => l.id === id))).size, target, "lessons");
  if (tier.level === 1) return [
    m("m-income-streak", `Save ${policy.incomePercent}% of income for ${policy.consecutiveMonths} consecutive months`, savings.streak, policy.consecutiveMonths, "months"),
    reserve,
    lessons(DEMO_CONFIG.tiers[1].minLessons),
  ];
  if (tier.level === 2) return [
    reserve,
    lessons(DEMO_CONFIG.tiers[2].minLessons),
    m("m-trade", "Place a first trade", s.transactions.filter(t => t.status === "completed" && /^(Buy|Sell) /.test(t.description)).length, 1, "trades"),
    // Do not invent elapsed time or return data before a backend assessment exists.
    m("m-evaluation-window", `Complete the ${evaluation.windowDays}-day investment assessment`, null, evaluation.windowDays, "days"),
    m("m-profit", `Reach +${evaluation.profitTargetPercent}% net investment profit`, null, evaluation.profitTargetPercent, "%"),
  ];
  // Tier 3 is the highest implemented tier: these are ongoing goals, not Tier 4 gates.
  return [
    m("m-monthly-saving", `Save ${policy.incomePercent}% of income this month`, savings.currentSaved, savings.monthlyTarget, "RON"),
    reserve,
    m("m-mastery", "Complete your quarterly mastery challenge", masteryProgress(s, now).completed, masteryProgress(s, now).target, masteryProgress(s, now).foundation ? "lessons" : "scenarios"),
  ];
}

export function nextTierRequirements(s: DemoState, now: Date = new Date()) {
  const next = getNextTier(s);
  if (!next) return null;
  return { tier: next, items: milestones(s, now).map(m => ({ ...m, met: m.passed })) };
}

function calendarMonth(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: DEMO_CONFIG.savingsQualification.timeZone, year: "numeric", month: "numeric" }).formatToParts(date);
  return Number(parts.find(p => p.type === "year")?.value) * 12 + Number(parts.find(p => p.type === "month")?.value) - 1;
}
export function savingsProgress(s: DemoState, now: Date = new Date()) {
  const policy = DEMO_CONFIG.savingsQualification;
  const income = s.profile.monthlyIncome ?? 0;
  const monthlyTarget = Math.ceil(Math.round(income * 100) * policy.incomePercent / 100) / 100;
  const requiredBalance = round(monthlyTarget * policy.consecutiveMonths);
  const currentMonth = calendarMonth(now);
  const start = s.savingsStartedAt ? new Date(s.savingsStartedAt) : null;
  const totals = new Map<number, number>();
  if (start && Number.isFinite(start.getTime())) for (const t of s.transactions) {
    const date = new Date(t.date);
    if (t.status !== "completed" || !Number.isFinite(date.getTime()) || date < start || date > now) continue;
    const deposit = t.kind === "deposit" || (!t.kind && /deposit/i.test(t.description) && !/opening/i.test(t.description));
    const withdrawal = t.kind === "withdrawal" || (!t.kind && /withdraw/i.test(t.description));
    if (!deposit && !withdrawal) continue;
    const month = calendarMonth(date);
    totals.set(month, (totals.get(month) ?? 0) + Math.round(t.amount * 100) * (deposit ? 1 : -1));
  }
  const targetBani = Math.round(monthlyTarget * 100);
  const currentSaved = Math.max(0, (totals.get(currentMonth) ?? 0) / 100);
  const currentMet = targetBani > 0 && (totals.get(currentMonth) ?? 0) >= targetBani;
  let streak = 0;
  if (start && income > 0) {
    let month = currentMet ? currentMonth : currentMonth - 1;
    const firstMonth = calendarMonth(start);
    while (month >= firstMonth && (totals.get(month) ?? 0) >= targetBani) { streak++; month--; }
  }
  const qualified = streak >= policy.consecutiveMonths;
  return { qualifyingMonths: [...totals.entries()].filter(([, bani]) => targetBani > 0 && bani >= targetBani).map(([month]) => month), monthlyTarget, requiredBalance, currentSaved, currentMet, streak: Math.min(streak, policy.consecutiveMonths), qualified, remaining: Math.max(0, round(monthlyTarget - currentSaved)) };
}

export function promoteSavingsTier(s: DemoState, now: Date = new Date()): DemoState {
  if (s.tierLevel !== 1) return s;
  const progress = savingsProgress(s, now);
  const tier = DEMO_CONFIG.tiers[1];
  return progress.qualified && s.cash >= progress.requiredBalance && s.completedLessons.length >= tier.minLessons ? { ...s, tierLevel: 2 } : s;
}

// Resolve the first day of the next month at Bucharest midnight, including DST.
export function savingsCalendar(now: Date = new Date()) {
  const timeZone = DEMO_CONFIG.savingsQualification.timeZone;
  const month = calendarMonth(now) + 1;
  const midnight = Date.UTC(Math.floor(month / 12), month % 12, 1);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(midnight));
  const value = (name: string) => Number(parts.find(p => p.type === name)?.value);
  const wallTime = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  const deadline = new Date(midnight - (wallTime - midnight));
  const format = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", year: "numeric" });
  const dateParts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (name: string) => dateParts.find(p => p.type === name)?.value;
  return { today: `${part("year")}-${part("month")}-${part("day")}`, todayLabel: format.format(now), nextDeadline: deadline.toISOString(), nextDeadlineLabel: format.format(deadline) };
}

export function masteryProgress(s: DemoState, now: Date = new Date()) {
  const quarterIndex = Math.floor(calendarMonth(now) / 3);
  const year = Math.floor(quarterIndex / 4);
  const quarter = quarterIndex % 4 + 1;
  const id = `${year}-Q${quarter}`;
  const firstQuarter = s.mastery ? Math.floor(calendarMonth(new Date(s.mastery.enrolledAt)) / 3) : quarterIndex;
  const foundation = quarterIndex === firstQuarter;
  const scenarioSet = MASTERY_SCENARIOS.slice((quarterIndex % 2) * 3, (quarterIndex % 2) * 3 + DEMO_CONFIG.quarterlyMastery.scenarioCount);
  const answered = new Set(s.mastery?.answers[id] ?? []);
  const completed = foundation ? new Set(s.completedLessons.filter(lessonId => LESSONS.some(l => l.id === lessonId))).size : scenarioSet.filter(q => answered.has(q.id)).length;
  const target = foundation ? LESSONS.length : scenarioSet.length;
  const savings = savingsProgress(s, now);
  const qualifyingMonths = savings.qualifyingMonths.filter(month => Math.floor(month / 3) === quarterIndex).length;
  const reserveMet = savings.requiredBalance > 0 && s.cash >= savings.requiredBalance;
  const challengeMet = completed >= target;
  const eligible = getTier(s).level === 3 && qualifyingMonths === 3 && reserveMet && challengeMet;
  const claim = s.mastery?.rewardClaims[id] ?? null;
  const deadline = new Date(Date.UTC(year, quarter * 3, 0, 12));
  return { id, foundation, scenarios: scenarioSet, completed, target, challengeMet, qualifyingMonths, reserveMet, eligible, claim, bonusIncomePercent: DEMO_CONFIG.quarterlyMastery.bonusIncomePercent, bonusRON: claim?.amountRON ?? round((s.profile.monthlyIncome ?? 0) * DEMO_CONFIG.quarterlyMastery.bonusIncomePercent / 100), deadlineLabel: new Intl.DateTimeFormat("en-GB", { timeZone: DEMO_CONFIG.savingsQualification.timeZone, day: "numeric", month: "short", year: "numeric" }).format(deadline) };
}

export function answerMastery(s: DemoState, quarterId: string, scenarioId: string, answer: number, now: Date = new Date()): Result {
  if (getTier(s).level !== 3 || !s.mastery) return { ok: false, error: "Quarterly mastery is available at Tier 3." };
  const progress = masteryProgress(s, now);
  if (progress.id !== quarterId || progress.foundation) return { ok: false, error: "This challenge is not active. Complete the foundation lessons for your first quarter." };
  const scenario = progress.scenarios.find(q => q.id === scenarioId);
  if (!scenario || scenario.correct !== answer) return { ok: false, error: "Not quite. Review the scenario and try again." };
  const answers = [...new Set([...(s.mastery.answers[quarterId] ?? []), scenarioId])];
  return { ok: true, message: "Scenario completed", state: { ...s, mastery: { ...s.mastery, answers: { ...s.mastery.answers, [quarterId]: answers } } } };
}

export function registerMasteryReward(s: DemoState, quarterId: string, now: Date = new Date()): Result {
  if (getTier(s).level !== 3 || !s.mastery) return { ok: false, error: "Quarterly mastery is available at Tier 3." };
  const progress = masteryProgress(s, now);
  if (progress.id !== quarterId) return { ok: false, error: "This reward period has ended." };
  if (progress.claim) return { ok: true, message: "Reward already registered; funding is pending.", state: s };
  if (!progress.eligible) return { ok: false, error: "Complete the challenge, meet all three monthly saving targets and retain your savings reserve." };
  // Record eligibility only. No funds exist and nothing is added to cash or return calculations.
  const claim = { amountRON: progress.bonusRON, incomeRON: s.profile.monthlyIncome ?? 0, bonusIncomePercent: progress.bonusIncomePercent, status: "pending-funding" as const, claimedAt: now.toISOString() };
  return { ok: true, message: "Reward registered. Sponsor funding is pending; no cash has been credited.", state: { ...s, mastery: { ...s.mastery, rewardClaims: { ...s.mastery.rewardClaims, [quarterId]: claim } } } };
}
