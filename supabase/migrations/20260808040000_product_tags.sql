-- Product tags: a many-to-many label system for products (search/filter). The tag
-- vocabulary is managed in Settings via list_options domain 'product_tag'; applied
-- tags live in product_tags (tag = the list_options value, text).
create table if not exists public.product_tags (
  product_id uuid not null references public.products(id) on delete cascade,
  tag        text not null,
  created_at timestamptz not null default now(),
  primary key (product_id, tag)
);
create index if not exists product_tags_tag_idx on public.product_tags (tag);

-- Seed the initial managed tag vocabulary (idempotent).
insert into public.list_options (domain, value, sort_order, active)
select 'product_tag', v.value, v.ord, true
from (values
  ('定番All', 0), ('定番SS', 1), ('定番AW', 2),
  ('COIN', 3), ('ANGLE', 4), ('DISPLACEMENT', 5),
  ('MOMENT', 6), ('ORIGAMI', 7), ('PLUS', 8)
) as v(value, ord)
where not exists (
  select 1 from public.list_options lo where lo.domain = 'product_tag' and lo.value = v.value
);
