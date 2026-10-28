import { describe, it, expect } from "vitest";
import { initialState, type DemoState, type Transaction } from "@/data/mock";
import { startPerformance, performanceValuation, valuePortfolio, elapsedDays, type PerformanceQuote } from "./performance";
const start = new Date("2026-10-01T12:00:00Z");
const now = new Date("2026-10-11T12:00:00Z");
const quote = (price: number, asOf = now.toISOString()): PerformanceQuote => ({ symbol: "F", price, live: true, source: "alpaca", currency: "RON", rate: 4.57, asOf });
const account = (): DemoState => ({ ...initialState(), tierLevel: 2, cash: 900, holdings: { F: { qty: 10, cost: 50 } }, transactions: [] });
const tracked = () => { const s = account(); return { ...s, performance: startPerformance(s, [quote(10, start.toISOString())], "run-1", start, start, false, 4.57) }; };
const flow = (kind: "deposit" | "withdrawal", amount: number): Transaction => ({ id: kind, date: "2026-10-06T12:00:00Z", description: kind, kind, amount, direction: kind === "deposit" ? "in" : "out", status: "completed" });
describe("90-day account performance", () => {
  it("marks existing holdings to opening prices and tracks positive and negative movements", () => {
    const s = tracked();
    expect(s.performance.openingValue).toBe(1000);
    expect(performanceValuation(s, [quote(12)], now, now)).toMatchObject({ accountValue: 1020, netGain: 20, returnPercent: 2 });
    expect(performanceValuation(s, [quote(8)], now, now)).toMatchObject({ netGain: -20, returnPercent: -2 });
  });
  it("excludes deposits and weights their exposure time for the return estimate", () => {
    const s = { ...tracked(), cash: 1400, transactions: [flow("deposit", 500)] };
    expect(performanceValuation(s, [quote(12)], now, now)).toMatchObject({ accountValue: 1520, netCashFlow: 500, netGain: 20, returnPercent: 1.6 });
  });
  it("excludes withdrawals without treating them as losses", () => {
    const s = { ...tracked(), cash: 700, transactions: [flow("withdrawal", 200)] };
    expect(performanceValuation(s, [quote(12)], now, now)).toMatchObject({ netCashFlow: -200, netGain: 20, returnPercent: 2.2222 });
  });
  it("includes realized gains and recorded fees without double subtracting them", () => {
    const sale: Transaction = { id: "sale", date: now.toISOString(), description: "Sell", amount: 120, direction: "in", status: "completed", kind: "trade", execution: { symbol: "F", side: "sell", qty: 10, priceRON: 12, feesRON: 2, source: "alpaca", quoteAsOf: now.toISOString(), rate: 4.57 } };
    expect(performanceValuation({ ...tracked(), cash: 1018, holdings: {}, transactions: [sale] }, [], now, now)).toMatchObject({ netGain: 18, feesRON: 2 });
  });
  it("rejects missing, stale, fallback, future and inconsistent FX prices", () => {
    const s = tracked();
    for (const quotes of [[], [{ ...quote(12), live: false, source: "static" }], [quote(12, "2026-10-01T12:00:00Z")], [quote(12, "2026-10-12T12:00:00Z")], [{ ...quote(12), rate: 5 }]]) {
      expect(() => performanceValuation(s, quotes, now, now)).toThrow();
    }
    expect(valuePortfolio(s, [{ ...quote(12), live: false, asOf: null }], "demo", now, 4.57).accountValue).toBe(1020);
  });
  it("values all symbols, including holdings outside the static catalogue", () => {
    expect(valuePortfolio({ ...account(), holdings: { XYZNEW: { qty: 2, cost: 10 } } }, [{ ...quote(15), symbol: "XYZNEW" }], "market", now, 4.57).accountValue).toBe(930);
  });
  it("never invents closing prices after the deadline or reclassifies unknown credits as profit", () => {
    const s = tracked();
    expect(elapsedDays(s.performance, new Date("2027-01-05T12:00:00Z"))).toBe(90);
    expect(() => performanceValuation(s, [quote(12)], new Date("2027-01-05T12:00:00Z"), now)).toThrow(/closing historical/);
    expect(() => performanceValuation({ ...s, transactions: [{ ...flow("deposit", 25), kind: undefined }] as unknown as Transaction[] }, [quote(12)], now, now)).toThrow(/unclassified/);
  });
});
