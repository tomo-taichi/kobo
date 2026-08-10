-- ADR-0011 Phase 2 (schema micro-add; ADDITIVE ONLY, no data moved).
-- (1) models.archived — soft-archive flag for the Models list bulk-action bar
--     (list-page default spec: checkboxes + bulk Delete/Archive). Adding a column with a
--     non-volatile default is a metadata-only change in PG11+ (no table rewrite on the 714 rows).
-- (2) model_versions.set_updated_at trigger — Phase 1 created model_versions with an updated_at
--     column but no trigger; attach the shared update_updated_at() so edits bump it, matching
--     every other master table (seasons/suppliers/models/materials/products/...).

alter table public.models add column if not exists archived boolean not null default false;

drop trigger if exists set_updated_at on public.model_versions;
create trigger set_updated_at before update on public.model_versions
  for each row execute function update_updated_at();
