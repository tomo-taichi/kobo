-- ADR-0011 Phase 1: Model versioning foundation (ADDITIVE ONLY; no data moved yet).
-- Model identity = (name, category). Model Version = (model, season), one per season,
-- holding the SHARED recipe (non-main materials + 用尺 incl. lining, orderable sizes,
-- accessory composition) and the manufacturing-time TEMPLATE. Products link to a version.
-- Existing product columns are left in place (dual-write during transition); the ownership
-- move (read-from-version) and the backfill are separate, later steps.

-- Model identity: (name, category)
create unique index if not exists models_name_category_key on public.models (name, category);

-- sex now lives on the Product; the legacy models.gender is no longer required.
alter table public.models alter column gender drop not null;

-- Model-level default tags (copied into product_tags at product creation)
create table if not exists public.model_tags (
  model_id uuid not null references public.models(id) on delete cascade,
  tag text not null,
  primary key (model_id, tag)
);

-- Model Version: one per (model, season)
create table if not exists public.model_versions (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete restrict,
  season_id uuid not null references public.seasons(id) on delete restrict,
  status text not null default 'active' check (status in ('active','frozen','deprecated')),
  changelog text,
  orderable_sizes text[] not null default '{}',
  accessory_composition text,
  cutting_minutes  numeric not null default 0,
  sewing_minutes   numeric not null default 0,
  knitting_minutes numeric not null default 0,
  thread_minutes   numeric not null default 0,
  finish_minutes   numeric not null default 0,
  packing_minutes  numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (model_id, season_id)
);

-- Shared non-main materials + 用尺 (incl. lining). Main material stays on the Product.
create table if not exists public.model_version_materials (
  id uuid primary key default gen_random_uuid(),
  model_version_id uuid not null references public.model_versions(id) on delete cascade,
  role text not null check (role in ('lining','sleeve_lining','pocket_facing','pocket_bag','interfacing','accessories')),
  material_id uuid not null references public.materials(id) on delete restrict,
  material_color_id uuid references public.material_colors(id) on delete set null,
  usage_amount numeric not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists model_version_materials_version_idx on public.model_version_materials (model_version_id);

-- Product → Model Version (nullable during transition; set by backfill)
alter table public.products add column if not exists model_version_id uuid references public.model_versions(id) on delete set null;
create index if not exists products_model_version_idx on public.products (model_version_id);

-- RLS: internal-only (matches Brand data). New tables need RLS + policy + grants.
alter table public.model_versions          enable row level security;
alter table public.model_version_materials enable row level security;
alter table public.model_tags              enable row level security;
create policy model_versions_internal          on public.model_versions          using (is_internal()) with check (is_internal());
create policy model_version_materials_internal on public.model_version_materials using (is_internal()) with check (is_internal());
create policy model_tags_internal              on public.model_tags              using (is_internal()) with check (is_internal());
grant select, insert, update, delete on public.model_versions          to authenticated, service_role;
grant select, insert, update, delete on public.model_version_materials to authenticated, service_role;
grant select, insert, update, delete on public.model_tags              to authenticated, service_role;
