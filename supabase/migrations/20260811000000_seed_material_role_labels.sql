-- ADR-0011 Phase 2 — seed the managed material-role label vocabulary so the labels
-- are editable in Settings (list_options domain 'material_role': value = role key,
-- label = Japanese display). Idempotent (on conflict do nothing). Display already
-- falls back to code defaults (src/lib/material-roles.ts) when a row is absent.
insert into public.list_options (domain, value, label, sort_order) values
  ('material_role','lining','裏地',0),
  ('material_role','sleeve_lining','袖裏地',1),
  ('material_role','pocket_facing','ポケットスレキ向布',2),
  ('material_role','pocket_bag','ポケットスレキ手前布',3),
  ('material_role','interfacing','芯地',4),
  ('material_role','accessories','付属',5),
  ('material_role','main','メイン',6),
  ('material_role','body_lining','身頃裏地',7),
  ('material_role','pocket_front','ポケット向布',8),
  ('material_role','pocket_back','ポケット手前布',9),
  ('material_role','interlining','芯地',10),
  ('material_role','accessory_parts','付属パーツ',11),
  ('material_role','accessory_tag','付属タグ',12)
on conflict (domain, value) do nothing;
