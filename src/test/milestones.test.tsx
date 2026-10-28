import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { initialState, type DemoState } from "@/data/mock";
import { MilestoneList, NextTier } from "@/components/demo/Milestones";
const store = vi.hoisted(() => ({ state: null as DemoState | null }));
vi.mock("@/state/DemoStore", () => ({ useDemo: () => ({ state: store.state }) }));
afterEach(cleanup);
it("does not show investing or advanced milestones in Tier 1", () => {
  store.state = { ...initialState(), tierLevel: 1, profile: { ...initialState().profile, monthlyIncome: 4500 } };
  render(<MilestoneList />);
  expect(screen.queryByText("Place a first trade")).not.toBeInTheDocument();
  expect(screen.queryByText("Complete 4 lessons")).not.toBeInTheDocument();
  expect(screen.getByText("Complete 2 lessons")).toBeInTheDocument();
});
it("renders pending assessments without misleading zero-progress bars", () => {
  store.state = { ...initialState(), tierLevel: 2, profile: { ...initialState().profile, monthlyIncome: 4500 } };
  render(<MilestoneList />);
  expect(screen.getAllByText("Pending")).toHaveLength(2);
  expect(screen.getAllByText("Assessment not started.")).toHaveLength(2);
  expect(screen.queryByText("0 of 90 days")).not.toBeInTheDocument();
});
it("keeps the next-tier panel aligned and identifies Tier 3 as the final current tier", () => {
  store.state = { ...initialState(), tierLevel: 3 };
  render(<NextTier />);
  expect(screen.getByText("Top tier reached")).toBeInTheDocument();
});
it("hides the deadline explanation on Overview while retaining dates", () => {
  store.state = { ...initialState(), tierLevel: 1, profile: { ...initialState().profile, monthlyIncome: 4500 } };
  render(<NextTier showDeadlineNote={false} />);
  expect(screen.getByText("Today")).toBeInTheDocument();
  expect(screen.getByText("Deposit before")).toBeInTheDocument();
  expect(screen.queryByText(/Bucharest time\. An unmet/)).not.toBeInTheDocument();
});
