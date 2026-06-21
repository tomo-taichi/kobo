-- 適格請求書発行事業者 登録番号 (T+13桁) / seller tax registration number, shown on invoices
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS registration_no text;
