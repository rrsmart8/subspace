import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { initialState, type DemoState } from "@/data/mock";
import type { Result } from "@/lib/demo-logic";
import { DemoTimeline } from "@/components/demo/DemoTimeline";
import { ClockContext } from "@/state/ClockContext";
import * as api from "@/services/mockApi";
const store = vi.hoisted(() => ({ state: null as DemoState | null }));
vi.mock("@/state/DemoStore", () => ({ useDemo: () => ({ state: store.state, run: (fn: (s: DemoState) => Promise<Result>) => fn(store.state!) }) }));
vi.mock("@/services/mockApi", () => ({ advanceMonth: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("does not render the control when the server disables demo mode", () => {
  store.state = { ...initialState(), demoTimelineEnabled: false };
  const { container } = render(<DemoTimeline />);
  expect(container).toBeEmptyDOMElement();
});
it("shows a subtle labelled control and advances the selected account through the API", async () => {
  store.state = { ...initialState(), accountId: "demo-1", demoTimelineEnabled: true };
  vi.mocked(api.advanceMonth).mockResolvedValue({ ok: true, state: store.state, message: "Demo timeline advanced" });
  render(<ClockContext.Provider value="2026-11-28T10:00:00Z"><DemoTimeline /></ClockContext.Provider>);
  expect(screen.getByLabelText("Demo timeline")).toBeInTheDocument();
  expect(screen.getByText("28 Nov 2026")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Advance 1 month" }));
  await waitFor(() => expect(api.advanceMonth).toHaveBeenCalledExactlyOnceWith(store.state));
});
