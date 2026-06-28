-- Phase 2 complete: all code now reads customer_type / language; the legacy group_type
-- is no longer referenced (PDF language, payment terms, pricing, list all migrated). Drop it.
alter table public.customers drop column if exists group_type;
