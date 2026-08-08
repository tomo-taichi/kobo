-- Data migration support — preserve the legacy FileMaker supplier number so the
-- import is idempotent (upsert on legacy_id) and later imports (materials →
-- supplier) can resolve the relationship by the old key. Nullable; app-created
-- suppliers keep legacy_id NULL. Plain unique index (NULLs distinct).
alter table public.suppliers add column if not exists legacy_id text;
create unique index if not exists suppliers_legacy_id_key
  on public.suppliers (legacy_id);
