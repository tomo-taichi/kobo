-- Data migration support — preserve the legacy FileMaker customer number so the
-- import is idempotent (upsert on legacy_id) and later imports (orders → customer)
-- can resolve relationships by the old key. Nullable; app-created customers keep
-- legacy_id NULL. Partial unique index enforces one row per legacy key.
alter table public.customers add column if not exists legacy_id text;
-- Plain unique index: Postgres treats NULLs as distinct, so app-created customers
-- (legacy_id NULL) never collide, while imported rows stay one-per-legacy-key. A
-- plain (non-partial) index also lets the importer use ON CONFLICT (legacy_id).
create unique index if not exists customers_legacy_id_key
  on public.customers (legacy_id);
