import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SavingsDates } from "@/components/demo/SavingsDates";
afterEach(cleanup);
it("shows today's date and the next-month deadline with a clear reset condition", () => {
  render(<SavingsDates now={new Date("2026-10-28T12:00:00Z")} />);
  expect(screen.getByText("28 Oct 2026")).toHaveAttribute("dateTime", "2026-10-28");
  expect(screen.getByText("1 Nov 2026, 00:00")).toHaveAttribute("dateTime", "2026-10-31T22:00:00.000Z");
  expect(screen.getByText(/unmet monthly target resets your streak/)).toBeInTheDocument();
});
