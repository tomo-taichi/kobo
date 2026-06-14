-- Company settings table (single-row config)
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL DEFAULT 'taichimurakami',
  name_ja text NOT NULL DEFAULT 'taichimurakami',
  address_en text NOT NULL DEFAULT '',
  address_ja text NOT NULL DEFAULT '',
  nickname text NOT NULL DEFAULT 'taichimurakami',
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO company_settings (name_en, name_ja, address_en, address_ja, nickname)
SELECT 'taichimurakami', 'taichimurakami', '', '', 'taichimurakami'
WHERE NOT EXISTS (SELECT 1 FROM company_settings);

-- PDF URL columns on orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pdf_oc_url text,
  ADD COLUMN IF NOT EXISTS pdf_deposit_url text,
  ADD COLUMN IF NOT EXISTS pdf_final_url text,
  ADD COLUMN IF NOT EXISTS pdf_commercial_url text;

-- Supabase Storage bucket
INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES ('order-documents', 'order-documents', true, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;
