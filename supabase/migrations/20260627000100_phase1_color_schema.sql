-- Phase 1: per-color material pricing + per-color product pricing. Additive only
-- (new tables + nullable columns); nothing is dropped, so running code is unaffected.

-- 1. A material's available colors. set_price_jpy/unit_price_jpy are optional
--    per-color overrides; null = use the material's base price (special dyeing rarely differs).
create table if not exists public.material_colors (
  id             uuid primary key default uuid_generate_v4(),
  material_id    uuid not null references public.materials(id) on delete cascade,
  color          text not null,
  set_price_jpy  numeric(10,2),
  unit_price_jpy numeric(10,2),
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (material_id, color)
);
create index if not exists material_colors_material_id_idx on public.material_colors (material_id);

-- 2. A product's enabled MAIN-material colors (curated subset), each with its own
--    price stack. Manufacturing/usage/eur_rate stay on products (shared); only the
--    material prices and rates/retail differ per color.
create table if not exists public.product_colors (
  id                uuid primary key default uuid_generate_v4(),
  product_id        uuid not null references public.products(id) on delete cascade,
  material_color_id uuid not null references public.material_colors(id),
  material_cost_jpy numeric(10,2) not null default 0,
  cost_jpy          numeric(10,2) not null default 0,
  cost_eur          numeric(10,4) not null default 0,
  markup_rate       numeric(6,3)  not null default 3.0,
  wholesale_eur     numeric(10,4) not null default 0,
  retail_rate       numeric(6,3)  not null default 3.5,
  retail_price_eur  numeric(10,4) not null default 0,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (product_id, material_color_id)
);
create index if not exists product_colors_product_id_idx on public.product_colors (product_id);

-- 3. Non-main materials' pinned chosen color (auto-set when the material has one color;
--    stays put even if more colors are added later).
alter table public.product_materials add column if not exists material_color_id uuid references public.material_colors(id);
alter table public.products          add column if not exists lining_material_color_id uuid references public.material_colors(id);

-- 4. updated_at triggers (mirror existing tables)
create or replace trigger set_updated_at before update on public.material_colors
  for each row execute function update_updated_at();
create or replace trigger set_updated_at before update on public.product_colors
  for each row execute function update_updated_at();

-- 5. Grants + RLS (mirror existing public tables)
grant select, insert, update, delete on public.material_colors to anon, authenticated;
grant select, insert, update, delete on public.product_colors  to anon, authenticated;
alter table public.material_colors enable row level security;
alter table public.product_colors  enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='material_colors' and policyname='authenticated full access') then
    execute 'create policy "authenticated full access" on public.material_colors for all to authenticated using (true) with check (true)';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_colors' and policyname='authenticated full access') then
    execute 'create policy "authenticated full access" on public.product_colors for all to authenticated using (true) with check (true)';
  end if;
end $$;
