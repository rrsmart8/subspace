import { useEffect, useRef, useState } from "react";
import { Bot, Send, Trash2 } from "lucide-react";
import { useDemo } from "@/state/DemoStore";
import { getTier } from "@/lib/demo-logic";
import * as api from "@/services/mockApi";
import { cn } from "@/lib/utils";
import { Btn, Chip, Notice, Panel } from "./ui";
import { ChatMarkdown } from "./ChatMarkdown";

// Chat history is kept only in this browser, per account. The server keeps nothing.
const STORAGE_PREFIX = "subspace.advisor-chat.";
const MAX_STORED = 40;
const MAX_SENT = 20;
const MAX_CHARS = 2000;
const TOOL_LABELS: Record<string, string> = {
  search_companies: "company search",
  get_stock_snapshot: "live prices",
  get_price_history: "price history",
  get_company_news: "company news",
  get_corporate_actions: "dividends & splits",
};

type Entry = api.ChatMessage & { tools?: string[] };

// Storage can be missing or throw (private mode, quota, some runtimes); chat then lives in memory.
const storage = (): Storage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

function load(key: string): Entry[] {
  try {
    const raw = JSON.parse(storage()?.getItem(key) ?? "[]");
    return Array.isArray(raw)
      ? raw.filter(
          (m): m is Entry =>
            (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string",
        )
      : [];
  } catch {
    return [];
  }
}

export function AdvisorChat() {
  const { state } = useDemo();
  const accountId = state.accountId ?? "demo";
  const key = `${STORAGE_PREFIX}${accountId}`;
  const [messages, setMessages] = useState<Entry[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const isTier3 = getTier(state).level === 3;

  useEffect(() => {
    setMessages(load(key));
    setError(null);
  }, [key]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, busy]);

  if (!isTier3) return null;

  const save = (next: Entry[]) => {
    const trimmed = next.slice(-MAX_STORED);
    setMessages(trimmed);
    try {
      storage()?.setItem(key, JSON.stringify(trimmed));
    } catch {
      // Storage full or disabled: keep the conversation in memory only.
    }
  };

  const send = async () => {
    const content = draft.trim();
    if (!content || busy) return;
    const history = [...messages, { role: "user" as const, content }];
    save(history);
    setDraft("");
    setError(null);
    setBusy(true);
    try {
      const sent = history
        .slice(-MAX_SENT)
        .map(({ role, content: text }) => ({ role, content: text }));
      const r = await api.sendChat(accountId, sent);
      save([...history, { role: "assistant", content: r.reply, tools: r.toolsUsed }]);
    } catch (e) {
      // Roll back the unanswered question so the conversation stays well-formed.
      save(messages);
      setDraft(content);
      setError(e instanceof Error ? e.message : "The assistant could not be reached.");
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    save([]);
    try {
      storage()?.removeItem(key);
    } catch {
      // ignore
    }
  };

  return (
    <Panel className="mt-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl">Assistant</h2>
        </div>
        <Btn variant="ghost" onClick={clear} disabled={busy || messages.length === 0}>
          <Trash2 className="h-4 w-4" aria-hidden />
          Clear conversation
        </Btn>
      </div>
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation with the investment assistant"
        className="h-[40rem] max-h-[75vh] space-y-4 overflow-y-auto rounded-md border bg-deep p-4"
      >
        {messages.length === 0 && !busy && (
          <p className="text-sm text-muted-foreground">
            Try: “How has Apple performed this year?” or “Help me split my remaining allowance
            across three companies.”
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "min-w-0 rounded-lg px-4 py-3 text-sm",
                m.role === "user"
                  ? "max-w-[75%] whitespace-pre-wrap bg-primary text-primary-foreground"
                  : "max-w-[90%] border bg-card text-foreground",
              )}
            >
              <span className="sr-only">{m.role === "user" ? "You: " : "Assistant: "}</span>
              {m.role === "assistant" ? <ChatMarkdown>{m.content}</ChatMarkdown> : m.content}
              {m.tools && m.tools.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Used: {[...new Set(m.tools)].map((t) => TOOL_LABELS[t] ?? t).join(", ")}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <p className="text-sm text-muted-foreground">Assistant is thinking…</p>}
      </div>
      {error && <Notice tone="bad">{error}</Notice>}
      <form
        className="flex items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="flex-1">
          <label htmlFor="advisor-input" className="sr-only">
            Message the investment assistant
          </label>
          <textarea
            id="advisor-input"
            value={draft}
            maxLength={MAX_CHARS}
            rows={3}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Ask about a company, a price or a strategy…"
            className="w-full resize-none rounded-md border border-input bg-deep px-3 py-2 text-sm outline-none focus:border-ring"
          />
        </div>
        <Btn type="submit" variant="primary" busy={busy} disabled={!draft.trim()}>
          {!busy && <Send className="h-4 w-4" aria-hidden />}
          Send
        </Btn>
      </form>
    </Panel>
  );
}
