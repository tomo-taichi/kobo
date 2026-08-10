-- Client discount per SEASON (like the season's EUR rate). New products capture
-- their season's discount as products.retail_rate (multiplier = 1/(1−discount)) at
-- creation. The company_settings default remains a fallback.
alter table public.seasons
  add column if not exists client_discount_rate numeric not null default 0.65;

alter table public.seasons drop constraint if exists seasons_client_discount_check;
alter table public.seasons
  add constraint seasons_client_discount_check check (client_discount_rate >= 0 and client_discount_rate < 1);
