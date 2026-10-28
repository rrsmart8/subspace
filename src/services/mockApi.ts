// API adapter retained under its original name to preserve the UI integration point.
import type { DemoState, Lesson } from "@/data/mock";
import type { Result } from "@/lib/demo-logic";

export interface DemoAccount { id: string; name: string; tier: number; balance: number }
export interface Quote { symbol: string; price: number; live: boolean }
export interface QuotesResult { quotes: Quote[]; live: boolean; feed: string; rate: number }
export interface Asset { symbol: string; name: string }
export interface SearchResult { results: Asset[]; live: boolean }
export interface BrowseCompany { symbol: string; name: string; price: number }
export interface BrowseResult { companies: BrowseCompany[]; bounds: { min: number; max: number }; live: boolean }
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The backend request failed.");
  return data as T;
}
export const listAccounts = () => request<DemoAccount[]>("/accounts");
export const listLessons = () => request<Lesson[]>("/lessons");
export const getQuotes = (symbols?: string[]) => request<QuotesResult>(`/market/quotes${symbols?.length ? `?symbols=${encodeURIComponent(symbols.join(","))}` : ""}`);
export const searchAssets = (q: string, init?: RequestInit) => request<SearchResult>(`/market/search?q=${encodeURIComponent(q)}`, init);
export const browseAssets = (min: number, max: number, init?: RequestInit) => request<BrowseResult>(`/market/browse?min=${encodeURIComponent(String(min))}&max=${encodeURIComponent(String(max))}`, init);
export const loadState = (id: string) => request<DemoState>(`/accounts/${encodeURIComponent(id)}/state`);
async function action(s: DemoState, input: Record<string, unknown>): Promise<Result> {
  try {
    return await request<Result>(`/accounts/${encodeURIComponent(s.accountId ?? "demo-1")}/actions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, requestId: crypto.randomUUID() }),
    });
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to reach the backend." }; }
}
export const resetDemo = (s: DemoState) => action(s, { action: "reset" });
export const deposit = (s: DemoState, amount: string) => action(s, { action: "deposit", amount });
export const withdraw = (s: DemoState, amount: string) => action(s, { action: "withdraw", amount });
export const trade = (s: DemoState, symbol: string, side: "buy" | "sell", qty: string) => action(s, { action: "trade", symbol, side, qty });
export const redeemReward = (s: DemoState, rewardId: string) => action(s, { action: "redeem", rewardId });
export const completeLesson = (s: DemoState, lessonId: string, answer: number) => action(s, { action: "lesson", lessonId, answer });

export const createAccount = (details: { name: string; email: string; monthlyIncome: string }) => request<DemoState>("/accounts", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ...details, requestId: crypto.randomUUID() }),
});

export const answerMastery = (s: DemoState, quarterId: string, scenarioId: string, answer: number) => action(s, { action: "mastery-answer", quarterId, scenarioId, answer });
export const registerMasteryReward = (s: DemoState, quarterId: string) => action(s, { action: "mastery-reward", quarterId });

export const advanceMonth = (s: DemoState) => action(s, { action: "advance-month" });

export interface ChatMessage { role: "user" | "assistant"; content: string }
export interface ChatReply { reply: string; toolsUsed: string[] }
// Tier 3 investment assistant. History lives in the browser and is sent with each turn;
// the server re-checks the stored tier and rebuilds all system/tool context itself.
export const sendChat = (accountId: string, messages: ChatMessage[]) => request<ChatReply>(`/accounts/${encodeURIComponent(accountId)}/chat`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ messages }),
});
