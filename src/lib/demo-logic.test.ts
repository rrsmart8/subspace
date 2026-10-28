import { describe, expect, it } from "vitest";
import { initialState } from "@/data/mock";
import * as L from "./demo-logic";

describe("demo rules", () => {
  it("rejects empty, non-numeric, zero and negative amounts", () => {
    const s = initialState();
    for (const v of ["", "abc", "0", "-5"]) expect(L.deposit(s, v).ok).toBe(false);
  });
  it("rejects withdrawals above cash", () => {
    const s = initialState();
    expect(L.withdraw(s, "620.01").ok).toBe(false);
    const r = L.withdraw(s, "20");
    expect(r.ok && r.state.cash).toBe(600);
  });
  it("balance and lessons alone cannot bypass the saving streak", () => {
    const s = initialState();
    expect(L.getTier(s).name).toBe("Starter");
    expect(L.trade(s, "F", "buy", "1").ok).toBe(false);
    const s2 = { ...s, cash: 1000, completedLessons: ["l-budget", "l-emergency"] };
    expect(L.getTier(s2).name).toBe("Starter");
  });
  it("enforces whole shares, allowance and shares owned", () => {
    const s = { ...initialState(), tierLevel: 2, cash: 1000, completedLessons: ["l-budget", "l-emergency"] };
    expect(L.trade(s, "F", "buy", "1.5").ok).toBe(false);
    expect(L.trade(s, "AAPL", "buy", "2").ok).toBe(false); // 378.84 > 100 RON allowance
    expect(L.trade(s, "F", "sell", "1").ok).toBe(false);
    const r = L.trade(s, "F", "buy", "5");
    expect(r.ok && r.state.cash).toBe(939.1);
  });
  it("issues a coupon only once", () => {
    const s = initialState();
    const r1 = L.redeem(s, "r-coffee", "A");
    if (!r1.ok) throw new Error();
    const r2 = L.redeem(r1.state, "r-coffee", "B");
    expect(r2.ok && r2.state.redeemed["r-coffee"]).toBe("A");
    expect(L.redeem(s, "r-books", "X").ok).toBe(false);
  });
});

describe("percentage investment budgets", () => {
  it("applies 0%, 10% and 25% to the three seed balances", () => {
    for (const [tierLevel, cash, limit] of ([[1, 750, 0], [2, 3500, 350], [3, 8500, 2125]] as const)) {
      expect(L.investmentBudget({ ...initialState(), tierLevel, cash }).limit).toBe(limit);
    }
  });
  it("keeps the purchase basis stable and prevents repeat buys bypassing the cap", () => {
    const s = { ...initialState(), tierLevel: 2, cash: 3500 };
    const buy = L.trade(s, "F", "buy", "28");
    if (!buy.ok) throw new Error(buy.error);
    expect(L.investmentBudget(buy.state)).toMatchObject({ capital: 3500, limit: 350, used: 341.04, remaining: 8.96 });
    expect(L.trade(buy.state, "F", "buy", "1").ok).toBe(false);
    const sale = L.trade(buy.state, "F", "sell", "1");
    if (!sale.ok) throw new Error(sale.error);
    expect(L.investmentBudget(sale.state).remaining).toBe(21.14);
  });
  it("adjusts for deposits and withdrawals, without trapping existing positions", () => {
    const s = { ...initialState(), tierLevel: 2, cash: 3500 };
    const buy = L.trade(s, "F", "buy", "28");
    if (!buy.ok) throw new Error(buy.error);
    const deposit = L.deposit(buy.state, "100");
    if (!deposit.ok) throw new Error(deposit.error);
    expect(L.investmentBudget(deposit.state).limit).toBe(360);
    const withdrawal = L.withdraw(buy.state, "3000");
    if (!withdrawal.ok) throw new Error(withdrawal.error);
    expect(L.investmentBudget(withdrawal.state)).toMatchObject({ limit: 50, remaining: 0 });
    expect(L.trade(withdrawal.state, "F", "buy", "1").ok).toBe(false);
    expect(L.trade(withdrawal.state, "F", "sell", "1").ok).toBe(true);
  });
  it("floors fractional bani and permits an exact percentage boundary", () => {
    const s = { ...initialState(), tierLevel: 2, cash: 121.89 };
    expect(L.investmentBudget(s).limit).toBe(12.18);
    expect(L.trade(s, "F", "buy", "1").ok).toBe(true);
    expect(L.trade({ ...s, cash: 121.79 }, "F", "buy", "1").ok).toBe(false);
  });
});

describe("income-based Tier 2 qualification", () => {
  const enrolled = () => ({ ...initialState(), tierLevel: 1, profile: { ...initialState().profile, monthlyIncome: 5000 }, savingsStartedAt: "2026-01-01T00:00:00Z", cash: 1500, completedLessons: ["l-budget", "l-emergency"], transactions: [] as ReturnType<typeof initialState>["transactions"] });
  const deposit = (date: string, amount = 500) => ({ id: date, date, description: "Deposit", amount, direction: "in" as const, status: "completed" as const, kind: "deposit" as const });
  it("requires 3 calendar months, lessons and the income-derived retained balance", () => {
    const state = enrolled();
    state.transactions = [deposit("2026-01-10T12:00:00Z"), deposit("2026-02-10T12:00:00Z"), deposit("2026-03-10T12:00:00Z")];
    const now = new Date("2026-03-11T12:00:00Z");
    expect(L.savingsProgress(state, now)).toMatchObject({ streak: 3, qualified: true, monthlyTarget: 500, requiredBalance: 1500 });
    expect(L.promoteSavingsTier(state, now).tierLevel).toBe(2);
    expect(L.promoteSavingsTier({ ...state, cash: 1499.99 }, now).tierLevel).toBe(1);
    expect(L.promoteSavingsTier({ ...state, completedLessons: [] }, now).tierLevel).toBe(1);
  });
  it("a completed missed month breaks the streak; unfinished current months do not", () => {
    const state = enrolled();
    state.transactions = [deposit("2026-01-10T12:00:00Z"), deposit("2026-02-10T12:00:00Z")];
    expect(L.savingsProgress(state, new Date("2026-03-20T12:00:00Z")).streak).toBe(2);
    expect(L.savingsProgress(state, new Date("2026-04-01T12:00:00Z")).streak).toBe(0);
    state.transactions.push(deposit("2026-04-10T12:00:00Z"));
    expect(L.savingsProgress(state, new Date("2026-04-11T12:00:00Z")).streak).toBe(1);
  });
  it("aggregates split deposits, subtracts withdrawals and excludes pending or pre-enrollment money", () => {
    const state = enrolled();
    state.transactions = [deposit("2026-01-10T12:00:00Z", 250), deposit("2026-01-11T12:00:00Z", 250), { ...deposit("2026-01-12T12:00:00Z", 100), direction: "out", kind: "withdrawal" }, { ...deposit("2026-01-15T12:00:00Z", 999), status: "pending" }, deposit("2025-12-30T12:00:00Z", 999)];
    expect(L.savingsProgress(state, new Date("2026-01-20T12:00:00Z"))).toMatchObject({ currentSaved: 400, remaining: 100, streak: 0 });
  });
  it("uses Bucharest calendar boundaries, across the year", () => {
    const state = { ...enrolled(), savingsStartedAt: "2025-11-01T00:00:00Z" };
    state.transactions = [deposit("2025-11-15T12:00:00Z"), deposit("2025-12-15T12:00:00Z"), deposit("2025-12-31T22:30:00Z")];
    expect(L.savingsProgress(state, new Date("2026-01-01T01:00:00Z")).streak).toBe(3);
  });
  it("does not count opening balance, trade proceeds, future records or missing income", () => {
    const state = enrolled();
    state.transactions = [{ ...deposit("2026-01-10T12:00:00Z", 5000), kind: "trade" }, { id: "opening", date: "2026-01-12T12:00:00Z", amount: 5000, direction: "in", status: "completed", description: "Opening demo deposit" }, deposit("2026-02-10T12:00:00Z")];
    expect(L.savingsProgress(state, new Date("2026-01-20T12:00:00Z")).streak).toBe(0);
    expect(L.savingsProgress(initialState()).qualified).toBe(false);
  });
});

describe("monthly saving deadlines", () => {
  it("shows the current Bucharest date and the next month's exact midnight", () => {
    expect(L.savingsCalendar(new Date("2026-10-28T12:00:00Z"))).toMatchObject({ today: "2026-10-28", nextDeadline: "2026-10-31T22:00:00.000Z", nextDeadlineLabel: "1 Nov 2026" });
    expect(L.savingsCalendar(new Date("2026-03-15T12:00:00Z")).nextDeadline).toBe("2026-03-31T21:00:00.000Z");
    expect(L.savingsCalendar(new Date("2026-12-31T22:00:00Z"))).toMatchObject({ today: "2027-01-01", nextDeadlineLabel: "1 Feb 2027" });
  });
  it("resets an unmet month exactly at its deadline while preserving financial data", () => {
    const s = { ...initialState(), tierLevel: 1, profile: { ...initialState().profile, monthlyIncome: 5000 }, savingsStartedAt: "2026-09-01T00:00:00Z", transactions: [{ id: "september", date: "2026-09-10T12:00:00Z", description: "Deposit", kind: "deposit" as const, amount: 500, direction: "in" as const, status: "completed" as const }] };
    const original = structuredClone(s);
    expect(L.savingsProgress(s, new Date("2026-10-31T21:59:59Z")).streak).toBe(1);
    expect(L.savingsProgress(s, new Date("2026-10-31T22:00:00Z")).streak).toBe(0);
    expect(s).toEqual(original);
  });
});

describe("stage-specific milestones", () => {
  const account = (tierLevel: number, monthlyIncome = 4500) => ({ ...initialState(), tierLevel, cash: 450, profile: { ...initialState().profile, monthlyIncome } });
  it("shows only salary-based saving and beginner lessons for Tier 1", () => {
    const state = account(1);
    const items = L.milestones(state);
    expect(items.map(m => m.id)).toEqual(["m-income-streak", "m-reserve", "m-lessons"]);
    expect(items.find(m => m.id === "m-reserve")?.target).toBe(1350);
    expect(items.find(m => m.id === "m-lessons")?.target).toBe(2);
    expect(L.savingsProgress(account(1, 2000)).requiredBalance).toBe(600);
    expect(L.savingsProgress(account(1, 10000)).requiredBalance).toBe(3000);
  });
  it("shows at most five Tier 2 requirements without fabricating assessment progress", () => {
    const state = account(2);
    const items = L.milestones(state);
    expect(items).toHaveLength(5);
    expect(items.find(m => m.id === "m-lessons")?.target).toBe(4);
    expect(items.find(m => m.id === "m-evaluation-window")).toMatchObject({ current: null, target: 90, passed: false });
    expect(items.find(m => m.id === "m-investment-plan")).toMatchObject({ current: null, target: 1, passed: false });
    expect(L.nextTierRequirements(state)?.items.map(m => [m.id, m.target, m.met])).toEqual(items.map(m => [m.id, m.target, m.passed]));
  });
  it("shows ongoing Tier 3 goals without implying another promotion", () => {
    const state = account(3);
    expect(L.milestones(state).map(m => m.id)).toEqual(["m-monthly-saving", "m-reserve", "m-mastery"]);
    expect(L.milestones(state).find(m => m.id === "m-mastery")?.target).toBe(5);
    expect(L.nextTierRequirements(state)).toBeNull();
  });
});

describe("quarterly mastery and capped rewards", () => {
  const account = () => ({ ...initialState(), tierLevel: 3, profile: { ...initialState().profile, monthlyIncome: 5000 }, savingsStartedAt: "2026-01-01T00:00:00Z", cash: 1500, completedLessons: ["l-budget", "l-emergency", "l-compound", "l-diversify", "l-risk"], mastery: { enrolledAt: "2026-01-01T00:00:00Z", answers: {}, rewardClaims: {} }, transactions: [1, 2, 3].map(month => ({ id: `saving-${month}`, date: `2026-0${month}-10T12:00:00Z`, description: "Deposit", kind: "deposit" as const, amount: 500, direction: "in" as const, status: "completed" as const })) });
  it("uses all five lessons for the first quarter, then resets challenge progress without losing lessons", () => {
    const s = account();
    expect(L.masteryProgress(s, new Date("2026-03-20T12:00:00Z"))).toMatchObject({ id: "2026-Q1", foundation: true, completed: 5, target: 5, eligible: true });
    expect(L.masteryProgress(s, new Date("2026-04-02T12:00:00Z"))).toMatchObject({ id: "2026-Q2", foundation: false, completed: 0, target: 3, eligible: false });
    expect(s.completedLessons).toHaveLength(5);
  });
  it("checks scenario answers and quarter identity, and does not duplicate progress", () => {
    let s = account();
    const now = new Date("2026-04-20T12:00:00Z");
    const progress = L.masteryProgress(s, now);
    const question = progress.scenarios[0]!;
    expect(L.answerMastery(s, "2026-Q1", question.id, question.correct, now).ok).toBe(false);
    expect(L.answerMastery(s, progress.id, question.id, (question.correct + 1) % 3, now).ok).toBe(false);
    const answer = L.answerMastery(s, progress.id, question.id, question.correct, now);
    if (!answer.ok) throw new Error(answer.error);
    const repeat = L.answerMastery(answer.state, progress.id, question.id, question.correct, now);
    if (!repeat.ok) throw new Error(repeat.error);
    expect(L.masteryProgress(repeat.state, now).completed).toBe(1);
  });
  it("requires saving, reserve, learning and Tier 3; profit cannot substitute", () => {
    const s = account(); const now = new Date("2026-03-20T12:00:00Z");
    for (const candidate of [{ ...s, tierLevel: 2 }, { ...s, completedLessons: [] }, { ...s, cash: 1499.99 }, { ...s, transactions: s.transactions.slice(1) }]) {
      expect(L.registerMasteryReward(candidate, "2026-Q1", now).ok).toBe(false);
    }
  });
  it("registers one capped pending-funding reward without creating money or a trade", () => {
    const s = account(); const now = new Date("2026-03-20T12:00:00Z");
    const registered = L.registerMasteryReward(s, "2026-Q1", now);
    if (!registered.ok) throw new Error(registered.error);
    expect(registered.state.mastery?.rewardClaims["2026-Q1"]).toMatchObject({ amountRON: 500, incomeRON: 5000, bonusIncomePercent: 10, status: "pending-funding" });
    expect(registered.state.cash).toBe(s.cash);
    expect(registered.state.transactions).toEqual(s.transactions);
    const repeat = L.registerMasteryReward(registered.state, "2026-Q1", now);
    expect(repeat.ok && repeat.state.mastery?.rewardClaims).toEqual(registered.state.mastery?.rewardClaims);
    expect(L.registerMasteryReward(registered.state, "2026-Q1", new Date("2026-04-02T12:00:00Z")).ok).toBe(false);
  });
});

describe("income-based quarterly bonus", () => {
  it("calculates the reward from monthly income rather than wallet size or profit", () => {
    for (const [monthlyIncome, bonusRON] of ([[4500, 450], [5000, 500], [10000, 1000]] as const)) {
      const state = { ...initialState(), tierLevel: 3, cash: 20000, profile: { ...initialState().profile, monthlyIncome } };
      expect(L.masteryProgress(state).bonusRON).toBe(bonusRON);
    }
  });
  it("preserves the amount of a previously registered reward", () => {
    const state = { ...initialState(), tierLevel: 3, profile: { ...initialState().profile, monthlyIncome: 10000 }, mastery: { enrolledAt: "2026-01-01T00:00:00Z", answers: {}, rewardClaims: { "2026-Q1": { amountRON: 25, status: "pending-funding" as const, claimedAt: "2026-03-20T12:00:00Z" } } } };
    expect(L.masteryProgress(state, new Date("2026-03-20T12:00:00Z")).bonusRON).toBe(25);
  });
});
