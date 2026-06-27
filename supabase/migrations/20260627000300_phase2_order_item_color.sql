-- Phase 2: order lines carry a colour. One order_item per (product, colour).

-- 1. Add the colour reference (nullable; backfilled below).
alter table public.order_items add column if not exists product_color_id uuid references public.product_colors(id);

-- 2. Backfill existing order_items: match each to the product's product_color whose
--    colour equals the product's original main_m_color, else the lowest sort_order.
update public.order_items oi
set product_color_id = sub.pc_id
from (
  select oi2.id as oi_id,
    coalesce(
      (select pc.id from public.product_colors pc
         join public.material_colors mc on mc.id = pc.material_color_id
        where pc.product_id = oi2.product_id and mc.color = p.main_m_color
        order by pc.sort_order limit 1),
      (select pc.id from public.product_colors pc
        where pc.product_id = oi2.product_id
        order by pc.sort_order limit 1)
    ) as pc_id
  from public.order_items oi2
  join public.products p on p.id = oi2.product_id
  where oi2.product_color_id is null
) sub
where oi.id = sub.oi_id and sub.pc_id is not null;

-- 3. Swap the uniqueness: a product may now appear once per colour in an order.
alter table public.order_items drop constraint if exists order_items_order_id_product_id_key;
create unique index if not exists order_items_order_color_key on public.order_items (order_id, product_color_id);
