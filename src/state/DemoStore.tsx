import { ClockContext } from "./ClockContext";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { initialState, type DemoState, type Lesson } from "@/data/mock";
import * as api from "@/services/mockApi";
import { AccountSetup, type AccountDetails } from "@/components/demo/AccountSetup";
import type { Result } from "@/lib/demo-logic";

interface Ctx {
  state: DemoState;
  hydrated: boolean;
  accounts: api.DemoAccount[];
  lessons: Lesson[];
  switchAccount: (id: string) => Promise<void>;
  run: (fn: (s: DemoState) => Promise<Result>) => Promise<Result>;
  reset: () => Promise<void>;
  startSetup: () => void;
}
const DemoCtx = createContext<Ctx | null>(null);
export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(() => initialState());
  const [setup, setSetup] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [accounts, setAccounts] = useState<api.DemoAccount[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef(state);
  const busy = useRef(false);
  const apply = useCallback((next: DemoState) => {
    ref.current = next; setState(next);
    setAccounts(old => old.map(a => a.id === next.accountId ? { ...a, balance: next.cash, tier: next.tierLevel ?? a.tier } : a));
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [available, content] = await Promise.all([api.listAccounts(), api.listLessons()]);
        const stored = localStorage.getItem("stagewise-account");
        const id = stored && available.some(a => a.id === stored) ? stored : "demo-1";
        const next = await api.loadState(id);
        if (!cancelled) { setAccounts(available); setLessons(content); apply(next); setHydrated(true); setSetup(!stored); }
      } catch { if (!cancelled) setError("Cannot connect to the SQLite backend. Start it with npm run backend, then retry."); }
    }
    void init();
    return () => { cancelled = true; };
  }, [apply]);
  const run = useCallback(async (fn: (s: DemoState) => Promise<Result>): Promise<Result> => {
    if (busy.current) return { ok: false, error: "Please wait for the current action to finish." };
    busy.current = true;
    try { const result = await fn(ref.current); if (result.ok) apply(result.state); return result; }
    catch { return { ok: false, error: "Unable to complete the request." }; }
    finally { busy.current = false; }
  }, [apply]);
  const switchAccount = useCallback(async (id: string) => {
    if (busy.current) return;
    busy.current = true; setHydrated(false); setError(null);
    try { apply(await api.loadState(id)); localStorage.setItem("stagewise-account", id); setSetup(false); }
    catch { setError("Unable to load this account. Please retry."); }
    finally { busy.current = false; setHydrated(true); }
  }, [apply]);
  const createAccount = async (details: AccountDetails) => {
    const next = await api.createAccount(details);
    apply(next);
    setAccounts(old => [...old, { id: next.accountId!, name: next.profile.name, tier: next.tierLevel ?? 1, balance: next.cash }]);
    localStorage.setItem("stagewise-account", next.accountId!);
    setSetup(false);
  };
  const reset = useCallback(async () => { const result = await run(api.resetDemo); if (!result.ok) setError(result.error); }, [run]);
  if (error) return <main className="mx-auto max-w-xl space-y-4 p-10"><p role="alert">{error}</p><button onClick={() => window.location.reload()}>Retry</button></main>;
  if (!hydrated) return <main className="p-10" role="status">Loading your account…</main>;
  if (setup) return <AccountSetup accounts={accounts} onCreate={createAccount} onSelect={switchAccount} onCancel={() => setSetup(false)} />;
  return <DemoCtx.Provider value={{ state, hydrated, accounts, lessons, switchAccount, run, reset, startSetup: () => setSetup(true) }}><ClockContext.Provider value={state.serverNow ?? null}>{children}</ClockContext.Provider></DemoCtx.Provider>;
}
export function useDemo() {
  const c = useContext(DemoCtx);
  if (!c) throw new Error("useDemo outside DemoProvider");
  return c;
}
