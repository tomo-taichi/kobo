-- ADR-0009 Phase 3 (Settings) — manufacturing autofill presets.
-- Work-hours per manufacturing step × garment type, used by "Autofill" on the
-- product cost form. Stored as jsonb on the single company_settings row; managed
-- from Settings › Manufacturing Autofill. Seeded with the previous constants.
alter table public.company_settings
  add column if not exists manufacturing_hour_presets jsonb;

update public.company_settings set manufacturing_hour_presets = '{
  "cutting":  {"TSHIRT":0.25,"SHIRT":0.5,"TROUSERS":0.5,"JACKET":0.75,"COAT":1.0},
  "sewing":   {"TSHIRT":0.75,"SHIRT":2.0,"TROUSERS":3.0,"JACKET":4.0,"COAT":5.0},
  "knitting": {"TSHIRT":0.25,"SHIRT":0.5,"TROUSERS":0.5,"JACKET":0.75,"COAT":1.0},
  "thread":   {"TSHIRT":0.75,"SHIRT":2.0,"TROUSERS":3.0,"JACKET":4.0,"COAT":5.0},
  "finish":   {"TSHIRT":0.25,"SHIRT":0.5,"TROUSERS":0.5,"JACKET":0.75,"COAT":1.0},
  "packing":  {"TSHIRT":0.25,"SHIRT":0.5,"TROUSERS":0.5,"JACKET":0.75,"COAT":1.0}
}'::jsonb
where manufacturing_hour_presets is null;
