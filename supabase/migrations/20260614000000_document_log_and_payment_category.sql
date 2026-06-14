-- Payment Log: classify entries (deposit / balance / other)
ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_payments_category_chk') THEN
    ALTER TABLE customer_payments
      ADD CONSTRAINT customer_payments_category_chk
      CHECK (category IN ('deposit','balance','other'));
  END IF;
END $$;

-- Logical document / invoice (OC & Deposit: 1 per order; Final/Commercial/Delivery: 1 per batch)
CREATE TABLE IF NOT EXISTS order_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  doc_type        text NOT NULL,
  seq_no          integer NOT NULL DEFAULT 1,
  item_ids        jsonb,
  deposit_deadline date,
  payment_id      uuid REFERENCES customer_payments(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_documents_doc_type_chk') THEN
    ALTER TABLE order_documents
      ADD CONSTRAINT order_documents_doc_type_chk
      CHECK (doc_type IN ('oc','deposit','final','commercial','delivery'));
  END IF;
END $$;

-- PDF versions of a logical document (YYMMDD_vNN)
CREATE TABLE IF NOT EXISTS order_document_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid NOT NULL REFERENCES order_documents(id) ON DELETE CASCADE,
  version_no    integer NOT NULL,
  version_label text NOT NULL,
  file_url      text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid
);

CREATE INDEX IF NOT EXISTS idx_order_documents_order  ON order_documents(order_id, doc_type);
CREATE INDEX IF NOT EXISTS idx_order_doc_versions_doc ON order_document_versions(document_id);
