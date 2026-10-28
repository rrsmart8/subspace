import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Lock, Search } from "lucide-react";
import { toast } from "sonner";
import { useDemo } from "@/state/DemoStore";
import * as api from "@/services/mockApi";
import { STOCKS } from "@/data/mock";
import { getTier, investmentBudget } from "@/lib/demo-logic";
import { Btn, Chip, Field, Label, Notice, PageHead, Panel, SidePanel, ron } from "@/components/demo/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/investment")({
  head: () => ({
    meta: [
      { title: "Investment — Stagewise demo" },
      { name: "description", content: "Search mock stocks and place simulated buy and sell orders." },
      { property: "og:title", content: "Investment — Stagewise demo" },
      { property: "og:description", content: "Search mock stocks and place simulated buy and sell orders." },
    ],
  }),
  component: Investment,
});

export function Investment() {
  const { state } = useDemo();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [side, setSide] = useState<"buy" | "sell" | null>(null);
  const tier = getTier(state);
  const canTrade = tier.level >= 2;
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? STOCKS.filter((s) => s.symbol.toLowerCase().includes(t) || s.name.toLowerCase().includes(t)) : STOCKS;
  }, [q]);
  const stock = STOCKS.find((s) => s.symbol === sel);
  const owned = sel ? state.holdings[sel]?.qty ?? 0 : 0;
  const budget = investmentBudget(state);
  const room = budget.remaining;

  if (!canTrade) return <><PageHead title="Investment" /><Notice tone="amber"><Lock className="mr-1 inline h-4 w-4" />You need a higher tier to invest. Investments unlock at tier 2.</Notice></>;

  return (
    <>
      <PageHead title="Investment" lede="Prices and trades are simulated. No live market connection." />
      <div className="panels mb-6 sm:grid-cols-3">
        <div className="p-4"><Label>Cash</Label><div className="measured mt-1 text-lg text-cool">{ron(state.cash)}</div></div>
        <div className="p-4"><Label>{tier.name} allowance left</Label><div className="measured mt-1 text-lg text-cool">{ron(room)}</div></div>
        <div className="p-4"><Label>Holdings</Label><div className="measured mt-1 text-sm text-ink-2">{Object.entries(state.holdings).map(([k, h]) => `${k}×${h.qty}`).join("  ") || "None"}</div></div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Panel className="p-0">
          <div className="relative border-b p-4">
            <label htmlFor="stock-search" className="sr-only">Search company or symbol</label>
            <Search className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input id="stock-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company or symbol" className="w-full rounded-md border border-input bg-deep py-2 pl-10 pr-3 outline-none focus:border-ring" />
          </div>
          {results.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No matches for “{q}”.</p> : (
            <ul className="max-h-[28rem] divide-y overflow-y-auto">
              {results.map((s) => (
                <li key={s.symbol}>
                  <button onClick={() => setSel(s.symbol)} aria-pressed={sel === s.symbol} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent", sel === s.symbol && "bg-accent")}>
                    <span className="measured w-14 text-ink-2">{s.symbol}</span>
                    <span className="flex-1 truncate text-sm">{s.name}</span>
                    <span className="measured text-sm text-cool">{ron(s.price)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="p-6">
          {!stock ? <p className="text-muted-foreground">Select a stock to see its summary.</p> : (
            <>
              <div className="flex items-center gap-2"><span className="measured text-ink-2">{stock.symbol}</span><Chip>Simulated price</Chip></div>
              <h2 className="mt-2 text-3xl">{stock.name}</h2>
              <div className="reading mt-6 text-5xl text-cool">{ron(stock.price)}</div>
              <p className="mt-3 text-sm text-muted-foreground">You own <span className="measured text-cool">{owned}</span> shares</p>
              <div className="mt-6 flex gap-3">
                <Btn variant="primary" disabled={!canTrade} onClick={() => setSide("buy")}>Buy</Btn>
                <Btn disabled={!canTrade || owned === 0} onClick={() => setSide("sell")}>Sell</Btn>
              </div>
              {!canTrade && <p className="mt-3 text-xs text-muted-foreground">Trading is disabled on the {tier.name} tier.</p>}
            </>
          )}
        </Panel>
      </div>
      {stock && <OrderPanel symbol={stock.symbol} side={side} onClose={() => setSide(null)} />}
    </>
  );
}

function OrderPanel({ symbol, side, onClose }: { symbol: string; side: "buy" | "sell" | null; onClose: () => void }) {
  const { state, run } = useDemo();
  const stock = STOCKS.find((s) => s.symbol === symbol)!;
  const [qty, setQty] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const n = /^\d+$/.test(qty) ? Number(qty) : 0;
  const close = () => { if (busy) return; setQty("1"); setError(null); onClose(); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !side) return;
    setBusy(true);
    const r = await run((s) => api.trade(s, symbol, side, qty));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(`${r.message} (simulated)`);
    setQty("1"); setError(null); onClose();
  };
  return (
    <SidePanel open={!!side} onOpenChange={(o) => !o && close()} title={`${side === "buy" ? "Buy" : "Sell"} ${symbol}`} description="Simulated order. No real trade is placed.">
      <form onSubmit={submit} className="space-y-5">
        <div className="text-sm text-muted-foreground">Price <span className="measured text-cool">{ron(stock.price)}</span> · Owned <span className="measured text-cool">{state.holdings[symbol]?.qty ?? 0}</span> · Cash <span className="measured text-cool">{ron(state.cash)}</span></div>
        <Field id="qty" label="Quantity (whole shares)" inputMode="numeric" value={qty} error={error} onChange={(e) => { setQty(e.target.value); setError(null); }} />
        <div className="flex items-center justify-between rounded-md border bg-deep px-4 py-3">
          <span className="text-sm text-muted-foreground">Estimated total</span>
          <span className="measured text-lg text-cool">{ron(n * stock.price)}</span>
        </div>
        <div className="flex gap-3">
          <Btn type="submit" variant="primary" busy={busy} className="flex-1">{busy ? "Placing order…" : `Confirm ${side}`}</Btn>
          <Btn type="button" onClick={close} disabled={busy}>Cancel</Btn>
        </div>
      </form>
    </SidePanel>
  );
}
