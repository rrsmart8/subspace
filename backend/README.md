# SQLite demo backend

Use Node.js 22.18+ (Node 24+ recommended). The core API uses Node's HTTP server and built-in SQLite driver; the only backend package is `@alpacahq/alpaca-trade-api`, used for optional live market data (the app falls back to static prices when Alpaca keys are absent).

From the `subspace` directory:

```sh
bun install
npm run db:seed
npm run backend
```

In another terminal, from the same directory:

```sh
npm run dev
```

Open the URL printed by Vite. The frontend proxies `/api` to `http://127.0.0.1:3001`. Use the **Demo account** selector in the navigation to switch accounts. The selected account survives refresh; financial and learning state is loaded from SQLite, not browser local storage.

| ID | Name | Tier | Opening balance |
| --- | --- | --- | --- |
| demo-1 | Ana Popescu | 1 | 750 RON |
| demo-2 | Andrei Ionescu | 2 | 3,500 RON |
| demo-3 | Maria Dumitrescu | 3 | 8,500 RON |

Tier 1 sees “You need a higher tier to invest” on the Investment page. Its buy and sell API requests receive HTTP 403. Tier 2 and tier 3 can place simulated orders, subject to cash, holdings and their percentage limits (10% for tier 2 and 25% for tier 3 of cash plus holdings at purchase cost, less capital already invested). Prices are live Alpaca market data (converted to RON) when Alpaca keys are configured; otherwise they are the static RON demo quotes. Either way, orders are simulated and never routed to a broker. See "Live market data (Alpaca)" below.

## Database and SQL scripts

- `schema.sql` creates accounts, learning content and processed-request records.
- `seed.sql` populates the three accounts, their assigned tiers, fictional profiles and starting histories. Run schema first if executing SQL manually.
- `npm run db:seed` runs both scripts and loads the lesson catalogue into SQLite.
- The API also initializes the database automatically when first started.
- The default database is `backend/data/stagewise.sqlite`, excluded from version control.
- Set `SQLITE_PATH` to use a different database path. `PORT` changes the backend port; set the same value for Vite when starting the services separately.

Seed reruns preserve existing accounts. **Reset demo** resets only the selected account to its seed balance, tier, lessons and history. Tiers are stored account attributes. Tier 1 now promotes to Tier 2 after the income-based monthly streak, balance and lessons pass; see the root README for the rules. Tier 3 promotion remains inactive.

Money is stored as integer bani in the account balance. Holdings, history, lesson completion and coupon codes are stored in the account's JSON state. Learning content has its own SQLite table. Each mutation reads the current database state, validates it using the shared business rules, and writes inside a transaction. Request IDs prevent applying the same submitted request twice. Lesson answers are checked on the server.

## Endpoints

- `GET /api/accounts`: list the available accounts.
- `POST /api/accounts`: create a Tier 1 account with `name`, `email`, `monthlyIncome` and a unique `requestId`.
- `GET /api/accounts/:id/state`: account state.
- `GET /api/lessons`: learning catalogue from SQLite.
- `GET /api/market/quotes`: latest prices in RON for the demo catalogue. Optional `?symbols=AAPL,F` narrows the list. Returns `{ quotes: [{ symbol, price, live }], live, feed, rate }`.
- `GET /api/market/search`: search tradable US-equity companies by symbol or name via `?q=...`. Returns `{ results: [{ symbol, name }], live }` from Alpaca's asset universe (static demo catalogue as fallback).
- `POST /api/accounts/:id/actions`: `deposit`, `withdraw`, `trade`, `redeem`, `lesson` or `reset`, with a unique `requestId`.

Example body:

```json
{"action":"trade","symbol":"F","side":"buy","qty":"1","requestId":"example-order-001"}
```

The API ignores client-supplied balances and tiers and uses the account's stored data. Accounts are deliberately selectable without passwords for this local demonstration. This is not production authentication or brokerage: deposits, withdrawals, coupons and the simulated orders are all demo-only. Orders are **not** routed to any broker; the Alpaca integration supplies live market **data** only. Do not expose the API publicly with real account data. A deployed frontend will need a reachable backend and same-origin API routing; the Vite proxy applies to local development only.

## Live market data (Alpaca)

The Investment tab can show live prices from the [Alpaca Market Data API](https://alpaca.markets) via the official Node.js SDK (`@alpacahq/alpaca-trade-api`). The SDK runs **server-side only** (`backend/alpaca.mjs`); credentials never reach the browser, which only ever calls `/api`.

Setup:

1. Create API keys at <https://app.alpaca.markets> (a paper account works; the free `iex` feed is used by default).
2. Copy `.env.example` to `.env` in the project root and set `APCA_API_KEY_ID` and `APCA_API_SECRET_KEY`.
3. Restart the backend (`npm run backend` or `npm run dev:all`). `backend/env.mjs` loads `.env` on startup.

Behaviour and configuration:

- Alpaca prices are USD; the app is RON, so prices are converted with `ALPACA_USD_TO_RON` (default `4.57`). Set this to a realistic rate for your data.
- `ALPACA_DATA_FEED` selects `iex` (free) or `sip` (paid). `ALPACA_CACHE_MS` controls the per-symbol server cache (default 10s).
- **Fallback:** with no keys, or if a quote request fails, the server returns the static demo prices from `src/data/mock.ts` (`live: false`). The app and the test-suite therefore run with no Alpaca account. `ALPACA_DISABLE=1` forces this static mode even when keys are present (used by `npm run test:backend` to stay deterministic).
- **Search:** the Investment search bar queries `GET /api/market/search`, which searches Alpaca's full tradable US-equity universe by symbol or company name (cached ~6h, `ALPACA_ASSETS_TTL_MS`). Any symbol that returns a live price can be traded; without Alpaca it searches the static demo catalogue only.
- **Trade pricing:** `trade` orders are settled server-side at the latest quote (live when available, else the static price), while all tier, allowance, cash and holdings rules are unchanged. `.env`/SQLite files are git-ignored — never commit secrets.

## Verification

```sh
npm run test:backend
npm run test:chatbot
npm test
npx tsc --noEmit
npm run build
```

## Tier 3 investment assistant (Featherless + MCP)

Tier 3 members see an **Investment assistant** chat on the Investment page. It answers questions about investment strategy and US stock market data. Tiers 1 and 2 don't see it, and the API rejects their requests with HTTP 403, based on the tier stored in SQLite.

How it fits together:

```
browser (history in localStorage)
  └─ POST /api/accounts/:id/chat  { messages: [{ role: "user" | "assistant", content }] }
       backend/server.mjs        tier check (SQLite), input validation, 12 requests/min per account
       backend/chatbot/chat.mjs  system prompt + account context, tool-calling loop (max 5 rounds)
         ├─ Featherless SDK      non-streaming chat completions with `tools`
         └─ mcp-client.mjs       MCP client over stdio → `uv run python -m market_mcp`
              backend/chatbot/mcp_server/   FastMCP server, read-only Alpaca market data
```

- **System prompt**: `backend/chatbot/system_prompt.md`. The server appends the account context (tier, cash, remaining allowance, holdings, today's date). The browser sends only user and assistant text; any system or tool message it sends is rejected.
- **Tools** (all read-only, all amounts in RON at `ALPACA_USD_TO_RON`): `search_companies`, `get_stock_snapshot`, `get_price_history` (adjusted bars since 2016 and a summary), `get_company_news`, `get_corporate_actions`. The MCP server only receives the Alpaca variables, not the Featherless key.
- **Model**: `FEATHERLESS_MODEL`, default `moonshotai/Kimi-K2-Instruct`. Featherless supports native tool calling for Kimi K2 and the Qwen 3 family. Most models have a 32k-token context, so tool outputs are kept compact (at most 60 sampled bars, short news summaries).
- **Fundamentals**: Alpaca doesn't provide fundamentals (P/E, market cap, earnings). The prompt tells the model to say so instead of guessing.

Setup:

1. Install [uv](https://docs.astral.sh/uv/). `npm run setup` then runs `uv sync` for `backend/chatbot/mcp_server`, or you can run it yourself.
2. Set `FEATHERLESS_API_KEY` in the root `.env` (see `.env.example`). Alpaca keys are needed for real data; without them, every tool reports that market data is unavailable.
3. Restart the backend. The MCP server starts on the first chat message and stops with the API.

Without `FEATHERLESS_API_KEY`, the chat endpoint returns 503 and the rest of the app is unaffected.

You can debug the MCP server on its own, from `backend/chatbot/mcp_server`:

```sh
uv run pytest -q   # tests use a fake source, no network
npx @modelcontextprotocol/inspector uv run --env-file ../../../.env python -m market_mcp   # try tools interactively
```

## Tier 2 performance tracking

A 90-day tracking period is now available on Investment. Start via the account action `performance-start`; fetch or refresh via `GET /api/accounts/:id/performance`. Opening/current portfolio valuations and snapshot history are persisted in SQLite. Deposits and withdrawals are excluded from P&L, and the percentage is a cash-flow-adjusted estimate for cash plus holdings. Orders currently have zero fees.

See the root README for quote freshness, FX policy, demo-time handling, snapshot cadence and historical-closing limitations. No profit gate is active. Tier 3 readiness is server-enforced using 90 compliant days, three completed saving months, the cash reserve and four lessons; see the root README for the frozen plan and reset rules. `performance_snapshots` preserves prior run history even if a demo account is reset. Network requests never run inside the SQLite write transaction.
