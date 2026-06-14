-- Snapshot of a generated document's goods total + item count (for Saved Versions)
ALTER TABLE order_documents
  ADD COLUMN IF NOT EXISTS total_qty integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric NOT NULL DEFAULT 0;
