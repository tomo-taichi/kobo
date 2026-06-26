-- Phase 1 seed: migrate existing single-color data into the new per-color tables.

-- 1. One material_colors row per material from its current color (base price = null → use material base).
insert into public.material_colors (material_id, color, sort_order)
select id, color, 0
from public.materials
where color is not null and btrim(color) <> ''
on conflict (material_id, color) do nothing;

-- 2. One product_colors row per product = the main material's (single) seeded color,
--    carrying the product's current price stack.
insert into public.product_colors
  (product_id, material_color_id, material_cost_jpy, cost_jpy, cost_eur, markup_rate, wholesale_eur, retail_rate, retail_price_eur, sort_order)
select p.id, mc.id, p.material_cost_jpy, p.cost_jpy, p.cost_eur, p.markup_rate, p.wholesale_eur, p.retail_rate, p.retail_price_eur, 0
from public.products p
join public.material_colors mc on mc.material_id = p.main_material_id
where p.main_material_id is not null
on conflict (product_id, material_color_id) do nothing;

-- 3. Pin each product_material (incl. lining/additional) to its material's single seeded color.
update public.product_materials pm
set material_color_id = mc.id
from public.material_colors mc
where mc.material_id = pm.material_id
  and pm.material_color_id is null;

-- 4. Pin the denormalized lining color.
update public.products p
set lining_material_color_id = mc.id
from public.material_colors mc
where mc.material_id = p.lining_material_id
  and p.lining_material_id is not null
  and p.lining_material_color_id is null;
