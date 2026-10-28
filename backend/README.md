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

Tier 1 sees “You need a higher tier to invest” on the Investment page. Its buy and sell API requests receive HTTP 403. Tier 2 and tier 3 can place simulated orders, subject to cash, holdings and their existing investment allowances (250 RON and 2,000 RON). All prices are fictional RON demo quotes, not currency conversions or live quotes.

## Database and SQL scripts

- `schema.sql` creates accounts, learning content and processed-request records.
- `seed.sql` populates the three accounts, their assigned tiers, fictional profiles and starting histories. Run schema first if executing SQL manually.
- `npm run db:seed` runs both scripts and loads the lesson catalogue into SQLite.
- The API also initializes the database automatically when first started.
- The default database is `backend/data/stagewise.sqlite`, excluded from version control.
- Set `SQLITE_PATH` to use a different database path. `PORT` changes the backend port; set the same value for Vite when starting the services separately.

Seed reruns preserve existing accounts. **Reset demo** resets only the selected account to its seed balance, tier, lessons and history. Tiers are explicitly stored account attributes in this version; deposits and lesson completion do not automatically grant a new tier. Milestones display progress, while promotion policy remains a backend extension.

Money is stored as integer bani in the account balance. Holdings, history, lesson completion and coupon codes are stored in the account's JSON state. Learning content has its own SQLite table. Each mutation reads the current database state, validates it using the shared business rules, and writes inside a transaction. Request IDs prevent applying the same submitted request twice. Lesson answers are checked on the server.

## Endpoints

- `GET /api/accounts`: list the three selectable demo accounts.
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
