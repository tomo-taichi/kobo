-- Product Complete Status. A product is a 'draft' (editable) until manually
-- Finalised. 'final' means the product info is confirmed and LOCKED (read-only)
-- until it is Unlocked back to 'draft'. finalized_at records when it was locked.
alter table public.products add column if not exists status text not null default 'draft';
alter table public.products add column if not exists finalized_at timestamptz;

alter table public.products drop constraint if exists products_status_check;
alter table public.products add constraint products_status_check check (status in ('draft', 'final'));
