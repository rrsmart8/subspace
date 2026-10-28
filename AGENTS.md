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
- Tiers are stored in SQLite; Tier 1 → 2 is server-promoted after 3 income-based saving months plus balance/lessons. Tier 3 evaluation remains disabled pending price integration, and tier 1 must be blocked from trading on the server as well as in the UI. See `backend/README.md` for setup and tests.
- Business rules are pure functions in `src/lib/demo-logic.ts`, tier/reward thresholds in `src/config/demo.ts` only; tested in `demo-logic.test.ts`.
- First-time setup: `npm run setup` (Node 22.18+, Bun 1.4.3). Run both services with `npm run dev:all`; stop with Ctrl+C.
- Before handoff run `npm test`, `npm run test:backend`, `npm run typecheck`, and `npm run build`. Never commit local SQLite files or secrets.

- Income saving rules use Europe/Bucharest calendar months and net confirmed deposits after enrollment. Never reset financial history when a streak breaks or accept client-supplied dates/tiers as qualification evidence.

- Tier 3 quarterly mastery rewards are unfunded eligibility records only. Never credit cash or treat a pending record as an investment return; scope answers and reward records by server calendar quarter.

- Demo clock controls require server `DEMO_MODE=true` (enabled by the combined local launcher). Use the selected account’s authoritative clock for transaction dates and qualification; never honor client-supplied dates or enable these controls for production data.
