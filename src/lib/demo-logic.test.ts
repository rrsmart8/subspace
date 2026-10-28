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
  it("starter tier cannot trade; builder needs 1000 RON and 2 lessons", () => {
    const s = initialState();
    expect(L.getTier(s).name).toBe("Starter");
    expect(L.trade(s, "F", "buy", "1").ok).toBe(false);
    const s2 = { ...s, cash: 1000, completedLessons: ["l-budget", "l-emergency"] };
    expect(L.getTier(s2).name).toBe("Builder");
  });
  it("enforces whole shares, allowance and shares owned", () => {
    const s = { ...initialState(), cash: 1000, completedLessons: ["l-budget", "l-emergency"] };
    expect(L.trade(s, "F", "buy", "1.5").ok).toBe(false);
    expect(L.trade(s, "AAPL", "buy", "2").ok).toBe(false); // 378.84 > 250 allowance
    expect(L.trade(s, "F", "sell", "1").ok).toBe(false);
    const r = L.trade(s, "F", "buy", "10");
    expect(r.ok && r.state.cash).toBe(878.2);
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
