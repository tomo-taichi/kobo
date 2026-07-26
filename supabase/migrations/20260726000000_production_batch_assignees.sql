-- ADR-0009 Phase 3 — production batch assignees.
-- Cutter / sewer assignment for the Kanban board (free-text names for now;
-- may be promoted to a workers master table later). Nullable, no default.
alter table public.production_batches
  add column if not exists cutter_name text,
  add column if not exists sewer_name text;
