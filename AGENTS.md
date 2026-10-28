<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- All frontend data access goes through `src/services/mockApi.ts`, now an HTTP adapter for the SQLite API in `backend/server.mjs`. Run the API separately with `npm run backend`; Vite proxies `/api` to it.
- Tiers are stored in SQLite; Tier 1 → 2 is server-promoted after 3 income-based saving months plus balance/lessons. The 90-day portfolio tracker is available; Tier 3 promotes after 90 compliant investing days, three completed saving months, reserve and four lessons, and tier 1 must be blocked from trading on the server as well as in the UI. See `backend/README.md` for setup and tests.
- Business rules are pure functions in `src/lib/demo-logic.ts`, tier/reward thresholds in `src/config/demo.ts` only; tested in `demo-logic.test.ts`.
- First-time setup: `npm run setup` (Node 22.18+, Bun 1.4.3). Run both services with `npm run dev:all`; stop with Ctrl+C.
- Before handoff run `npm test`, `npm run test:backend`, `npm run test:chatbot`, `npm run typecheck`, and `npm run build`. Never commit local SQLite files or secrets.

- The Tier 3 investment assistant lives in `backend/chatbot/`: the system prompt in `system_prompt.md`, the Featherless tool loop in `chat.mjs`, and a read-only Python FastMCP Alpaca server in `mcp_server/` (managed with uv, spawned over stdio). Enforce Tier 3 on the server from the stored tier. Chat history lives only in the browser, so accept only user/assistant text from clients. MCP tools must stay read-only, with no orders or account access.

- Income saving rules use Europe/Bucharest calendar months and net confirmed deposits after enrollment. Never reset financial history when a streak breaks or accept client-supplied dates/tiers as qualification evidence.

- Tier 3 quarterly mastery rewards are unfunded eligibility records only. Never credit cash or treat a pending record as an investment return; scope answers and reward records by server calendar quarter.

- Demo clock controls require server `DEMO_MODE=true` (enabled by the combined local launcher). Use the selected account’s authoritative clock for transaction dates and qualification; never honor client-supplied dates or enable these controls for production data.

- Performance tracking must exclude deposits/withdrawals from P&L, retain last-valid values on quote failures, and never promote based on profit. Readiness is maintained by promoteTiers on all account reads/actions; never backdate assessment enrollment or accept client qualification evidence. Do not await market-data requests inside SQLite write transactions. Read the tracking limitations in README.md before extending it.
