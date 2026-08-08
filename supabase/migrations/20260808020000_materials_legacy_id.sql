-- Data migration support — preserve legacy FileMaker keys so imports are
-- idempotent and Products can resolve material/colour relationships by the old
-- key. materials.legacy_id = representative id per (season+material item) group;
-- material_colors.legacy_id = the per-row FileMaker material PK (products link here).
alter table public.materials add column if not exists legacy_id text;
create unique index if not exists materials_legacy_id_key on public.materials (legacy_id);

alter table public.material_colors add column if not exists legacy_id text;
create unique index if not exists material_colors_legacy_id_key on public.material_colors (legacy_id);
