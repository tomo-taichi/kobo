-- ADR-0009 Phase 5 — free-text comment per batch on the Finishing page
-- (~200 chars, enforced in the UI).
alter table public.production_batches
  add column if not exists fin_comment text;
