import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initialState, type DemoState } from "@/data/mock";
import { Investment } from "@/routes/investment";

const store = vi.hoisted(() => ({ state: null as DemoState | null }));
vi.mock("@/state/DemoStore", () => ({ useDemo: () => ({ state: store.state, run: vi.fn() }) }));
afterEach(cleanup);
describe("investment tier access", () => {
  it("shows the higher-tier message instead of the investment tools for tier 1", () => {
    store.state = { ...initialState(), tierLevel: 1, accountId: "demo-1", cash: 750 };
    render(<Investment />);
    expect(screen.getByText(/You need a higher tier to invest/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Search company or symbol" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Buy" })).not.toBeInTheDocument();
  });
  for (const tierLevel of [2, 3]) it(`allows tier ${tierLevel} to search and open a buy order in RON`, () => {
    store.state = { ...initialState(), tierLevel, cash: tierLevel === 2 ? 3500 : 8500 };
    render(<Investment />);
    const search = screen.getByRole("textbox", { name: "Search company or symbol" });
    fireEvent.change(search, { target: { value: "Ford" } });
    fireEvent.click(screen.getByRole("button", { name: /Ford Motor/ }));
    fireEvent.click(screen.getByRole("button", { name: "Buy" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Confirm buy")).toBeEnabled();
    expect(screen.getAllByText(/RON/).length).toBeGreaterThan(0);
  });
});
