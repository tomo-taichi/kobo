-- Data migration support — preserve legacy FileMaker product keys so imports are
-- idempotent and Orders can resolve product/colour by the old key.
-- products.legacy_id = representative id per (season+model+main material) group;
-- product_colors.legacy_id = the per-row FileMaker product PK (orders link here).
alter table public.products add column if not exists legacy_id text;
create unique index if not exists products_legacy_id_key on public.products (legacy_id);

alter table public.product_colors add column if not exists legacy_id text;
create unique index if not exists product_colors_legacy_id_key on public.product_colors (legacy_id);
