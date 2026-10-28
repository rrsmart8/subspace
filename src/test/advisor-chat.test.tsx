import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialState, type DemoState } from "@/data/mock";
import { AdvisorChat } from "@/components/demo/AdvisorChat";
import * as api from "@/services/mockApi";

const store = vi.hoisted(() => ({ state: null as DemoState | null }));
vi.mock("@/state/DemoStore", () => ({ useDemo: () => ({ state: store.state, run: vi.fn() }) }));
vi.mock("@/services/mockApi", () => ({ sendChat: vi.fn() }));

const tier = (tierLevel: number, accountId = "demo-3") => ({
  ...initialState(),
  tierLevel,
  accountId,
  cash: 8500,
});
const memory = new Map<string, string>();
const localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
};

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("localStorage", localStorage);
  localStorage.clear();
});

describe("investment assistant", () => {
  for (const level of [1, 2])
    it(`is hidden for tier ${level}`, () => {
      store.state = tier(level, `demo-${level}`);
      render(<AdvisorChat />);
      expect(
        screen.queryByRole("heading", { name: "Investment assistant" }),
      ).not.toBeInTheDocument();
    });

  it("sends the browser-held history and stores the reply per account", async () => {
    store.state = tier(3);
    vi.mocked(api.sendChat).mockResolvedValue({
      reply: "AAPL is 1,000 RON.",
      toolsUsed: ["get_stock_snapshot"],
    });
    render(<AdvisorChat />);
    fireEvent.change(screen.getByLabelText("Message the investment assistant"), {
      target: { value: "AAPL price?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("AAPL is 1,000 RON.")).toBeInTheDocument();
    expect(screen.getByText(/Used: live prices/)).toBeInTheDocument();
    expect(api.sendChat).toHaveBeenCalledWith("demo-3", [{ role: "user", content: "AAPL price?" }]);
    const saved = JSON.parse(localStorage.getItem("subspace.advisor-chat.demo-3") ?? "[]");
    expect(saved.map((m: { role: string }) => m.role)).toEqual(["user", "assistant"]);
  });

  it("restores the question and shows the error when the request fails", async () => {
    store.state = tier(3);
    vi.mocked(api.sendChat).mockRejectedValue(
      new Error("The investment assistant is not configured on this server."),
    );
    render(<AdvisorChat />);
    const input = screen.getByLabelText("Message the investment assistant");
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText(/not configured/)).toBeInTheDocument();
    await waitFor(() => expect(input).toHaveValue("Hello"));
    expect(localStorage.getItem("subspace.advisor-chat.demo-3")).toBe("[]");
  });

  it("formats assistant Markdown without rendering raw HTML or unsafe links", async () => {
    store.state = tier(3);
    localStorage.setItem(
      "subspace.advisor-chat.demo-3",
      JSON.stringify([
        { role: "user", content: "**not bold**" },
        {
          role: "assistant",
          content:
            "## Plan\n\n- **AAPL**: 2 shares\n\n| Symbol | Price |\n| --- | --- |\n| MSFT | 2,400 RON |\n\n<img src=x onerror=alert(1)> [bad](javascript:alert(1))",
        },
      ]),
    );
    const { container } = render(<AdvisorChat />);
    expect(screen.getByRole("heading", { name: "Plan" })).toBeInTheDocument();
    expect(screen.getByText("AAPL").tagName).toBe("STRONG");
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "2,400 RON" })).toBeInTheDocument();
    // User text stays literal; raw HTML and javascript: URLs are not rendered.
    expect(screen.getByText("**not bold**")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("bad").getAttribute("href") ?? "").not.toMatch(/javascript/i);
  });
});
