# Stagewise / Subspace

A Romanian saving, learning and investing demo built with React, TanStack Start and a Node.js API backed by SQLite. All money is RON. Payments, stock prices, trades and rewards are simulated.

## Install and run

Requirements: **Node.js 22.18+** (Node 24 LTS recommended; `.nvmrc` included), **Bun 1.4.3**, and Git. SQLite is included in Node; no separate database server or SQLite installation is needed. No API keys or environment files are required for local development.

```sh
git clone https://github.com/rrsmart8/subspace.git
cd subspace
npm run setup
npm run dev:all
```

`setup` installs the versions in `bun.lock` and initializes/seeds SQLite. `dev:all` runs both services:

- Website: **http://127.0.0.1:5173**
- API: **http://127.0.0.1:3001**

Keep the terminal open. Press **Ctrl+C** to stop both. Ports 5173 and 3001 must be available. If setup reports that Bun is missing, install the specified Bun version and rerun it. If using nvm, run `nvm install` and `nvm use` inside this folder first.

Alternatively, start the services in separate terminals:

```sh
npm run backend
```

```sh
npm run dev
```

With separate terminals, open the frontend URL Vite prints. Vite proxies `/api` requests to the local backend.

## Demo accounts

Use the **Demo account** selector in the navigation. There are no passwords for these fictional accounts.

| Account | Tier | Opening balance |
| --- | --- | --- |
| Ana Popescu (`demo-1`) | 1 | 750 RON |
| Andrei Ionescu (`demo-2`) | 2 | 3,500 RON |
| Maria Dumitrescu (`demo-3`) | 3 | 8,500 RON |

Tier 1 sees “You need a higher tier to invest.” Both the UI and API enforce this restriction. Tier 2 can invest 10% and tier 3 can invest 25% of current capital. Capital means available cash plus holdings at purchase cost; invested cost consumes the allowance. Tier 1 is 0%. Tier 1 now promotes automatically to Tier 2 when the income-based saving streak, balance and lessons are all satisfied. Tier 2 promotes automatically to Tier 3 after the saving, reserve, learning and 90-day discipline requirements below. Profit is not a promotion requirement.

Balances, transactions, holdings, coupon codes and learning progress persist in SQLite. The browser remembers only the selected account. **Reset demo** restores the selected account's initial data; it does not reset the other accounts.

## Account setup and saving qualification

First-time visitors see an account setup page. Enter name, email and monthly **take-home** income in RON. The page previews the monthly target, and the API creates a Tier 1 account with a zero balance. Use the existing-account selector to try seeded accounts, or choose **Create account** from the navbar selector to start another account. This is still a local prototype without identity verification or password authentication.

Tier 1 → Tier 2 requires all of:

- At least 10% of declared income saved in each of **3 consecutive calendar months**, using Europe/Bucharest time.
- A retained cash balance of **3 × monthly saving target**.
- At least **2 completed lessons**.

For 5,000 RON monthly income, the target is 500 RON per month and the retained balance requirement is 1,500 RON. The income percentage and streak length live in `src/config/demo.ts`.

Multiple confirmed deposits add up during a month; withdrawals subtract from that month's total. Trades, rewards, opening balances, pending transactions and money dated before enrollment do not count. The signup month can qualify once its full target is met. Setup and Tier 2 progress show today’s date and the next deadline: 00:00 on the first day of the next month in Bucharest time. Open pages refresh their date/progress every 30 seconds and on focus. An unfinished current month preserves the prior streak until month-end; a completed month below target breaks it. Reaching the target in a third consecutive month can qualify immediately. Previous balances, transactions and lessons are never erased. Promotion is persisted by the server and does not demote an already-earned Tier 2 account.

Existing seed accounts keep their assigned tiers. Their fictional monthly incomes are 5,000 / 7,000 / 10,000 RON. Income enrollment metadata is added without overwriting existing balances or history, and historic deposits do not backfill a streak. No income editing or verification is implemented yet; future income changes need an effective-month policy rather than rewriting past targets.

Tier 2 → Tier 3 has an automatic **readiness assessment**, separate from portfolio returns. Start it from Investment after making your first investment. All five milestones must pass:

- Follow the investment plan for 90 consecutive elapsed days: at least two held stocks; no position over 60% of total invested **cost**; total invested cost within the Tier 2 allowance (10% of cash + invested cost).
- Save 10% of declared monthly income in each of the latest three completed consecutive Bucharest calendar months after assessment enrollment. Exclude the partial enrollment month and all Tier 1 saving history. A missed month breaks only this saving streak; later full months can qualify.
- Retain three monthly saving contributions as cash reserve.
- Complete four distinct valid lessons (including the two foundation lessons already completed).
- Meet the investment plan at promotion. A sale/concentration or allowance breach resets the discipline timer, not money, lessons, tracking snapshots or savings history. It restarts when the plan is met again. No mandatory trade frequency or profitable-trade count.

Policy values live in `src/config/demo.ts`. Each assessment freezes its income-based target, reserve and allocation rules in SQLite-backed account state; existing trackers enroll on their first server read without backdating readiness evidence. Cost basis means market price movements alone cannot breach these prototype limits. Two stocks are only a simple prototype concentration check, not proof of a fully diversified portfolio. The server evaluates and persists readiness on account reads and successful actions; client tier/date/eligibility claims are ignored.

The demo month button can demonstrate this habit-based qualification; it does not establish real market performance. Three full savings months may take longer than 90 days because the starting partial month is excluded. After promotion the allowance becomes 25%, and the existing Tier 3 quarterly mastery challenge is initialized. Positive returns never credit a bonus automatically; no new profit-reward funding/payout rule is implemented.

## Investment limits

| Tier | Name | Percentage | Seed account maximum |
| --- | --- | --- | --- |
| 1 | Starter | 0% | 0 RON from 750 RON |
| 2 | Builder | 10% | 350 RON from 3,500 RON |
| 3 | Investor | 25% | 2,125 RON from 8,500 RON |

The shared `investmentBudget` rule is enforced by the API and displayed in the UI. Buying moves cash into holdings at cost, keeping the capital basis stable. Selling releases invested cost and updates cash. Deposits increase the limit; withdrawals decrease it. If a withdrawal leaves existing holdings above the new limit, further buys are blocked, but selling remains available. No forced sale occurs. Unrealized price changes do not change this cost-based demo budget. These percentages are configurable demo product rules, not financial recommendations. The existing database filename and browser account-selection key are preserved to keep local data intact.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run setup` | Install locked dependencies and create/seed the database |
| `npm run dev:all` | Start frontend and backend together |
| `npm run dev` | Start frontend only |
| `npm run backend` | Start backend only |
| `npm run db:seed` | Create/seed SQLite without overwriting existing accounts |
| `npm test` | Frontend and shared business-rule tests |
| `npm run test:backend` | API and SQLite integration tests |
| `npm run typecheck` | TypeScript checks |
| `npm run build` | Build the frontend application |

## Database and configuration

The database is created automatically at `backend/data/stagewise.sqlite` and is excluded from Git. Every developer gets their own local data.

- [`backend/schema.sql`](backend/schema.sql): database schema.
- [`backend/seed.sql`](backend/seed.sql): three dummy accounts; run schema first if using SQL directly.
- [`backend/README.md`](backend/README.md): API routes, storage design and details.

Optional backend environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `SQLITE_PATH` | `backend/data/stagewise.sqlite` | Alternative database file path |
| `PORT` | `3001` | Backend HTTP port (also used by the Vite proxy) |
| `FRONTEND_PORT` | `5173` | Website port for `dev:all` |

For example, on macOS/Linux run `PORT=3002 FRONTEND_PORT=5174 npm run dev:all` if the default ports are in use. When running the services separately, set the same `PORT` for both so the proxy reaches the correct API. `SQLITE_PATH` values that are relative resolve from the working directory. Seed reruns preserve existing changes; use the UI reset action for a fresh demo account.

## For development agents

Read [`AGENTS.md`](AGENTS.md) before making changes.

- Frontend API calls live in `src/services/mockApi.ts` (the filename is retained from the Lovable prototype).
- Backend routes live in `backend/server.mjs`; SQLite initialization lives in `backend/database.mjs`.
- Shared business rules live in `src/lib/demo-logic.ts`; tier/reward configuration lives in `src/config/demo.ts`.
- Learning content is initialized from `src/data/mock.ts` into SQLite. Runtime learning content is fetched from `/api/lessons`.
- Do not bypass server-side tier checks or treat client-supplied balances as authoritative.
- Do not commit local databases, environment secrets, `node_modules` or build output.
- Before handoff, run both test commands, typecheck and build. Keep `bun.lock` in sync with dependency changes.
- This project originated in Lovable. Preserve published Git history; do not force-push or rewrite it.

## Local demo versus deployment

The account selector is a demonstration tool, not production authentication. The API binds to localhost and all financial actions remain simulated. A production deployment needs authentication, appropriate financial integrations and API hosting/routing. `npm run build` does not deploy the SQLite backend, and the Vite API proxy only applies to local development.

## Stage-specific milestones

The Milestones and Next tier panels use the same shared rules. There is no fixed 1,000 or 5,000 RON gate: savings reserve = 3 × (10% of declared monthly income). Tier percentages for investing are unchanged.

- Tier 1 (3): three consecutive qualifying saving months, the income-based retained reserve, and two lessons. These are all required for server-side promotion to Tier 2.
- Tier 2 (5): retain the income-based reserve, complete four lessons, place a first trade, complete the 90-day tracking period, and complete a future Tier 3 eligibility review. The review stays Pending; returns alone do not grant promotion.
- Tier 3 (3 ongoing goals): meet this month's 10% saving target, retain the reserve, and complete the quarterly mastery challenge. These are ongoing goals, not requirements for a nonexistent Tier 4.

The separate three-deposit milestone is removed. Progress counts read “1 of 3 months,” avoiding duplicated units and incorrect singular forms.

## Tier 3 quarterly mastery

The third Tier 3 milestone links to a recurring challenge on Learn. The first enrolled calendar quarter uses the five foundation lessons (existing completions count). Subsequent quarters rotate three risk, fees and decision-making scenarios. Answers are verified by the API, saved in SQLite account state and scoped to the current Bucharest calendar quarter. New quarters do not erase lessons, financial history or previous reward records.

A proposed quarterly reward of **10% of declared monthly take-home income** (for example 500 RON for a 5,000 RON monthly income) requires the challenge, all three monthly saving targets in that calendar quarter, and the retained income-based reserve when eligibility is registered. Signup/income enrollment dates still exclude earlier deposits. This is not a return or trade-frequency competition. Partial first quarters may not qualify for the saving reward; future quarters provide a fresh opportunity.

The register action stores one **pending-funding** record per account/quarter, using the server's date and configured amount. It does **not** add cash, issue a payout, create a transfer or count as investment profit. No sponsor is committed; reward funding and actual payouts are not implemented. Future payout integration must recheck eligibility and funding before crediting anything.

Endpoints use the existing account-actions API: `mastery-answer` takes `quarterId`, `scenarioId`, `answer`; `mastery-reward` takes `quarterId`. Clients cannot choose the reward amount or qualify by sending a flag. No Tier 4 or company-funded investing is unlocked.

The quarterly bonus percentage is `quarterlyMastery.bonusIncomePercent` in `src/config/demo.ts` (currently 10; can be configured to 15 after a funding decision). It is paid per qualifying quarter, not monthly, and is calculated from one month's income, not three months' income or trading profits. For 5,000 RON income, required quarterly saving contributions are 1,500 RON; a proposed 500 RON bonus equals one third of those contributions. This needs a separate sponsor/company budget; it is not investment yield. Registered amounts are frozen with the income and policy snapshot; old 25 RON records are preserved rather than rewritten. No sponsor funds or payout integration exist yet.

## Presentation timeline

Run `npm run dev:all` to enable the local presentation timeline. On Overview, a compact **Demo timeline** strip shows the selected account's date and an **Advance 1 month** button. The control is deliberately separate from account and money actions.

The backend adds exactly one calendar month for that account, clamping month-end dates (31 January → 28/29 February). The destination time is noon in Bucharest to avoid DST gaps. It never adds money, transactions or lessons. Subsequent deposits/trades use the server's account clock; saving deadlines, streaks, quarterly challenges and promotions use the same time. The offset survives reloads and backend restarts. Other accounts remain unaffected.

Judge walkthrough: create an account with 5,000 RON income, complete two foundation lessons, deposit 500 RON, advance a month, deposit 500 RON, advance again, deposit 500 RON. The retained 1,500 RON and three-month streak promote the account to Tier 2. To show a reset, skip a month's deposit and advance into the following month. **Reset demo** also restores the real date along with the account's starting data.

`dev:all` sets `DEMO_MODE=true` unless you explicitly set it to `false`. A directly started backend defaults to controls disabled: use `DEMO_MODE=true npm run backend` for separate-terminal presentation runs on macOS/Linux. Without that server flag, the button is hidden and the advance endpoint returns 403. Never enable it against production or real financial data. Use a separate `SQLITE_PATH` for presentations if you want to isolate existing local data.

The timeline changes calendar time, not market prices: it does not create future quotes or automatically pass the Tier 2 → Tier 3 eligibility review.

## 90-day performance tracking

On Investment, a Tier 2 account with at least one holding can start a 90-day tracker. The backend records the opening cash, market-valued holdings, transaction IDs, fixed configured USD/RON rate and timestamped quotes. A tracking period is not a pass/fail assessment and never promotes the account.

- Account portfolio value includes **all account cash plus all held stocks**, including symbols outside the original catalogue. The percentage therefore measures the account portfolio, including idle cash; it is not a return on just the Tier 2 allocation.
- Gain/loss = latest account value − opening account value − deposits + withdrawals since the opening snapshot. Earlier price gains are excluded by marking opening holdings to market.
- The displayed return is a timestamp-weighted **Modified Dietz estimate**, adjusting the denominator for when external cash flows entered/left. It is labelled an estimate; it is not an exact time-weighted return. If its capital denominator is nonpositive, the return is unavailable. Method reference: [GIPS handbook](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/).
- Orders record symbol, quantity, side, actual RON price, quote timestamp, source, conversion rate and fees. The local paper-order model currently charges **zero fees**. Recorded fees are reflected through cash and not subtracted twice. Dividends, splits and other corporate actions are not reconciled yet, so this is price-based prototype tracking, not a production brokerage statement. Unknown new transaction types pause valuation rather than becoming apparent profit.
- Market-mode tracking requires timestamped Alpaca prices for every holding. Missing/fallback quotes, future timestamps, prices older than four calendar days or a changed configured FX rate pause refreshing and preserve the last valid snapshot. Four days accommodates many weekends/holidays but is a prototype freshness policy, not proof a market is open. Restore the opening FX rate before continuing an existing market tracker.
- Demo-mode trackers are explicitly labelled. They may use static fallback prices and the presentation clock, but advancing a month never generates future market prices.
- Snapshots are captured on opening and during Investment-page refreshes when values change or an hour has passed. The page refreshes every minute and after account actions; it also has a manual refresh. There is **no background scheduler** recording prices while the app is unattended. SQLite keeps snapshot history; the UI/API return the latest 20 for the current run.
- Once the window has ended, the last in-window snapshot is preserved. We do not apply today's quote to a past deadline. An exact closing historical valuation remains a future integration task; the panel clearly says closing data is pending. Returns never decide Tier 3 promotion. The separate readiness assessment uses the authoritative account clock (including presentation time only when server demo mode is enabled).
- `GET /api/accounts/:id/performance` refreshes/returns the report; account action `performance-start` opens a run. Existing idempotency keys prevent duplicate start snapshots. Reset demo clears the current run but preserves old SQLite snapshot records.

Alpaca requests run **outside** SQLite write transactions. The API re-reads account state before applying an order or recording a valuation; it rejects changed opening portfolios instead of overwriting concurrent cash movements.
