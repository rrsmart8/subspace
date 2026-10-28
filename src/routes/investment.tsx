import { PerformanceTracker } from "@/components/demo/PerformanceTracker";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Search } from "lucide-react";
import { toast } from "sonner";
import { useDemo } from "@/state/DemoStore";
import * as api from "@/services/mockApi";
import { STOCKS } from "@/data/mock";
import { getTier, investmentBudget } from "@/lib/demo-logic";
import { useAssetQuote, useQuotes } from "@/hooks/use-quotes";
import { Slider } from "@/components/ui/slider";
import {
  Btn,
  Chip,
  Field,
  Label,
  Notice,
  PageHead,
  Panel,
  SidePanel,
  ron,
} from "@/components/demo/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/investment")({
  head: () => ({
    meta: [
      { title: "Stagewise — Save. Learn. Invest." },
      {
        name: "description",
        content: "Search stocks and manage your investments.",
      },
      { property: "og:title", content: "Stagewise — Save. Learn. Invest." },
      {
        property: "og:description",
        content: "Search stocks and manage your investments.",
      },
    ],
  }),
  component: Investment,
});

export function Investment() {
  const { state } = useDemo();
  const quotes = useQuotes();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<api.Asset | null>(null);
  const [side, setSide] = useState<"buy" | "sell" | null>(null);
  const [results, setResults] = useState<api.Asset[]>(
    STOCKS.map((s) => ({ symbol: s.symbol, name: s.name })),
  );
  const [searching, setSearching] = useState(false);
  const [searchLive, setSearchLive] = useState(false);
  // Browse-by-price-range state (shown when the search box is empty).
  const [browsePrices, setBrowsePrices] = useState<Record<string, number>>({});
  const [bounds, setBounds] = useState<{ min: number; max: number } | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [browseLive, setBrowseLive] = useState(false);
  const tier = getTier(state);
  const canTrade = tier.level >= 2;
  const isSearch = q.trim().length > 0;

  // Debounced company/symbol search against the backend (Alpaca asset universe,
  // static demo catalogue as fallback). An empty query defers to browse mode.
  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setSearching(false);
      setSearchLive(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const r = await api.searchAssets(term, { signal: controller.signal });
        setResults(r.results);
        setSearchLive(r.live);
      } catch {
        // Ignore aborted/failed searches; keep the previous results.
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [q]);

  // Initial browse load: fetch the pool's price bounds and seed the slider to
  // the full range. Runs once on mount (and only matters in browse mode).
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setBrowsing(true);
      try {
        const r = await api.browseAssets(0, Number.MAX_SAFE_INTEGER, { signal: controller.signal });
        setBounds(r.bounds);
        setRange([r.bounds.min, r.bounds.max]);
        setBrowseLive(r.live);
        setResults(r.companies.map((c) => ({ symbol: c.symbol, name: c.name })));
        setBrowsePrices(Object.fromEntries(r.companies.map((c) => [c.symbol, c.price])));
      } catch {
        // Fall back to the static catalogue list already in `results`.
      } finally {
        setBrowsing(false);
      }
    })();
    return () => controller.abort();
  }, []);

  // Debounced refetch whenever the user adjusts the range slider (browse mode).
  useEffect(() => {
    if (isSearch || !range) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setBrowsing(true);
      try {
        const r = await api.browseAssets(range[0], range[1], { signal: controller.signal });
        setBrowseLive(r.live);
        setResults(r.companies.map((c) => ({ symbol: c.symbol, name: c.name })));
        setBrowsePrices(Object.fromEntries(r.companies.map((c) => [c.symbol, c.price])));
      } catch {
        // Keep the previous browse results on error.
      } finally {
        setBrowsing(false);
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [range, isSearch]);

  const priceInList = (symbol: string) => browsePrices[symbol] ?? quotes.priceOf(symbol);

  const selPrice = useAssetQuote(sel?.symbol ?? null);
  // Prefer the dedicated single-symbol quote; fall back to the browse/catalogue price.
  const price = sel ? (selPrice.price ?? priceInList(sel.symbol)) : 0;
  const live = sel
    ? selPrice.live || browseLive || (quotes.live && STOCKS.some((s) => s.symbol === sel.symbol))
    : false;
  const owned = sel ? (state.holdings[sel.symbol]?.qty ?? 0) : 0;
  const room = investmentBudget(state).remaining;

  if (!canTrade)
    return (
      <>
        <PageHead title="Investment" />
        <Notice tone="amber">
          <Lock className="mr-1 inline h-4 w-4" />
          You need a higher tier to invest. Investments unlock at tier 2.
        </Notice>
      </>
    );

  return (
    <>
      <PageHead title="Investment" />
      <PerformanceTracker />
      <div className="panels mb-6 sm:grid-cols-3">
        <div className="p-4">
          <Label>Cash</Label>
          <div className="measured mt-1 text-lg text-cool">{ron(state.cash)}</div>
        </div>
        <div className="p-4">
          <Label>{tier.name} allowance left</Label>
          <div className="measured mt-1 text-lg text-cool">{ron(room)}</div>
        </div>
        <div className="p-4">
          <Label>Holdings</Label>
          <div className="measured mt-1 text-sm text-ink-2">
            {Object.entries(state.holdings)
              .map(([k, h]) => `${k}×${h.qty}`)
              .join("  ") || "None"}
          </div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Panel className="p-0">
          <div className="relative border-b p-4">
            <label htmlFor="stock-search" className="sr-only">
              Search company or symbol
            </label>
            <Search className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="stock-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                searchLive ? "Search any company or symbol (Alpaca)" : "Search company or symbol"
              }
              className="w-full rounded-md border border-input bg-deep py-2 pl-10 pr-3 outline-none focus:border-ring"
            />
          </div>
          {!isSearch && bounds && range && (
            <div className="border-b p-4">
              <div className="flex items-center justify-between">
                <Label>Price range</Label>
                <span className="measured text-xs text-cool">
                  {ron(range[0])} – {ron(range[1])}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Min</span>
                    <span className="measured text-xs text-cool">{ron(range[0])}</span>
                  </div>
                  <Slider
                    className="mt-2"
                    aria-label="Minimum price"
                    min={bounds.min}
                    max={bounds.max}
                    step={Math.max(1, Math.round((bounds.max - bounds.min) / 200))}
                    value={[range[0]]}
                    onValueChange={(v) =>
                      setRange([Math.min(v[0] ?? range[0], range[1]), range[1]] as [number, number])
                    }
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Max</span>
                    <span className="measured text-xs text-cool">{ron(range[1])}</span>
                  </div>
                  <Slider
                    className="mt-2"
                    aria-label="Maximum price"
                    min={bounds.min}
                    max={bounds.max}
                    step={Math.max(1, Math.round((bounds.max - bounds.min) / 200))}
                    value={[range[1]]}
                    onValueChange={(v) =>
                      setRange([range[0], Math.max(v[0] ?? range[1], range[0])] as [number, number])
                    }
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Showing up to 16 companies spread across this range
                {browseLive ? " (Alpaca prices)" : ""}.
              </p>
            </div>
          )}
          {(searching || browsing) && results.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              {isSearch ? "Searching…" : "Loading companies…"}
            </p>
          ) : results.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              {isSearch ? `No matches for “${q}”.` : "No companies in this price range."}
            </p>
          ) : (
            <ul className="max-h-[28rem] divide-y overflow-y-auto">
              {results.map((s) => (
                <li key={s.symbol}>
                  <button
                    onClick={() => setSel(s)}
                    aria-pressed={sel?.symbol === s.symbol}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent",
                      sel?.symbol === s.symbol && "bg-accent",
                    )}
                  >
                    <span className="measured w-14 shrink-0 text-ink-2">{s.symbol}</span>
                    <span className="flex-1 truncate text-sm">{s.name}</span>
                    {!isSearch && (
                      <span className="measured text-sm text-cool">
                        {ron(priceInList(s.symbol))}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="p-6">
          {!sel ? (
            <p className="text-muted-foreground">Select a stock to see its summary.</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="measured text-ink-2">{sel.symbol}</span>
                <Chip>{live ? "Live price" : "Simulated price"}</Chip>
              </div>
              <h2 className="mt-2 text-3xl">{sel.name}</h2>
              <div className="reading mt-6 text-5xl text-cool">
                {selPrice.loading && selPrice.price === null ? "…" : ron(price)}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                You own <span className="measured text-cool">{owned}</span> shares
              </p>
              <div className="mt-6 flex gap-3">
                <Btn
                  variant="primary"
                  disabled={!canTrade || price <= 0}
                  onClick={() => setSide("buy")}
                >
                  Buy
                </Btn>
                <Btn
                  disabled={!canTrade || owned === 0 || price <= 0}
                  onClick={() => setSide("sell")}
                >
                  Sell
                </Btn>
              </div>
              {price <= 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  No price is available for {sel.symbol} right now, so it can’t be traded.
                </p>
              )}
              {!canTrade && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Trading is disabled on the {tier.name} tier.
                </p>
              )}
            </>
          )}
        </Panel>
      </div>
      {sel && price > 0 && (
        <OrderPanel symbol={sel.symbol} price={price} side={side} onClose={() => setSide(null)} />
      )}
    </>
  );
}

function OrderPanel({
  symbol,
  price,
  side,
  onClose,
}: {
  symbol: string;
  price: number;
  side: "buy" | "sell" | null;
  onClose: () => void;
}) {
  const { state, run } = useDemo();
  const [qty, setQty] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const n = /^\d+$/.test(qty) ? Number(qty) : 0;
  const close = () => {
    if (busy) return;
    setQty("1");
    setError(null);
    onClose();
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !side) return;
    setBusy(true);
    const r = await run((s) => api.trade(s, symbol, side, qty));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(r.message);
    setQty("1");
    setError(null);
    onClose();
  };
  return (
    <SidePanel
      open={!!side}
      onOpenChange={(o) => !o && close()}
      title={`${side === "buy" ? "Buy" : "Sell"} ${symbol}`}
      description="Simulated order priced at the latest quote. No real trade is placed."
    >
      <form onSubmit={submit} className="space-y-5">
        <div className="text-sm text-muted-foreground">
          Price <span className="measured text-cool">{ron(price)}</span> · Owned{" "}
          <span className="measured text-cool">{state.holdings[symbol]?.qty ?? 0}</span> · Cash{" "}
          <span className="measured text-cool">{ron(state.cash)}</span>
        </div>
        <Field
          id="qty"
          label="Quantity (whole shares)"
          inputMode="numeric"
          value={qty}
          error={error}
          onChange={(e) => {
            setQty(e.target.value);
            setError(null);
          }}
        />
        <div className="flex items-center justify-between rounded-md border bg-deep px-4 py-3">
          <span className="text-sm text-muted-foreground">Estimated total</span>
          <span className="measured text-lg text-cool">{ron(n * price)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          The final price is set by the server from the latest quote when your order is placed, so
          the total may differ slightly.
        </p>
        <div className="flex gap-3">
          <Btn type="submit" variant="primary" busy={busy} className="flex-1">
            {busy ? "Placing order…" : `Confirm ${side}`}
          </Btn>
          <Btn type="button" onClick={close} disabled={busy}>
            Cancel
          </Btn>
        </div>
      </form>
    </SidePanel>
  );
}
