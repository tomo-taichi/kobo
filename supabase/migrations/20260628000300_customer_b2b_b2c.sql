-- Customer model re-org: B2B/B2C + explicit document language + VIP + per-customer
-- discount/deposit defaults + portal access. See ADR-0007. group_type is KEPT and
-- write-through for now; the PDF/pricing pass (Phase 2) migrates off it and drops it.
alter table public.customers
  add column if not exists customer_type          text check (customer_type in ('B2B','B2C')),
  add column if not exists language               text not null default 'en' check (language in ('en','ja')),
  add column if not exists is_vip                 boolean not null default false,
  add column if not exists default_discount_rate  numeric(5,4) not null default 0,
  add column if not exists default_deposit_rate   numeric(5,4) not null default 0.30,
  add column if not exists portal_access          boolean not null default false;

-- Backfill from legacy group_type + currency.
update public.customers set
  customer_type        = case when group_type in ('Domestic','Overseas') then 'B2B' else 'B2C' end,
  language             = case when currency = 'JPY' then 'ja' else 'en' end,
  default_deposit_rate = case when group_type in ('Domestic','Overseas') then 0.30 else 1.00 end,
  portal_access        = (group_type in ('Domestic','Overseas'))
where customer_type is null;

alter table public.customers alter column customer_type set not null;

-- Orders: drop the JPY+EUR dual-display option (no rows use it).
alter table public.orders drop constraint if exists orders_currency_type_check;
alter table public.orders add constraint orders_currency_type_check check (currency_type in ('EUR','JPY'));
