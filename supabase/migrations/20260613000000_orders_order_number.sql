-- Auto-incrementing human-readable order number (shown as "ORDER #" on the OC PDF)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number integer;

CREATE SEQUENCE IF NOT EXISTS orders_order_number_seq OWNED BY orders.order_number;

-- Backfill existing rows in creation order
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM orders
  WHERE order_number IS NULL
)
UPDATE orders o
SET order_number = ordered.rn
FROM ordered
WHERE o.id = ordered.id;

-- Advance the sequence past the highest assigned number
SELECT setval('orders_order_number_seq', COALESCE((SELECT MAX(order_number) FROM orders), 0) + 1, false);

ALTER TABLE orders ALTER COLUMN order_number SET DEFAULT nextval('orders_order_number_seq');
