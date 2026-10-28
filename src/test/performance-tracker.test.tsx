import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { initialState, type DemoState } from "@/data/mock";
import { PerformanceTracker } from "@/components/demo/PerformanceTracker";
import * as api from "@/services/mockApi";
import { startPerformance } from "@/lib/performance";
const store = vi.hoisted(() => ({ state: null as DemoState | null }));
vi.mock("@/state/DemoStore", () => ({ useDemo: () => ({ state: store.state, run: vi.fn() }) }));
vi.mock("@/services/mockApi", () => ({ getPerformance: vi.fn(), startPerformance: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("explains the tracking scope and prevents starting without an investment", async () => {
  store.state = { ...initialState(), accountId: "demo-2", tierLevel: 2 };
  vi.mocked(api.getPerformance).mockResolvedValue({ run: null, elapsedDays: 0, status: "not-started", dataIssue: null, snapshots: [], promotion: "pending" });
  render(<PerformanceTracker />);
  expect(await screen.findByRole("button", { name: "Start 90-day assessment" })).toBeDisabled();
  expect(screen.getByText(/Build a 90-day investing habit/)).toBeInTheDocument();
});
it("labels demo tracking and preserves visible saved values on a quote failure", async () => {
  const now = new Date("2026-10-28T12:00:00Z");
  store.state = { ...initialState(), accountId: "demo-2", tierLevel: 2, cash: 900, holdings: { F: { qty: 10, cost: 100 } } };
  const run = startPerformance(store.state, [{ symbol: "F", price: 10, source: "static", currency: "RON", live: false, rate: 1, asOf: null }], "test", now, now, true, 4.57);
  vi.mocked(api.getPerformance).mockResolvedValue({ run, elapsedDays: 0, status: "tracking", dataIssue: "Price refresh unavailable", snapshots: [run.latest], promotion: "pending" });
  render(<PerformanceTracker />);
  await waitFor(() => expect(screen.getByText("Demo timeline")).toBeInTheDocument());
  expect(screen.getByText("Price refresh unavailable")).toBeInTheDocument();
  expect(screen.getByText("0.00%")).toBeInTheDocument();
  expect(screen.getByText(/of 5 requirements met/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /promote/i })).not.toBeInTheDocument();
});
