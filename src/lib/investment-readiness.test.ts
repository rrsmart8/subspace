import { describe, expect, it } from "vitest";
import { initialState, type DemoState, type Transaction } from "../data/mock";
import { investmentReadiness, promoteInvestmentTier } from "./demo-logic";
import { startPerformance } from "./performance";
const opening = new Date("2026-01-15T12:00:00Z");
const review = new Date("2026-05-01T09:00:00Z");
const contribution = (month: string): Transaction => ({ id: month, date: `2026-${month}-10T12:00:00Z`, kind: "deposit", amount: 500, direction: "in", description: "Deposit", status: "completed" });
function enrolled(): DemoState {
  const s: DemoState = { ...initialState(), tierLevel: 2, cash: 5000, profile: { ...initialState().profile, monthlyIncome: 5000 }, completedLessons: ["l-budget", "l-emergency", "l-compound", "l-diversify"], holdings: { F: { qty: 10, cost: 100 }, ABC: { qty: 10, cost: 100 } }, transactions: [] };
  s.performance = startPerformance(s, ["F", "ABC"].map(symbol => ({ symbol, price: 10, live: false, source: "static", currency: "RON", rate: 1, asOf: null })), "test", opening, opening, true, 4.57);
  return promoteInvestmentTier(s, opening);
}
describe("Tier 3 readiness", () => {
  it("requires all conditions; loses no qualification merely because market returns are negative", () => {
    const s = enrolled(); s.transactions = ["02", "03", "04"].map(contribution);
    s.performance!.latest.netGain = -200;
    expect(investmentReadiness(s, review).eligible).toBe(true);
    expect(promoteInvestmentTier(s, review).tierLevel).toBe(3);
    expect(promoteInvestmentTier({ ...s, cash: 1499 }, review).tierLevel).toBe(2);
    expect(promoteInvestmentTier({ ...s, completedLessons: ["l-budget", "l-emergency", "l-compound", "unknown"] }, review).tierLevel).toBe(2);
    expect(promoteInvestmentTier(s, new Date("2026-04-01T09:00:00Z")).tierLevel).toBe(2);
  });
  it("excludes partial/current months, ignores old saving history and requires consecutive months", () => {
    const s = enrolled(); s.transactions = ["01", "02", "04", "05"].map(contribution);
    expect(investmentReadiness(s, review).savingMonths).toBe(1);
    s.transactions = ["01", "02", "03"].map(contribution);
    expect(investmentReadiness(s, new Date("2026-04-01T09:00:00Z")).savingMonths).toBe(2);
    s.transactions = ["02", "03", "04"].map(contribution);
    s.transactions.push({ ...contribution("03"), id: "withdraw", kind: "withdrawal", direction: "out", amount: 1 });
    expect(investmentReadiness(s, review).savingMonths).toBe(1);
  });
  it("freezes income targets and never backdates legacy assessment evidence", () => {
    const s = enrolled();
    expect(investmentReadiness({ ...s, profile: { ...s.profile, monthlyIncome: 1 } }, review).monthlyTarget).toBe(500);
    delete s.performance!.assessment;
    const migrated = promoteInvestmentTier(s, review);
    expect(migrated.performance!.assessment!.enrolledAt).toBe(review.toISOString());
    expect(investmentReadiness(migrated, review).days).toBe(0);
  });
  it("restarts discipline after concentration or allowance breaches without resetting other evidence", () => {
    const s = enrolled();
    const broken = promoteInvestmentTier({ ...s, holdings: { F: { qty: 20, cost: 200 } } }, new Date("2026-03-01T12:00:00Z"));
    expect(broken.performance!.assessment!.compliantSince).toBeNull();
    expect(broken.completedLessons).toEqual(s.completedLessons);
    const fixed = promoteInvestmentTier({ ...broken, holdings: s.holdings }, new Date("2026-03-02T12:00:00Z"));
    expect(investmentReadiness(fixed, review).days).toBe(59);
    expect(investmentReadiness({ ...s, cash: 100 }, review).planMet).toBe(false);
  });
});
