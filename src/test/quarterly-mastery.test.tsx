import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { initialState, type DemoState } from "@/data/mock";
import { QuarterlyMastery } from "@/components/demo/QuarterlyMastery";
const store = vi.hoisted(() => ({ state: null as DemoState | null, now: "2026-03-20T12:00:00Z" }));
vi.mock("@/state/DemoStore", () => ({ useDemo: () => ({ state: store.state, run: vi.fn() }) }));
vi.mock("@/hooks/use-current-date", () => ({ useCurrentDate: () => new Date(store.now) }));
afterEach(cleanup);
const account = (): DemoState => ({ ...initialState(), tierLevel: 3, profile: { ...initialState().profile, monthlyIncome: 5000 }, mastery: { enrolledAt: "2026-01-01T00:00:00Z", answers: {}, rewardClaims: {} } });
it("shows first-quarter lessons and an unfunded reward without an active payout button", () => {
  store.now = "2026-03-20T12:00:00Z";
  store.state = account();
  render(<QuarterlyMastery />);
  expect(screen.getByText("Quarterly mastery challenge")).toBeInTheDocument();
  expect(screen.getByText("Pending sponsor funding")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View lessons" })).toHaveAttribute("href", "#lessons");
  expect(screen.getByRole("button", { name: "Register reward eligibility" })).toBeDisabled();
});
it("opens new scenarios in the next quarter even when lessons were already completed", () => {
  store.now = "2026-04-20T12:00:00Z";
  store.state = { ...account(), completedLessons: ["l-budget", "l-emergency", "l-compound", "l-diversify", "l-risk"] };
  render(<QuarterlyMastery />);
  expect(screen.getByText("0 of 3 scenarios")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Check answer" })).toHaveLength(3);
});
it("does not add this challenge for lower tiers", () => {
  store.state = { ...account(), tierLevel: 2 };
  const { container } = render(<QuarterlyMastery />);
  expect(container).toBeEmptyDOMElement();
});
