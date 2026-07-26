-- ADR-0009 Phase 3 (Settings) — generic managed select-lists.
-- One row per option within a named domain (e.g. 'cutter', 'sewer',
-- 'supplier_country', 'material_category', 'material_unit', 'product_category',
-- 'product_sex', ...). Brand users manage these from the Settings screen; forms
-- and the Kanban read their dropdown choices from here.
create table if not exists public.list_options (
  id         uuid primary key default uuid_generate_v4(),
  domain     text not null,
  value      text not null,
  label      text,
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (domain, value)
);
create index if not exists list_options_domain_idx on public.list_options (domain, sort_order);

create or replace trigger set_updated_at before update on public.list_options
  for each row execute function update_updated_at();

-- Grants + RLS (blanket authenticated, mirroring the current model). ADR-0008 will
-- later switch these to using(is_brand()) when Customer Portal isolation resumes.
grant select, insert, update, delete on public.list_options to anon, authenticated;
alter table public.list_options enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='list_options' and policyname='authenticated full access'
  ) then
    execute 'create policy "authenticated full access" on public.list_options for all to authenticated using (true) with check (true)';
  end if;
end $$;
