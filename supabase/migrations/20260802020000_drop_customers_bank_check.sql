-- ADR-0009 Phase 3 — customer banks are now a managed list (banks table), so the
-- old fixed-value CHECK on customers.bank (only 'Rakuten_JP' / 'WISE_EU') is
-- obsolete and rejects any newly-added bank. The dropdown (fed by the banks table)
-- now constrains the choices, so the CHECK is dropped.
alter table public.customers drop constraint if exists customers_bank_check;
