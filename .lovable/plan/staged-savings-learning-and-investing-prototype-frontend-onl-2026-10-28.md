# Staged savings, learning and investing prototype (frontend only)

Four pages — Overview, Account, Investment, Learn — on mock data, saved in the browser, with a reset-demo action. No backend, payments or live trades. Everything money-related is marked "Simulated".

## Look
Console style (dark graphite, hairline panels, Host Grotesk for text, Atkinson Hyperlegible Mono for figures, IDs and dates). Amber marks the user's actions and the main button; cool blue marks system readings (prices, balances). Green and red only for in/out and status.

## Navigation
Top bar with exactly four links, active one highlighted; collapses into a menu on mobile. A "Simulated demo" chip and a "Reset demo" button (with confirmation).

## Pages
1. **Overview** — account holder, fictional account number, cash and investment value shown large, current tier, milestone list (passed / not passed with progress bars), "To reach next tier" checklist.
2. **Account** — account number + balance; transaction table (date, description, amount, in/out, status; empty state); Deposit / Withdraw buttons open a side panel (full-screen on mobile) with amount, confirm, cancel. Rejects empty, non-numeric, zero, negative, and withdrawals over cash; shows a spinner and blocks double submit. Rewards grid of fictional providers (logo placeholder, title, description, Redeem). Redeeming reveals a sample coupon code that stays the same afterwards; locked rewards say why.
3. **Investment** — search by name or symbol over ~15 mock stocks, results list, selected stock summary with simulated price and shares owned. Buy / Sell open an order panel: quantity, estimated total, confirm/cancel. Checks whole positive shares, available cash, tier investment allowance, shares owned. Trading disabled with explanation on tiers that don't allow it. Successful trades update cash, holdings and history.
4. **Learn** — current tier, milestones, learning cards (locked / available / completed). Card opens a panel with lesson text and a quiz question; feedback, retry, and marks complete on correct answer, updating the learning milestone everywhere. Provider eligibility shown as a separate simulated status, never auto-unlocked by lessons.

## Panels
Shared drawer/dialog: visible close button, Esc to close, focus moves in on open and returns on close, labelled inputs.

## Technical details
- `src/config/demo.ts`: single config object with tier thresholds, allowances, reward eligibility rules.
- `src/services/mockApi.ts`: async functions (getAccount, deposit, withdraw, trade, redeemReward, completeActivity, reset) with small delay — the future swap point for real API calls.
- `src/state/DemoStore.tsx`: React context + reducer, persisted to localStorage (read in useEffect to avoid hydration mismatch). Tier and milestones derived from state.
- Routes: `index.tsx` (Overview), `account.tsx`, `investment.tsx`, `learn.tsx`, each with its own head metadata; nav in `__root.tsx`.
- Design tokens in `src/styles.css`, fonts linked in root head; shadcn Sheet/Dialog for panels.
- Vitest tests for validation rules (deposit/withdraw amounts, trade checks, coupon issued once, tier calculation).
