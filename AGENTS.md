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
- Demo tiers are assigned in SQLite, and tier 1 must be blocked from trading on the server as well as in the UI. See `backend/README.md` for setup and tests.
- Business rules are pure functions in `src/lib/demo-logic.ts`, tier/reward thresholds in `src/config/demo.ts` only; tested in `demo-logic.test.ts`.
- First-time setup: `npm run setup` (Node 22.18+, Bun 1.4.3). Run both services with `npm run dev:all`; stop with Ctrl+C.
- Before handoff run `npm test`, `npm run test:backend`, `npm run typecheck`, and `npm run build`. Never commit local SQLite files or secrets.
