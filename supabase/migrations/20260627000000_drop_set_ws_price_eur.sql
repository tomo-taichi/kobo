-- Product pricing model change: retail_price_eur is now entered manually (the
-- Order-adopted price). The old manual "Set WS Price" (retail = set_ws × retail_rate)
-- is removed; Retail (ref) = Ideal WS (EUR) × retail_rate is shown only as a suggestion.
-- set_ws_price_eur was added out-of-band (not in an earlier migration), hence IF EXISTS.
alter table public.products drop column if exists set_ws_price_eur;
