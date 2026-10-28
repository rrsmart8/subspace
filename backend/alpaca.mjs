// Server-side Alpaca adapter (market data + asset search).
//
// This module is the ONLY place that talks to Alpaca. Credentials stay on the
// server (never shipped to the browser, which only ever calls /api). When no
// credentials are configured, or a request fails, it falls back to the static
// demo catalogue in src/data/mock.ts so the demo keeps working offline and the
// backend test-suite (which asserts exact static prices) stays deterministic.
//
// Alpaca quotes are in USD. The app formats money as RON, so prices are
// converted with a configurable rate (ALPACA_USD_TO_RON). This keeps the quote
// endpoint and server-side trade pricing on the same scale.
import { STOCKS } from '../src/data/mock.ts';

const KEY_ID = process.env.APCA_API_KEY_ID || process.env.ALPACA_API_KEY_ID;
const SECRET = process.env.APCA_API_SECRET_KEY || process.env.ALPACA_SECRET_KEY;
// ALPACA_DISABLE=1 forces static-price mode even when keys are present, so the
// test-suite stays deterministic regardless of a developer's local .env.
const DISABLED = /^(1|true|yes)$/i.test(process.env.ALPACA_DISABLE ?? '');
const USD_TO_RON = Number(process.env.ALPACA_USD_TO_RON) > 0 ? Number(process.env.ALPACA_USD_TO_RON) : 4.57;
const FEED = process.env.ALPACA_DATA_FEED || 'iex';
const CACHE_MS = Number(process.env.ALPACA_CACHE_MS) > 0 ? Number(process.env.ALPACA_CACHE_MS) : 10_000;
const ASSETS_TTL_MS = Number(process.env.ALPACA_ASSETS_TTL_MS) > 0 ? Number(process.env.ALPACA_ASSETS_TTL_MS) : 6 * 60 * 60 * 1000;
const SEARCH_LIMIT = 25;

export const alpacaEnabled = Boolean(KEY_ID && SECRET) && !DISABLED;

const STATIC = new Map(STOCKS.map((s) => [s.symbol, { symbol: s.symbol, name: s.name, price: s.price }]));
const STATIC_SYMBOLS = STOCKS.map((s) => s.symbol);
const round2 = (n) => Math.round(n * 100) / 100;

// Lazily create the client once, so importing this module never fails when the
// optional dependency or credentials are absent.
let clientPromise = null;
async function getClient() {
  if (!alpacaEnabled) return null;
  if (!clientPromise) {
    clientPromise = import('@alpacahq/alpaca-trade-api')
      .then(({ Alpaca }) => new Alpaca({ keyId: KEY_ID, secret: SECRET, paper: true }))
      .catch((error) => {
        console.error('Alpaca SDK could not be initialised; using static catalogue.', error.message);
        return null;
      });
  }
  return clientPromise;
}

const priceCache = new Map(); // symbol -> { price, at }

// ----- Quotes ---------------------------------------------------------------

function staticQuote(symbol) {
  const entry = STATIC.get(symbol);
  return entry ? { symbol, price: entry.price, live: false } : null;
}

async function liveQuote(client, symbol) {
  const cached = priceCache.get(symbol);
  if (cached && Date.now() - cached.at < CACHE_MS) return { symbol, price: cached.price, live: true };
  const usd = await client.marketData.getLatestPrice(symbol, { feed: FEED });
  if (typeof usd !== 'number' || !Number.isFinite(usd) || usd <= 0) return null;
  const price = round2(usd * USD_TO_RON);
  priceCache.set(symbol, { price, at: Date.now() });
  return { symbol, price, live: true };
}

// Returns a normalised quote { symbol, price, live } for one symbol. Live
// quotes work for ANY Alpaca-tradable symbol; the static demo price is used as
// a fallback only for the demo catalogue (or when the live request fails).
export async function getQuote(symbol) {
  const client = await getClient();
  if (client) {
    try {
      const live = await liveQuote(client, symbol);
      if (live) return live;
    } catch (error) {
      console.error(`Alpaca quote for ${symbol} failed; using static price if available.`, error.message);
    }
  }
  return staticQuote(symbol);
}

// Returns quotes for the given symbols (defaults to the demo catalogue). Also
// reports whether any price came back live so the UI can label the source.
export async function getQuotes(symbols = STATIC_SYMBOLS) {
  const wanted = [...new Set(symbols.map((s) => String(s).toUpperCase()))].filter(Boolean);
  const quotes = (await Promise.all(wanted.map(getQuote))).filter(Boolean);
  return { quotes, live: alpacaEnabled && quotes.some((q) => q.live), feed: FEED, rate: USD_TO_RON };
}

// Authoritative price (RON) used to settle a simulated trade on the server.
// Prefers a live Alpaca price and falls back to the static demo price; returns
// null for an unknown symbol with no live price (caller rejects the order).
export async function priceFor(symbol) {
  const quote = await getQuote(String(symbol).toUpperCase());
  return quote ? quote.price : null;
}

// ----- Asset search ---------------------------------------------------------

let assetsCache = null; // { at, list: [{ symbol, name }] }

async function loadAssets(client) {
  if (assetsCache && Date.now() - assetsCache.at < ASSETS_TTL_MS) return assetsCache.list;
  const raw = await client.trading.assets.getV2Assets({ status: 'active', assetClass: 'us_equity' });
  const list = (raw ?? [])
    .filter((a) => a && a.tradable && a.symbol && a.name)
    .map((a) => ({ symbol: a.symbol, name: a.name }));
  assetsCache = { at: Date.now(), list };
  return list;
}

function scoreMatch(symbol, name, q) {
  const sym = symbol.toLowerCase();
  const nm = name.toLowerCase();
  if (sym === q) return 0;
  if (sym.startsWith(q)) return 1;
  if (nm.startsWith(q)) return 2;
  if (sym.includes(q)) return 3;
  if (nm.includes(q)) return 4;
  return Infinity;
}

function searchStatic(q) {
  return [...STATIC.values()]
    .map((a) => ({ a, score: scoreMatch(a.symbol, a.name, q) }))
    .filter((x) => x.score !== Infinity)
    .sort((x, y) => x.score - y.score || x.a.symbol.localeCompare(y.a.symbol))
    .slice(0, SEARCH_LIMIT)
    .map((x) => ({ symbol: x.a.symbol, name: x.a.name }));
}

// Searches tradable US-equity assets by symbol or company name. Uses Alpaca's
// asset universe when configured, falling back to the static demo catalogue.
// Returns { results: [{ symbol, name }], live }.
export async function searchAssets(query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return { results: [], live: false };
  const client = await getClient();
  if (client) {
    try {
      const assets = await loadAssets(client);
      const results = assets
        .map((a) => ({ a, score: scoreMatch(a.symbol, a.name, q) }))
        .filter((x) => x.score !== Infinity)
        .sort((x, y) => x.score - y.score || x.a.symbol.localeCompare(y.a.symbol))
        .slice(0, SEARCH_LIMIT)
        .map((x) => x.a);
      return { results, live: true };
    } catch (error) {
      console.error('Alpaca asset search failed; using static catalogue.', error.message);
    }
  }
  return { results: searchStatic(q), live: false };
}
