-- Supplier Item Code: the code the supplier uses for this material (their SKU).
-- Optional free-text field shown in Material Info. Imported from the FileMaker
-- "Sup item code" column (previously stored inside notes as "Sup code: ...").
alter table public.materials add column if not exists supplier_item_code text;
