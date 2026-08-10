-- Client discount: the brand gives its B2B clients a fixed % off retail, so
-- Retail (ref) = Ideal WS ÷ (1 − discount). This is the DEFAULT for newly created
-- products; each product captures its own multiplier (products.retail_rate) at
-- creation, so changing this later does not alter existing products.
alter table public.company_settings
  add column if not exists client_discount_rate numeric not null default 0.65;

alter table public.company_settings drop constraint if exists company_settings_client_discount_check;
alter table public.company_settings
  add constraint company_settings_client_discount_check check (client_discount_rate >= 0 and client_discount_rate < 1);
