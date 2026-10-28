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

Tier 1 sees “You need a higher tier to invest.” Both the UI and API enforce this restriction. Tiers 2 and 3 can trade within their demo allowances. Tiers are assigned database attributes in this version; completing milestones does not automatically promote an account.

Balances, transactions, holdings, coupon codes and learning progress persist in SQLite. The browser remembers only the selected account. **Reset demo** restores the selected account's initial data; it does not reset the other accounts.

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
