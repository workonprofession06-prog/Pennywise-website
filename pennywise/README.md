# Pennywise — Your Personal Finance Workspace
A calm, editorial personal-finance tracker in plain HTML, CSS and JavaScript. No build step, no dependencies.

## Run
Open `index.html` in a browser, or use VS Code's Live Server. Data persists in `localStorage`.

## Files
- `index.html` — semantic shell, native `<dialog>` modals, static filter/budget/settings forms
- `styles.css` — design tokens (CSS custom properties), responsive layout (bottom nav under 768px), reduced-motion support
- `app.js` — state + persistence, derived-data functions, SVG charts, views, event handling

## Features
Overview dashboard, transactions (add/edit/delete, search, type/category/date filters, sorting), per-category budgets (ok / near limit / over), insights (6-month trends, category comparison, savings rate), settings (name, currency, overall budget, reset).

## Technical decisions
- One `state` object; `commit()` saves to localStorage then re-renders, so every number comes from the same transactions.
- DOM is built with `createElement`/`textContent` (helper `h`), so user text is never parsed as HTML.
- Charts are hand-built SVG with `aria-label` summaries; they handle empty/zero data.
- Native `<dialog>` gives focus trapping and Escape-to-close.
- Corrupt localStorage falls back to fresh demo data.

## Limitations
Local-only demo; no bank connections, accounts or financial advice. Single-user, no import/export, no recurring transactions. Currency change relabels amounts, it does not convert them.

## Interview demo script
1. Overview: point out every figure derives from the transactions. 2. Add a large Food expense: watch the donut, insight and budget update. 3. Filter + search + sort together. 4. Reload to show persistence. 5. Walk through `h()` helper and `commit()` as the architecture.
