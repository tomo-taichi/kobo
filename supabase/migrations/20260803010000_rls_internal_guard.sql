-- ADR-0010 Phase B2 — RLS guard: block client JWTs from brand/production tables.
-- The hard boundary is internal vs client, so the guard is is_internal() (NOT
-- is_brand() — production-only internal users must still read the tables). Client
-- users never query these tables directly; the portal reads via the service role
-- scoped to their customer_id. profiles keeps its "own profile only" policy so a
-- client can still read their own profile (login routing / middleware).
create or replace function public.is_internal() returns boolean
  language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.profiles where id = auth.uid() and user_type = 'internal');
  $$;

do $$
declare r record; affected text[]; t text;
begin
  -- every table currently exposed by a blanket (using true) policy — includes profiles.
  select array_agg(distinct tablename) into affected
    from pg_policies where schemaname = 'public' and qual = 'true';
  if affected is null then affected := array[]::text[]; end if;

  -- drop the blanket policies.
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and qual = 'true' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;

  -- replace with a single internal-only guard per table.
  foreach t in array affected loop
    execute format('drop policy if exists "internal only" on public.%I', t);
    execute format(
      'create policy "internal only" on public.%I for all to authenticated using (public.is_internal()) with check (public.is_internal())',
      t
    );
  end loop;
end $$;
