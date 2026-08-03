-- ADR-0010 — internal-user production roles. Nickname is the short name shown in
-- Production (Kanban assignees); is_cutter/is_sewer flag which internal users can
-- be assigned to cutting/sewing. Additive; defaults keep existing users unflagged.
alter table public.profiles
  add column if not exists nickname   text,
  add column if not exists is_cutter  boolean not null default false,
  add column if not exists is_sewer   boolean not null default false;
