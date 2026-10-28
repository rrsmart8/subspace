import { useEffect, useRef, useState } from "react";
import * as api from "@/services/mockApi";
import { STOCKS } from "@/data/mock";

const STATIC_PRICE = new Map(STOCKS.map((s) => [s.symbol, s.price]));

export interface Quotes {
  /** Price in RON for a symbol: live when available, else the static demo price. */
  priceOf: (symbol: string) => number;
  /** True when at least one price came from the live Alpaca feed. */
  live: boolean;
  /** Market-data feed in use (e.g. "iex"), when live. */
  feed: string | null;
  /** Whether the first quote fetch has completed. */
  loaded: boolean;
}

/**
 * Fetches live market quotes from the backend (which proxies Alpaca) and polls
 * on an interval. Falls back silently to the static demo prices so the UI keeps
 * working when the feed is disabled or unreachable.
 */
export function useQuotes(intervalMs = 15_000): Quotes {
  const [prices, setPrices] = useState<Map<string, number>>(() => new Map(STATIC_PRICE));
  const [live, setLive] = useState(false);
  const [feed, setFeed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const load = async () => {
      try {
        const result = await api.getQuotes();
        if (!mounted.current) return;
        setPrices((prev) => {
          const next = new Map(prev);
          for (const q of result.quotes) next.set(q.symbol, q.price);
          return next;
        });
        setLive(result.live);
        setFeed(result.live ? result.feed : null);
      } catch {
        // Keep whatever prices we already have (static fallback at minimum).
      } finally {
        if (mounted.current) setLoaded(true);
      }
    };
    void load();
    const timer = setInterval(load, intervalMs);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [intervalMs]);

  return {
    priceOf: (symbol) => prices.get(symbol) ?? STATIC_PRICE.get(symbol) ?? 0,
    live,
    feed,
    loaded,
  };
}

export interface AssetQuote {
  /** Latest price in RON, or null until the first fetch resolves. */
  price: number | null;
  /** True when the price came from the live Alpaca feed. */
  live: boolean;
  /** True while a fetch is in flight for the current symbol. */
  loading: boolean;
}

/**
 * Fetches the latest quote for a single symbol (which may be any Alpaca-tradable
 * ticker, not just the demo catalogue) and refreshes it on an interval. Returns
 * a null price while loading or when no price is available. Pass null to idle.
 */
export function useAssetQuote(symbol: string | null, intervalMs = 15_000): AssetQuote {
  const [state, setState] = useState<AssetQuote>({
    price: null,
    live: false,
    loading: Boolean(symbol),
  });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (!symbol) {
      setState({ price: null, live: false, loading: false });
      return () => {
        mounted.current = false;
      };
    }
    setState((prev) => ({ ...prev, loading: true }));
    const load = async () => {
      try {
        const result = await api.getQuotes([symbol]);
        if (!mounted.current) return;
        const q = result.quotes.find((x) => x.symbol === symbol);
        setState({ price: q ? q.price : null, live: Boolean(q?.live), loading: false });
      } catch {
        if (mounted.current) setState((prev) => ({ ...prev, loading: false }));
      }
    };
    void load();
    const timer = setInterval(load, intervalMs);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [symbol, intervalMs]);

  return state;
}
