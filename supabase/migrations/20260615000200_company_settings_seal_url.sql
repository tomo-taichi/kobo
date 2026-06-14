-- Optional company seal (角印) image URL, shown on the Japanese 納品書 (Delivery Note)
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS seal_url text;
