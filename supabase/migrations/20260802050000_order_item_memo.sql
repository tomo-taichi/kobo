-- Per-order-line memo, entered on the order's Products page and shown on the
-- Production Master List next to that client's row.
alter table public.order_items
  add column if not exists memo text;
