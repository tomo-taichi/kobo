-- ADR-0011 Phase 1 fix: a Model's category equals the Product's product_category
-- (canonical PRODUCT_CATEGORIES — Coat/Jacket/Bag/Watch/… — which is list-driven, not a
-- fixed DB enum). The dormant models table carried a stale lowercase category CHECK
-- (coat/jacket/shirt/… ) that rejects the real values. Drop it (category is validated in
-- the app layer, consistent with products.product_category which has no such CHECK).
alter table public.models drop constraint if exists models_category_check;
