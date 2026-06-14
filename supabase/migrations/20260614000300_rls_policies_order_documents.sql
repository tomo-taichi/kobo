-- RLS is enabled on order_documents / order_document_versions but they had no
-- policies, so inserts hit "new row violates row-level security policy".
-- Mirror the permissive "authenticated full access" policy used by orders.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_documents' AND policyname='authenticated_full_access') THEN
    EXECUTE 'CREATE POLICY authenticated_full_access ON order_documents FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_document_versions' AND policyname='authenticated_full_access') THEN
    EXECUTE 'CREATE POLICY authenticated_full_access ON order_document_versions FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;
