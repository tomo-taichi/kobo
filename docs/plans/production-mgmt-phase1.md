# ADR-0009 Production Management — Phase 1 (Data Foundation) plan

Status: **plan only, not implemented.** Decisions D1–D6 pending user confirmation before any migration is written. Supabase MCP currently disconnected → test on local (`supabase start`) or a preview branch first, then apply to prod.

Related: ADR-0009 (§6.1 "データ基盤"), ADR-0008 (Customer Portal, on hold).

## Reconciliation — most ADR-0009 "entities" already exist

| ADR-0009 entity | Reality |
|---|---|
| Material (per colour) | ✅ `materials` + `material_colors` (per-colour prices) |
| Supplier + material→supplier | ✅ `suppliers` + `materials.supplier_id` |
| MaterialOrder / Line | ✅ `material_orders` keyed by `(material_color_id, season_id)` — table built; its *page* is ADR Phase 2 |
| Product (Model) costs | ✅ `products.cutting_cost_jpy / sewing_cost_jpy / …` + presets `src/lib/presets.ts`, calc `src/lib/pricing.ts` |
| **ProductionBatch** | ❌ NEW. Closest: `production_progress` (`product_id × season_id`, 5 booleans) used by `seasons/[id]/production` |
| ProductionAssignment / FinishingTask | ❌ NEW — later phases (4–5) |

**Phase-1 real new work:** (1) ProductionBatch entity + order-line linkage; (2) cost→time change. Material/Supplier/MaterialOrder mostly already exist.

## Decisions — CONFIRMED (user, 2026-07-11)

- **D1 ✓ ProductionBatch grain:** one batch per `(season_id, product_color_id)` with ordered qty. Columns: `ordered_qty`, `priority`, `fabric_arrived`, `pattern_state` (new/print-needed/done), `cut_status`/`sew_status`/`fin_status` (Ready/Started/Finished). Finishing 6-steps = separate table, later.
- **D2 ✓ vs `production_progress`:** Phase 1 only ADDS `production_batches`; leave `production_progress` in place; Kanban page (Phase 3) switches over, then drop it.
- **D3 ✓ OrderLine link:** nullable `order_items.production_batch_id`, populated by `generateProductionBatches(seasonId)` grouping order lines by `product_color_id` (auto, idempotent).
- **D4 ✓ Which costs → time:** **ALL SIX** manufacturing items (cutting, sewing, knitting, thread, finish, packing) become time (minutes); amount = minutes/60 × rate.
- **D5 ✓ Labor rate:** `company_settings.labor_rate_jpy_per_hour` default 2000, single shared rate for all steps, editable in the UI.
- **D6 ✓ Existing cost data:** seed each `*_minutes ≈ round(cost_jpy / rate × 60)` as a starting estimate (not blank); staff correct to actuals.

## Step plan (ship order 1 → 2 → 3 → 4)

### Step 1 — `production_batches` table + order-line link (deps: none)
- **What:** migration: `production_batches(id, season_id, product_id, product_color_id, ordered_qty, priority int, fabric_arrived bool, pattern_state text, cut_status text, sew_status text, fin_status text, timestamps, unique(season_id, product_color_id))` + grants/RLS + `set_updated_at` trigger; `alter table order_items add column production_batch_id uuid references production_batches(id)`.
- **Data-impact check:** additive only; new column nullable; `select count(*) from production_batches` = 0.
- **Test (local):** apply; insert a batch; confirm unique + FK; brand app unaffected.
- **Rollback:** `alter table order_items drop column production_batch_id; drop table production_batches;`.

### Step 2 — batch generation action (deps: Step 1)
- **What:** `generateProductionBatches(seasonId)` — upsert one batch per distinct `product_color_id` in the season's order_items (summed qty), set `order_items.production_batch_id`. Idempotent.
- **Data-impact check:** batch count = distinct ordered product-colours; every order_item in season linked; qty totals reconcile.
- **Test (local):** 2 orders same colour → 1 batch combined; re-run → no dupes.
- **Rollback:** `update order_items set production_batch_id=null; delete from production_batches where season_id=…`.

### Step 3 — cost→time schema + labor rate (deps: none)
- **What:** add SIX `products.*_minutes` columns (`cutting_minutes, sewing_minutes, knitting_minutes, thread_minutes, finish_minutes, packing_minutes`) + `company_settings.labor_rate_jpy_per_hour default 2000`; backfill each = round(`*_cost_jpy`/2000*60). Keep the `*_cost_jpy` columns for now (kept in sync in Step 4).
- **Data-impact check:** spot-check backfill on a few products; no column dropped.
- **Test (local):** verify each minutes ≈ cost/2000*60; rate present = 2000.
- **Rollback:** drop the 6 minutes columns + rate column; originals intact.

### Step 4 — cost calc + form use time (deps: Step 3)
- **What:** `pricing.ts` computes each of the 6 amounts = minutes/60 × rate (sum = manufacturing cost); `presets.ts` presets become minute-based for all 6; `product-cost-form.tsx` inputs all 6 as **minutes**, shows the computed ¥ (read-only) + a total time; `product-costs.ts` writes `*_minutes` and recomputes/keeps `*_cost_jpy` in sync (so every existing reader keeps working); update `pricing.test.ts`.
- **Data-impact check:** existing product cost tab shows seeded minutes + ¥ ≈ old; `cost_jpy`/`cost_eur` stable; regenerate an OC → totals stable.
- **Test:** unit tests for time→amount; manual edit minutes → ¥ + cost_eur recompute; `npm run build`.
- **Rollback:** revert the 4 files; Step-3 columns stay unused (harmless).

## Not in Phase 1 (ADR §6)
Material-order page (P2), Kanban/Master List (P3), Stage pages + priority (P4), finishing 6-steps + tag (P5), invoice/shipment batch-split (P6), portal sync (P7).
