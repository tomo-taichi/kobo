-- orders.order_number is backed by a sequence; inserting an order calls nextval(),
-- which requires USAGE on the sequence. The sequence (created via raw migration) only
-- had default/postgres grants, causing "permission denied for sequence
-- orders_order_number_seq" from the authenticated app role. Mirror the table grants.
grant usage, select on all sequences in schema public to anon, authenticated;

-- Ensure future sequences created in public also get usage (defensive, matches tables).
alter default privileges in schema public grant usage, select on sequences to anon, authenticated;
