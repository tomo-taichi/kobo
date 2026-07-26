-- ADR-0009 Phase 3 — production work-time logs.
-- One row per hours-of-work entry against a batch's stage by a named worker
-- (cutter/sewer/etc.). Hours are entered manually; the production hours page
-- aggregates them per worker. season_id is denormalised for season-scoped rollups.
create table if not exists public.production_time_logs (
  id          uuid primary key default uuid_generate_v4(),
  batch_id    uuid not null references public.production_batches(id) on delete cascade,
  season_id   uuid not null references public.seasons(id)            on delete cascade,
  stage       text not null check (stage in ('cut','sew','finish')),
  worker_name text not null,
  hours       numeric(6,2) not null default 0,
  work_date   date,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists production_time_logs_season_idx on public.production_time_logs (season_id);
create index if not exists production_time_logs_batch_idx  on public.production_time_logs (batch_id);
create index if not exists production_time_logs_worker_idx on public.production_time_logs (worker_name);

create or replace trigger set_updated_at before update on public.production_time_logs
  for each row execute function update_updated_at();

grant select, insert, update, delete on public.production_time_logs to anon, authenticated;
alter table public.production_time_logs enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='production_time_logs' and policyname='authenticated full access'
  ) then
    execute 'create policy "authenticated full access" on public.production_time_logs for all to authenticated using (true) with check (true)';
  end if;
end $$;
