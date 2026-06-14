@AGENTS.md

## Project-specific rules

### Middleware
This project uses Next.js 16. Middleware is handled by `src/proxy.ts` — do NOT create `src/middleware.ts`. Creating `middleware.ts` will conflict with `proxy.ts` and break authentication.

### Product category names
The canonical product category for accessories is **"Accessories"** (plural). Do NOT use "Accessory". This is defined in `src/lib/product-constants.ts` (`PRODUCT_CATEGORIES`).

## Agent skills

### Issue tracker

Issues live in GitHub Issues (via `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` at repo root + `docs/adr/`. See `docs/agents/domain.md`.
