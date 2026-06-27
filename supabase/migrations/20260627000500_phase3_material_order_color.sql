-- Phase 3: production fabric aggregation is per material COLOUR.
-- material_orders keyed by (material_color_id, season) instead of (material_id, season).
-- (Table is empty, so no backfill needed.)
alter table public.material_orders add column if not exists material_color_id uuid references public.material_colors(id);
alter table public.material_orders drop constraint if exists material_orders_material_id_season_id_key;
create unique index if not exists material_orders_color_season_key on public.material_orders (material_color_id, season_id);
