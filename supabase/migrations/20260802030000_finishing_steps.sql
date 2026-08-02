-- ADR-0009 Phase 5 — finishing 6-step checklist per production batch.
-- Tape / Button / Buttonhole / Hand-sew / Wash / Tag. Each is an independent
-- completion flag (not all steps apply to every product; unused ones stay off).
-- Independent of fin_status (the coarse Finish stage state).
alter table public.production_batches
  add column if not exists fin_tape       boolean not null default false,
  add column if not exists fin_button     boolean not null default false,
  add column if not exists fin_buttonhole boolean not null default false,
  add column if not exists fin_handsew    boolean not null default false,
  add column if not exists fin_wash       boolean not null default false,
  add column if not exists fin_tag        boolean not null default false;
