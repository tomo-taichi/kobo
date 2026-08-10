-- ADR-0011 Phase 1 fix: "one version per (model, season)" applies only to ACTIVE
-- versions. Historical/frozen versions may coexist within a season (the backfill
-- preserves real per-season variation as distinct frozen versions). So replace the
-- full unique constraint with a PARTIAL unique index scoped to status='active'.
alter table public.model_versions drop constraint if exists model_versions_model_id_season_id_key;
create unique index if not exists model_versions_active_one_per_season
  on public.model_versions (model_id, season_id) where status = 'active';
