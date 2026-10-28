# SQLite demo backend

Use Node.js 22.18+ (Node 24+ recommended). No additional backend packages are required: the API uses Node's HTTP server and built-in SQLite driver.

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

Tier 1 sees “You need a higher tier to invest” on the Investment page. Its buy and sell API requests receive HTTP 403. Tier 2 and tier 3 can place simulated orders, subject to cash, holdings and their percentage limits (10% for tier 2 and 25% for tier 3 of cash plus holdings at purchase cost, less capital already invested). All prices are fictional RON demo quotes, not currency conversions or live quotes.

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
- `POST /api/accounts/:id/actions`: `deposit`, `withdraw`, `trade`, `redeem`, `lesson` or `reset`, with a unique `requestId`.

Example body:

```json
{"action":"trade","symbol":"F","side":"buy","qty":"1","requestId":"example-order-001"}
```

The API ignores client-supplied balances and tiers and uses the account's stored data. Accounts are deliberately selectable without passwords for this local demonstration. This is not production authentication or brokerage: all deposits, withdrawals, orders and coupons remain simulated. Do not expose the API publicly with real account data. A deployed frontend will need a reachable backend and same-origin API routing; the Vite proxy applies to local development only.

## Verification

```sh
npm run test:backend
npm test
npx tsc --noEmit
npm run build
```

## Planned Tier 2 to Tier 3 evaluation

The configured product rule is a 90-calendar-day window with a +0.5% net investment-profit target. This supplements the existing Tier 3 balance and lesson requirements (the income-based savings reserve and four lessons); it does not replace them. The percentage is a provisional prototype assessment choice, not an evidence-based expected return.

The target applies to the investment allocation fixed at evaluation start, not the entire wallet. For example, a 350 RON starting allocation has a 1.75 RON net-profit target. An evaluation needs a positive starting allocation and at least one investment trade. Do not require frequent trading or liquidation just to pass.

Before activation, implement server-recorded start/end timestamps and the opening allocation, positions and prices. Measure changes in investment value including realized and unrealized P&L and fees; separate deposits, withdrawals, transfers and reward credits so they cannot create a pass. Existing positions must be valued at the start so older gains are not counted. Use the same RON valuation basis and time-consistent prices. Evaluate after the full window, using valid closing valuations; defer if prices are unavailable or stale. Recheck the existing balance and lesson requirements when evaluating promotion. A retry starts a new evaluation record without erasing money, positions, losses or history.

Automatic promotion remains **disabled**. The teammate's market-price integration and an evaluation engine are still pending; changing the configuration alone does not implement the assessment. No UI changes accompany this rule.

Research context: [Investor.gov](https://www.investor.gov/introduction-investing) discusses 7–10% annual historical estimates for long-term diversified US equity investing, rather than reliable weekly returns. [FCA research](https://www.fca.org.uk/publications/fca-research/research-note-digital-engagement-practices-trading-apps-experiment) found that certain engagement features can increase trading frequency and risk-taking. Neither source validates the chosen 0.5% assessment gate.
