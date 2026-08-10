-- ADR-0011 Phase 2 — merge case/space-duplicate models. Groups models by
-- (normalized name = trim+lowercase+collapse-whitespace, category); where a group has
-- more than one model, keep the SURVIVOR (most versions, tiebreak smallest id) and merge
-- the rest in: reassign the losers' versions, the legacy products.model_id link, and
-- default tags to the survivor, then delete the (now empty) loser models.
--
-- Versions and products are preserved (products link via model_version_id + the legacy
-- model_id, both reassigned). Rollback-tested via self-aborting DO block:
--   models 714 -> 682 (32 deleted), versions 936 preserved,
--   products.model_version_id 1921 preserved, products.model_id 1921 preserved,
--   active-version-per-season conflicts = 0.
-- Wrapped in a DO block with post-merge invariant checks that ABORT on any count drift.
DO $mrg$
DECLARE
  v_versions_before int; v_versions_after int;
  v_pv_before int; v_pv_after int;
  v_pm_before int; v_pm_after int;
BEGIN
  select count(*) into v_versions_before from public.model_versions;
  select count(*) into v_pv_before from public.products where model_version_id is not null;
  select count(*) into v_pm_before from public.products where model_id is not null;

  create temp table _model_merge_map on commit drop as
  with norm as (
    select m.id, regexp_replace(lower(btrim(m.name)), '\s+', ' ', 'g') as nname, m.category,
      (select count(*) from public.model_versions v where v.model_id = m.id) as vers
    from public.models m
  ),
  grp as (
    select id, nname, category,
      count(*) over (partition by nname, category) as gsize,
      first_value(id) over (partition by nname, category order by vers desc, id) as survivor_id
    from norm
  )
  select id as loser_id, survivor_id from grp where gsize > 1 and id <> survivor_id;

  update public.model_versions v set model_id = mm.survivor_id from _model_merge_map mm where v.model_id = mm.loser_id;
  update public.products p set model_id = mm.survivor_id from _model_merge_map mm where p.model_id = mm.loser_id;
  insert into public.model_tags (model_id, tag)
    select mm.survivor_id, mt.tag from public.model_tags mt join _model_merge_map mm on mm.loser_id = mt.model_id
    on conflict (model_id, tag) do nothing;
  delete from public.models where id in (select loser_id from _model_merge_map);

  select count(*) into v_versions_after from public.model_versions;
  select count(*) into v_pv_after from public.products where model_version_id is not null;
  select count(*) into v_pm_after from public.products where model_id is not null;
  if v_versions_after <> v_versions_before then raise exception 'ABORT: versions % -> %', v_versions_before, v_versions_after; end if;
  if v_pv_after <> v_pv_before then raise exception 'ABORT: products.model_version_id % -> %', v_pv_before, v_pv_after; end if;
  if v_pm_after <> v_pm_before then raise exception 'ABORT: products.model_id % -> %', v_pm_before, v_pm_after; end if;
END
$mrg$;
