-- ADR-0009 Phase 1 / Step 1: ProductionBatch entity + order-line link.
--
-- A production batch = one (season × product × colour) with an ordered quantity — the unit
-- that pattern/cut/sew/finish progress is tracked against (decision D1). Additive only; the
-- existing production_progress table is left in place and retired later in Phase 3 (D2).
-- order_items gets a nullable link, populated by generateProductionBatches() in Step 2 (D3).
--
-- NOTE: product_color_id already implies its product and season (a product_color belongs to
-- one product, which belongs to one season), so it is effectively unique on its own; the
-- (season_id, product_color_id) unique key matches the D1 "season × product × colour" phrasing
-- and guards against duplicates. season_id/product_id are denormalised for convenient querying.

create table if not exists public.production_batches (
  id               uuid primary key default uuid_generate_v4(),
  season_id        uuid not null references public.seasons(id)        on delete cascade,
  product_id       uuid not null references public.products(id)       on delete cascade,
  product_color_id uuid not null references public.product_colors(id) on delete cascade,
  ordered_qty      integer not null default 0,
  priority         integer not null default 0,
  fabric_arrived   boolean not null default false,
  pattern_state    text    not null default 'new'   check (pattern_state in ('new','print_needed','done')),
  cut_status       text    not null default 'ready' check (cut_status  in ('ready','started','finished')),
  sew_status       text    not null default 'ready' check (sew_status  in ('ready','started','finished')),
  fin_status       text    not null default 'ready' check (fin_status  in ('ready','started','finished')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (season_id, product_color_id)
);
create index if not exists production_batches_season_id_idx        on public.production_batches (season_id);
create index if not exists production_batches_product_color_id_idx on public.production_batches (product_color_id);

create or replace trigger set_updated_at before update on public.production_batches
  for each row execute function update_updated_at();

-- Grants + RLS (mirror the current model: blanket authenticated access). ADR-0008 will later
-- switch these to using(is_brand()) when the Customer Portal isolation work resumes.
grant select, insert, update, delete on public.production_batches to anon, authenticated;
alter table public.production_batches enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='production_batches' and policyname='authenticated full access'
  ) then
    execute 'create policy "authenticated full access" on public.production_batches for all to authenticated using (true) with check (true)';
  end if;
end $$;

-- Order line → batch link (D3). Nullable; set by generateProductionBatches() (Step 2).
alter table public.order_items add column if not exists production_batch_id uuid references public.production_batches(id);
create index if not exists order_items_production_batch_id_idx on public.order_items (production_batch_id);
