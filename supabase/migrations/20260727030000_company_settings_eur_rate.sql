-- ADR-0009 Phase 3 (Settings) — global default EUR rate for product cost calc.
-- Used as the fallback rate on the product cost form when a product has no
-- cost_eur_rate of its own. Managed from the Settings › Pricing section.
alter table public.company_settings
  add column if not exists cost_eur_rate_default numeric(10,2) default 130;
