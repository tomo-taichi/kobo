-- ADR-0009 Phase 1 / Step 3 (decisions D4, D5, D6): manufacturing cost input becomes TIME.
--
-- Each of the 6 manufacturing steps gets a per-minute time field, plus a single shared labor
-- rate on company_settings (default ¥2000/hour, editable). The minutes are backfilled as an
-- ESTIMATE from the existing JPY amounts (minutes ≈ round(cost_jpy / rate × 60)); staff refine
-- them to actuals later. The *_cost_jpy columns are KEPT — Step 4 recomputes and keeps them in
-- sync from minutes, so every existing reader (cost totals, OC/invoice math) keeps working.

alter table public.products
  add column if not exists cutting_minutes  numeric(10,2) not null default 0,
  add column if not exists sewing_minutes   numeric(10,2) not null default 0,
  add column if not exists knitting_minutes numeric(10,2) not null default 0,
  add column if not exists thread_minutes   numeric(10,2) not null default 0,
  add column if not exists finish_minutes   numeric(10,2) not null default 0,
  add column if not exists packing_minutes  numeric(10,2) not null default 0;

alter table public.company_settings
  add column if not exists labor_rate_jpy_per_hour numeric(10,2) not null default 2000;

-- Backfill estimate. Uses the literal default rate 2000 (matches the column default just set);
-- exact for whole-hour multiples of the rate, otherwise a starting estimate for staff to correct.
update public.products set
  cutting_minutes  = round(cutting_cost_jpy  / 2000 * 60),
  sewing_minutes   = round(sewing_cost_jpy   / 2000 * 60),
  knitting_minutes = round(knitting_cost_jpy / 2000 * 60),
  thread_minutes   = round(thread_cost_jpy   / 2000 * 60),
  finish_minutes   = round(finish_cost_jpy   / 2000 * 60),
  packing_minutes  = round(packing_cost_jpy  / 2000 * 60);
