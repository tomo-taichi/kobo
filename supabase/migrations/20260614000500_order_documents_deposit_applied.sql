-- Deposit amount applied to a Final invoice batch (billing currency), so the
-- paid-deposit pool can be consumed sequentially across batches.
ALTER TABLE order_documents ADD COLUMN IF NOT EXISTS deposit_applied numeric NOT NULL DEFAULT 0;
