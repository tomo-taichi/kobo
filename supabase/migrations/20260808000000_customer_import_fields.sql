-- Richer FileMaker customer export — fields the system didn't have yet.
--   contacts: array of the customer's people {name, jobTitle, email, mobile, phone}
--   billing_fax / shipping_fax: fax numbers
--   payment_terms: free-text payment terms (distinct from the deposit_terms enum)
--   shipping_terms: free-text shipping terms (e.g. "PORT OF SHIPMENT: TOKYO…")
alter table public.customers
  add column if not exists billing_fax    text,
  add column if not exists shipping_fax   text,
  add column if not exists payment_terms  text,
  add column if not exists shipping_terms text,
  add column if not exists contacts       jsonb not null default '[]'::jsonb;

-- Bank options seen in the import (customer.bank stores bank_key). WISE_EU and
-- Rakuten_JP already exist; add the rest so they show in the managed bank dropdown.
insert into public.banks (bank_key, label, sort_order, active) values
  ('WISE_USD',   'WISE USD',        3, true),
  ('RAKUTEN_EU', 'RAKUTEN EU',      4, true),
  ('KOJIN',      '個人 (Personal)', 5, true),
  ('KAISHA',     '会社 (Company)',  6, true)
on conflict (bank_key) do nothing;
