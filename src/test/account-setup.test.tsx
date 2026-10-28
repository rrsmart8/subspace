import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountSetup } from "@/components/demo/AccountSetup";
afterEach(cleanup);
describe("income onboarding", () => {
  it("shows the 10% target and submits account details", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<AccountSetup accounts={[]} onCreate={onCreate} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ana Test" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "ana@test.ro" } });
    fireEvent.change(screen.getByLabelText("Monthly take-home income (RON)"), { target: { value: "5000" } });
    expect(screen.getByText(/500,00/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ name: "Ana Test", email: "ana@test.ro", monthlyIncome: "5000" }));
  });
  it("keeps backend errors visible without leaving the form", async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error("An account with this email already exists."));
    render(<AccountSetup accounts={[]} onCreate={onCreate} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ana Test" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "ana@test.ro" } });
    fireEvent.change(screen.getByLabelText("Monthly take-home income (RON)"), { target: { value: "5000" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already exists");
  });
});
