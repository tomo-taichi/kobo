-- company_settings had RLS enabled with no policy, so the authenticated app role
-- could not read it → PDF company info AND bank details (Advance/Final) came back
-- empty. Mirror the permissive policy used by orders.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_settings' AND policyname='authenticated_full_access') THEN
    EXECUTE 'CREATE POLICY authenticated_full_access ON company_settings FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;
