-- KOBO v5.0 Schema
-- Fashion brand management system for taichimurakami
-- Replaces initial 8-table schema with full 14-table design

-- ============================================================
-- DROP OLD TABLES (safe if not yet applied)
-- ============================================================

drop table if exists order_items cascade;
drop table if exists orders cascade;
drop table if exists product_materials cascade;
drop table if exists products cascade;
drop table if exists materials cascade;
drop table if exists customers cascade;
drop table if exists seasons cascade;
drop table if exists suppliers cascade;

-- ============================================================
-- EXTENSIONS
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- HELPER: updated_at trigger
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- MASTER TABLES
-- ============================================================

-- Seasons: e.g. "26.2", "14AW", "ALLSS", "委託"
create table seasons (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Suppliers: fabric / accessory material vendors
create table suppliers (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  contact    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Models: garment archetypes (category + gender)
create table models (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  category   text not null check (category in (
               'coat','jacket','shirt','trousers','tshirt',
               'knit','dress','skirt','pants','vest','other'
             )),
  gender     text not null check (gender in ('men','women','unisex')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Materials: Fabric (woven/knitted/leather) + Accessory Material (accessory/eyewear/other)
create table materials (
  id             uuid primary key default uuid_generate_v4(),
  name           text not null,
  category       text not null check (category in (
                   'woven','knitted','leather',
                   'accessory','eyewear','other'
                 )),
  unit_price_jpy numeric(10,2) not null default 0,
  unit_type      text not null check (unit_type in ('meter','piece','ds')),
  supplier_id    uuid references suppliers(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Composition options: selectable half-width katakana + English
-- e.g. "ｶｼﾐｱ-cashmere 100%", "ｳｰﾙ-wool 80% ﾅｲﾛﾝ-nylon 20%"
create table composition_options (
  id         uuid primary key default uuid_generate_v4(),
  label      text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Customers: B2B (Domestic/Overseas), B2C (Customer), Personal
create table customers (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  group_type    text not null check (group_type in (
                  'Domestic','Overseas','Personal','Customer'
                )),
  deposit_terms text not null default 'Deposit_and_Production'
                  check (deposit_terms in (
                    'Deposit_and_Production','Production_Only'
                  )),
  email         text,
  phone         text,
  address       text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- PRODUCTS
-- ============================================================

create table products (
  id                   uuid primary key default uuid_generate_v4(),
  season_id            uuid not null references seasons(id),
  model_id             uuid not null references models(id),
  name                 text not null,
  product_number       text,
  color                text,
  is_sample            boolean not null default false,
  is_invalid           boolean not null default false,
  duplicated_from      uuid references products(id),  -- history only, no ongoing sync
  cleaning_instruction text check (cleaning_instruction in ('A','B','C','D','E','NA')),

  -- Composition (up to 5, selectable from composition_options)
  composition_a        text,
  composition_b        text,
  composition_c        text,
  composition_d        text,
  composition_e        text,

  -- Cost inputs (JPY)
  cost_eur_rate        numeric(8,2)  not null default 130,  -- JPY per 1 EUR, default 130
  cutting_cost_jpy     numeric(10,2) not null default 0,
  sewing_cost_jpy      numeric(10,2) not null default 0,
  knitting_cost_jpy    numeric(10,2) not null default 0,
  thread_cost_jpy      numeric(10,2) not null default 0,
  finish_cost_jpy      numeric(10,2) not null default 0,
  packing_cost_jpy     numeric(10,2) not null default 0,

  -- Cost totals (auto-calculated, stored)
  material_cost_jpy    numeric(10,2) not null default 0,  -- sum(unit_price * usage) from product_materials
  cost_jpy             numeric(10,2) not null default 0,  -- material_cost + all manufacturing costs
  cost_eur             numeric(10,4) not null default 0,  -- cost_jpy / cost_eur_rate

  -- Pricing (EUR, auto-calculated, stored)
  markup_rate          numeric(6,3)  not null default 3.0,
  wholesale_eur        numeric(10,4) not null default 0,  -- cost_eur * markup_rate (ideal WS, reference only)
  retail_rate          numeric(6,3)  not null default 3.5,
  retail_price_eur     numeric(10,4) not null default 0,  -- cost_eur * retail_rate

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Product ↔ Material junction
-- Fabric (woven/knitted/leather) → fabric groups only
-- Accessory Material (accessory/eyewear/other) → accessory groups only
-- See ADR 0001
create table product_materials (
  id             uuid primary key default uuid_generate_v4(),
  product_id     uuid not null references products(id) on delete cascade,
  material_id    uuid not null references materials(id),
  material_group text not null check (material_group in (
                   'main','lining','body_lining','sleeve_lining',
                   'pocket_front','pocket_back','interlining',
                   'accessory_parts','accessory_tag'
                 )),
  usage_amount   numeric(10,4) not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Production progress per product × season (5 ordered stages)
create table production_progress (
  id           uuid primary key default uuid_generate_v4(),
  product_id   uuid not null references products(id) on delete cascade,
  season_id    uuid not null references seasons(id),
  pattern_done boolean not null default false,
  cut_done     boolean not null default false,
  sew_done     boolean not null default false,
  fin_done     boolean not null default false,
  ready_done   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (product_id, season_id)
);

-- ============================================================
-- ORDERS
-- ============================================================

create table orders (
  id                 uuid primary key default uuid_generate_v4(),
  customer_id        uuid not null references customers(id),
  season_id          uuid not null references seasons(id),
  order_date         date,

  -- Lifecycle: A=OC sent → B=OC approved → C=deposit paid → D=final invoice sent
  --            → E=full payment confirmed → F=commercial invoice issued (= shipped)
  status             text not null default 'A'
                       check (status in ('A','B','C','D','E','F')),

  invoice_type       text not null default 'Original'
                       check (invoice_type in (
                         'Original','Additional','委託','Revised','Copy','Not_in_Use'
                       )),
  currency_type      text not null default 'EUR'
                       check (currency_type in ('EUR','JPY','JPY+EUR')),
  exchange_rate      numeric(8,2),               -- JPY per 1 EUR, manual input

  -- Pricing: all amounts based on retail_price_eur * qty, then discount applied
  discount_rate      numeric(5,4) not null default 0,    -- fraction off retail, e.g. 0.35

  -- Deposit: default 30%, floor to nearest 10 JPY / 1 EUR (see ADR 0003)
  deposit_rate       numeric(5,4) not null default 0.30,
  deposit_amount_eur numeric(12,2),
  deposit_amount_jpy numeric(12,0),

  -- Split invoice counter: incremented each time a Final Invoice batch is issued
  invoice_count      integer not null default 0,

  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- One row per product per order
create table order_items (
  id                     uuid primary key default uuid_generate_v4(),
  order_id               uuid not null references orders(id) on delete cascade,
  product_id             uuid not null references products(id),

  -- Price snapshots taken at order creation time
  wholesale_price_eur    numeric(10,4),  -- products.wholesale_eur snapshot (OC reference only)
  retail_price_eur       numeric(10,4),  -- products.retail_price_eur snapshot
  -- Actual per-item invoice price (see ADR 0002)
  customer_wholesale_eur numeric(10,4),  -- retail_price_eur * (1 - discount_rate)

  -- Split invoice flags (independent: invoicing and shipping may occur at different times)
  is_flagged_invoice     boolean not null default false,  -- include in next Final Invoice batch
  is_flagged_delivery    boolean not null default false,  -- include in next Commercial Invoice batch

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (order_id, product_id)
);

-- Size breakdown per order item (size grid input)
create table order_item_sizes (
  id            uuid primary key default uuid_generate_v4(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  size          text not null check (size in (
                  '1','2','3','4','5','6','7','8','9','10','Free'
                )),
  quantity      integer not null default 0 check (quantity >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (order_item_id, size)
);

-- ============================================================
-- MATERIAL ORDERS
-- ============================================================

-- Season-level fabric ordering management
create table material_orders (
  id               uuid primary key default uuid_generate_v4(),
  material_id      uuid not null references materials(id),
  season_id        uuid not null references seasons(id),
  total_usage      numeric(12,4) not null default 0,  -- auto-calculated from product_materials × ordered quantities
  sample_remaining numeric(12,4) not null default 0,  -- manual: sample stock not entering production
  order_qty        numeric(12,4) not null default 0,   -- manual: final order quantity with rounding
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (material_id, season_id)
);

-- ============================================================
-- USER PROFILES (extends Supabase Auth)
-- ============================================================

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index on materials (supplier_id);
create index on materials (category);
create index on products (season_id);
create index on products (model_id);
create index on products (is_invalid);
create index on products (is_sample);
create index on product_materials (product_id);
create index on product_materials (material_id);
create index on production_progress (season_id);
create index on orders (customer_id);
create index on orders (season_id);
create index on orders (status);
create index on order_items (order_id);
create index on order_items (product_id);
create index on order_item_sizes (order_item_id);
create index on material_orders (material_id);
create index on material_orders (season_id);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

create trigger set_updated_at before update on seasons
  for each row execute function update_updated_at();
create trigger set_updated_at before update on suppliers
  for each row execute function update_updated_at();
create trigger set_updated_at before update on models
  for each row execute function update_updated_at();
create trigger set_updated_at before update on materials
  for each row execute function update_updated_at();
create trigger set_updated_at before update on customers
  for each row execute function update_updated_at();
create trigger set_updated_at before update on products
  for each row execute function update_updated_at();
create trigger set_updated_at before update on product_materials
  for each row execute function update_updated_at();
create trigger set_updated_at before update on production_progress
  for each row execute function update_updated_at();
create trigger set_updated_at before update on orders
  for each row execute function update_updated_at();
create trigger set_updated_at before update on order_items
  for each row execute function update_updated_at();
create trigger set_updated_at before update on order_item_sizes
  for each row execute function update_updated_at();
create trigger set_updated_at before update on material_orders
  for each row execute function update_updated_at();
create trigger set_updated_at before update on profiles
  for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table seasons             enable row level security;
alter table suppliers           enable row level security;
alter table models              enable row level security;
alter table materials           enable row level security;
alter table composition_options enable row level security;
alter table customers           enable row level security;
alter table products            enable row level security;
alter table product_materials   enable row level security;
alter table production_progress enable row level security;
alter table orders              enable row level security;
alter table order_items         enable row level security;
alter table order_item_sizes    enable row level security;
alter table material_orders     enable row level security;
alter table profiles            enable row level security;

-- Internal tool: all authenticated users have full access to all tables
create policy "authenticated full access" on seasons
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on suppliers
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on models
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on materials
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on composition_options
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on customers
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on products
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on product_materials
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on production_progress
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on orders
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on order_items
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on order_item_sizes
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on material_orders
  for all to authenticated using (true) with check (true);
-- Users can only access their own profile
create policy "own profile only" on profiles
  for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);
