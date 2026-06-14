-- customer_payments / company_settings / customer_contracts were created via
-- later raw migrations and lacked DML grants for the app roles, causing
-- "permission denied for table ..." once their gates were reached.
-- These tables already have permissive RLS policies; only the grants were missing.
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_payments  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON company_settings   TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_contracts TO anon, authenticated;
