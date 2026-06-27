-- Per-product orderable sizes (subset of order-constants SIZES). Chosen at product
-- registration, defaulting from category (apparel → 1–10, accessories → Free).
-- null = all sizes orderable — the backward-compatible default for products created
-- before this column existed.
alter table public.products add column if not exists orderable_sizes text[];
