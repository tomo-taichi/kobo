-- ADR-0010 Phase B1 — user functions on profiles.
-- user_type is the hard security boundary (internal vs client). Internal users
-- carry the Brand/Production/admin function flags; client users link 1:many to a
-- customer. Additive only. Seeds the existing auth user(s) as internal admins so
-- they keep full access before the is_brand() RLS switch (B2).
alter table public.profiles
  add column if not exists user_type        text    not null default 'internal' check (user_type in ('internal','client')),
  add column if not exists is_brand          boolean not null default false,
  add column if not exists is_production     boolean not null default false,
  add column if not exists can_create_users  boolean not null default false,
  add column if not exists customer_id       uuid    references public.customers(id) on delete set null;

insert into public.profiles (id, display_name, user_type, is_brand, is_production, can_create_users)
select u.id, coalesce(u.email, 'Admin'), 'internal', true, true, true
  from auth.users u
  where not exists (select 1 from public.profiles p where p.id = u.id);
