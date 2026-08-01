-- ADR-0009 Phase 3 (Settings) — customer bank list + payment details.
-- Replaces the two hard-coded banks (company_settings.bank_wise_eu / bank_rakuten_jp)
-- with a managed list. customers.bank stores a bank_key; invoices print the matching
-- bank's `details`. Seeded from the existing two so invoice output is unchanged.
create table if not exists public.banks (
  id         uuid primary key default uuid_generate_v4(),
  bank_key   text not null unique,
  label      text not null,
  details    text,
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists banks_sort_idx on public.banks (sort_order);

create or replace trigger set_updated_at before update on public.banks
  for each row execute function update_updated_at();

grant select, insert, update, delete on public.banks to anon, authenticated;
alter table public.banks enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='banks' and policyname='authenticated full access'
  ) then
    execute 'create policy "authenticated full access" on public.banks for all to authenticated using (true) with check (true)';
  end if;
end $$;

-- Seed the existing two banks from company_settings (keeps customers.bank keys valid).
insert into public.banks (bank_key, label, details, sort_order)
select 'WISE_EU', 'WISE EU', bank_wise_eu, 0
  from public.company_settings where bank_wise_eu is not null and bank_wise_eu <> ''
union all
select 'Rakuten_JP', 'Rakuten JP', bank_rakuten_jp, 1
  from public.company_settings where bank_rakuten_jp is not null and bank_rakuten_jp <> ''
on conflict (bank_key) do nothing;
