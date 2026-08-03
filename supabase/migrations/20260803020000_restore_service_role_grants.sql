-- Fix: service_role lost its SELECT/INSERT/UPDATE/DELETE grants on every public
-- table (only REFERENCES/TRIGGER/TRUNCATE remained). The server-side admin client
-- uses service_role, so profile reads returned "permission denied" — the Internal
-- Users list came back empty, and the profile upsert during user creation failed,
-- leaving orphaned auth users. Restore the Supabase default: service_role has full
-- access to the public schema (it is a trusted, server-only key and bypasses RLS
-- by design; RLS is enforced for anon/authenticated, not for service_role).
grant usage on schema public to service_role;
grant all privileges on all tables    in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

-- Future objects created in public inherit the same grants.
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;
