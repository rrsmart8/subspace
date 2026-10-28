import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialState, type DemoState } from "@/data/mock";
import { Investment } from "@/routes/investment";
import * as api from "@/services/mockApi";

const store = vi.hoisted(() => ({ state: null as DemoState | null }));
vi.mock("@/state/DemoStore", () => ({ useDemo: () => ({ state: store.state, run: vi.fn() }) }));
// The Investment page fetches quotes and searches assets via the adapter; mock
// it so the test runs deterministically with static demo prices and no network.
vi.mock("@/services/mockApi", () => ({
  getQuotes: vi.fn().mockResolvedValue({ quotes: [], live: false, feed: "iex", rate: 1 }),
  searchAssets: vi
    .fn()
    .mockResolvedValue({ results: [{ symbol: "F", name: "Ford Motor Co." }], live: false }),
  browseAssets: vi.fn().mockResolvedValue({
    companies: [{ symbol: "F", name: "Ford Motor Co.", price: 12.18 }],
    bounds: { min: 12, max: 2000 },
    live: false,
  }),
  trade: vi.fn(),
}));
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());
describe("investment tier access", () => {
  it("shows the higher-tier message instead of the investment tools for tier 1", () => {
    store.state = { ...initialState(), tierLevel: 1, accountId: "demo-1", cash: 750 };
    render(<Investment />);
    expect(screen.getByText(/You need a higher tier to invest/)).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Search company or symbol" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Buy" })).not.toBeInTheDocument();
  });
  for (const tierLevel of [2, 3])
    it(`allows tier ${tierLevel} to search and open a buy order in RON`, async () => {
      store.state = { ...initialState(), tierLevel, cash: tierLevel === 2 ? 3500 : 8500 };
      render(<Investment />);
      const search = screen.getByRole("textbox", { name: "Search company or symbol" });
      // Empty query shows the static catalogue; Ford is selectable immediately.
      fireEvent.click(await screen.findByRole("button", { name: /Ford Motor/ }));
      fireEvent.click(screen.getByRole("button", { name: "Buy" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Confirm buy")).toBeEnabled();
      expect(screen.getAllByText(/RON/).length).toBeGreaterThan(0);
      // The debounced search also queries the adapter by company name.
      fireEvent.change(search, { target: { value: "Ford" } });
      await waitFor(() => expect(api.searchAssets).toHaveBeenCalledWith("Ford", expect.anything()));
    });
});
