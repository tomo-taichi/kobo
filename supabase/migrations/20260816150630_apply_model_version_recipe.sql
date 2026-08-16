-- ADR-0011 Phase 4-2 — atomic recipe propagation (§9.2c / §9.3 / §9.4).
-- ONE function does the whole thing in ONE transaction (all-or-nothing):
--   1. edit the Model Version's shared recipe (materials + sizes + composition + mfg template)
--   2. re-sync + LIVE-recalc cost on every PRE-BATCH, non-final product linked to that version
-- supabase-js autocommits per statement, so this MUST live server-side in plpgsql to be atomic.
--
-- p_dry_run = true  → compute the per-product diff, WRITE NOTHING, return it (drives the confirm modal).
-- p_dry_run = false → same math, then perform every write. A failure anywhere raises → full rollback.
--
-- Cost model faithfully mirrors updateProductCosts() (src/app/actions/product-costs.ts):
--   • per-colour: material = main_colour_price × main_qty + version_non_main ; cost = material + mfg
--   • mfg is PRODUCT-owned (§9.1) and is preserved verbatim as (cost_jpy − material_cost_jpy) per row —
--     we never touch *_minutes / *_cost_jpy, so the mfg component and its rounding survive exactly.
--   • cost_eur = cost_jpy / cost_eur_rate ; wholesale_eur (Ideal WS) = cost_eur × markup_rate ; retail untouched.
create or replace function public.apply_model_version_recipe(
  p_version_id            uuid,
  p_changelog             text,
  p_orderable_sizes       text[],
  p_accessory_composition text,
  p_minutes               jsonb,   -- {"cutting":n,"sewing":n,"knitting":n,"thread":n,"finish":n,"packing":n}
  p_materials             jsonb,   -- [{"role","material_id","material_color_id","usage_amount"}, ...]
  p_dry_run               boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status       text;
  v_new_nonmain  numeric := 0;    -- version's non-main material cost at CURRENT set prices
  v_lining       jsonb   := null; -- the lining row from p_materials (if any)
  m              jsonb;
  v_role         text;
  rec            record;          -- a pre-batch product
  pc             record;          -- one of its product_colors
  v_rate         numeric;
  v_main_base    numeric;
  v_main_price   numeric;
  v_mfg          numeric;
  v_new_matcost  numeric;
  v_new_cost     numeric;
  v_new_base     numeric;         -- product base material cost after edit
  v_new_base_cost numeric;        -- product base cost_jpy after edit
  v_affected     jsonb   := '[]'::jsonb;
  v_count        int     := 0;
  v_cur_sum      numeric := 0;
  v_new_sum      numeric := 0;
begin
  if not public.is_internal() then raise exception 'Not authorized'; end if;

  select mv.status into v_status from model_versions mv where mv.id = p_version_id;
  if not found      then raise exception 'Version not found'; end if;
  if v_status = 'deprecated' then raise exception 'This version is deprecated — restore it before editing.'; end if;
  if exists (select 1 from products p join production_batches b on b.product_id = p.id
             where p.model_version_id = p_version_id) then
    raise exception 'This version is in production (a batch was generated) and is locked.';
  end if;

  -- Validate rows + compute the new non-main cost (all roles incl. lining) at current set prices.
  for m in select * from jsonb_array_elements(coalesce(p_materials, '[]'::jsonb)) loop
    v_role := m->>'role';
    if v_role is null or v_role not in
       ('lining','sleeve_lining','pocket_facing','pocket_bag','interfacing','accessories') then
      raise exception 'Invalid material role: %', coalesce(v_role, '(null)');
    end if;
    if nullif(m->>'material_id','') is null then raise exception 'Each material row needs a material selected.'; end if;
    if coalesce((m->>'usage_amount')::numeric, 0) < 0 then raise exception 'Usage amount must be zero or more.'; end if;
    v_new_nonmain := v_new_nonmain
      + coalesce((select set_price_jpy from materials where id = (m->>'material_id')::uuid), 0)
        * coalesce((m->>'usage_amount')::numeric, 0);
    if v_role = 'lining' then v_lining := m; end if;
  end loop;

  -- Walk every PRE-BATCH, non-final product on this version (frozen products are excluded, §9.2).
  for rec in
    select p.* from products p
    where p.model_version_id = p_version_id
      and p.status is distinct from 'final'
      and not exists (select 1 from production_batches b where b.product_id = p.id)
  loop
    v_rate      := coalesce(nullif(rec.cost_eur_rate, 0), 1);
    v_main_base := coalesce((select set_price_jpy from materials where id = rec.main_material_id), 0);
    v_mfg       := coalesce(rec.cost_jpy, 0) - coalesce(rec.material_cost_jpy, 0);   -- preserved (product-owned)
    v_new_base      := v_main_base * coalesce(rec.main_m_quantity, 0) + v_new_nonmain;
    v_new_base_cost := v_new_base + v_mfg;

    -- Preview accounting uses the base snapshot (the delta is identical across colours).
    if abs(v_new_base_cost - coalesce(rec.cost_jpy, 0)) > 0.5 then
      v_count   := v_count + 1;
      v_cur_sum := v_cur_sum + coalesce(rec.cost_jpy, 0);
      v_new_sum := v_new_sum + v_new_base_cost;
      v_affected := v_affected || jsonb_build_object(
        'productId',      rec.id,
        'productNumber',  rec.product_number,
        'name',           coalesce(rec.name, '—'),
        'currentCostJpy', coalesce(rec.cost_jpy, 0),
        'newCostJpy',     v_new_base_cost,
        'deltaJpy',       v_new_base_cost - coalesce(rec.cost_jpy, 0),
        'pct',            case when coalesce(rec.cost_jpy, 0) > 0
                               then (v_new_base_cost - rec.cost_jpy) / rec.cost_jpy
                               when v_new_base_cost <> 0 then 1 else 0 end
      );
    end if;

    continue when p_dry_run;   -- dry-run: measure only, write nothing

    -- (1) Recompute each enabled colour's cost stack (main price can vary per colour).
    for pc in select * from product_colors where product_id = rec.id loop
      v_main_price  := coalesce(
        (select mc.set_price_jpy from material_colors mc
          where mc.id = pc.material_color_id and mc.material_id = rec.main_material_id), v_main_base);
      v_new_matcost := v_main_price * coalesce(rec.main_m_quantity, 0) + v_new_nonmain;
      v_new_cost    := v_new_matcost + (coalesce(pc.cost_jpy, 0) - coalesce(pc.material_cost_jpy, 0)); -- preserve colour's mfg
      update product_colors set
        material_cost_jpy = v_new_matcost,
        cost_jpy          = v_new_cost,
        cost_eur          = v_new_cost / v_rate,
        wholesale_eur     = (v_new_cost / v_rate) * coalesce(pc.markup_rate, 0)
      where id = pc.id;   -- retail_price_eur / retail_rate untouched (§9.3)
    end loop;

    -- (2) Base snapshot + recipe columns on the product. NEVER *_minutes (§9.1).
    update products set
      material_cost_jpy        = v_new_base,
      cost_jpy                 = v_new_base_cost,
      cost_eur                 = v_new_base_cost / v_rate,
      wholesale_eur            = (v_new_base_cost / v_rate) * coalesce(rec.markup_rate, 0),
      orderable_sizes          = coalesce(p_orderable_sizes, '{}'),
      accessory_composition    = nullif(btrim(coalesce(p_accessory_composition, '')), ''),
      lining_material_id       = case when v_lining is not null then (v_lining->>'material_id')::uuid end,
      lining_material_color_id = case when v_lining is not null then nullif(v_lining->>'material_color_id','')::uuid end,
      lining_m_quantity        = case when v_lining is not null then coalesce((v_lining->>'usage_amount')::numeric, 0) else 0 end
    where id = rec.id;

    -- Lining denormalised display columns (mirror syncProductRecipeFromVersion).
    if v_lining is not null then
      update products p set
        lining_m_category = lm.category, lining_m_name = lm.name, lining_m_color = lm.color,
        lining_m_comp1_label = lm.comp_1_label, lining_m_comp1_pct = lm.comp_1_pct,
        lining_m_comp2_label = lm.comp_2_label, lining_m_comp2_pct = lm.comp_2_pct,
        lining_m_comp3_label = lm.comp_3_label, lining_m_comp3_pct = lm.comp_3_pct,
        lining_m_comp4_label = lm.comp_4_label, lining_m_comp4_pct = lm.comp_4_pct,
        lining_m_comp5_label = lm.comp_5_label, lining_m_comp5_pct = lm.comp_5_pct
      from materials lm where lm.id = (v_lining->>'material_id')::uuid and p.id = rec.id;
    else
      update products set
        lining_m_category=null, lining_m_name=null, lining_m_color=null,
        lining_m_comp1_label=null, lining_m_comp1_pct=null, lining_m_comp2_label=null, lining_m_comp2_pct=null,
        lining_m_comp3_label=null, lining_m_comp3_pct=null, lining_m_comp4_label=null, lining_m_comp4_pct=null,
        lining_m_comp5_label=null, lining_m_comp5_pct=null
      where id = rec.id;
    end if;

    -- (3) Replace the product's non-lining materials with the version's.
    delete from product_materials where product_id = rec.id;
    insert into product_materials (product_id, material_id, usage_amount, material_group, material_color_id)
    select rec.id, (mm->>'material_id')::uuid, coalesce((mm->>'usage_amount')::numeric, 0),
           mm->>'role', nullif(mm->>'material_color_id','')::uuid
    from jsonb_array_elements(coalesce(p_materials, '[]'::jsonb)) mm
    where (mm->>'role') <> 'lining';
  end loop;

  -- Apply the version edit itself, in the SAME transaction.
  if not p_dry_run then
    update model_versions set
      changelog             = nullif(btrim(coalesce(p_changelog, '')), ''),
      orderable_sizes       = coalesce(p_orderable_sizes, '{}'),
      accessory_composition = nullif(btrim(coalesce(p_accessory_composition, '')), ''),
      cutting_minutes  = coalesce((p_minutes->>'cutting')::numeric, 0),
      sewing_minutes   = coalesce((p_minutes->>'sewing')::numeric, 0),
      knitting_minutes = coalesce((p_minutes->>'knitting')::numeric, 0),
      thread_minutes   = coalesce((p_minutes->>'thread')::numeric, 0),
      finish_minutes   = coalesce((p_minutes->>'finish')::numeric, 0),
      packing_minutes  = coalesce((p_minutes->>'packing')::numeric, 0)
    where id = p_version_id;

    delete from model_version_materials where model_version_id = p_version_id;
    insert into model_version_materials (model_version_id, role, material_id, material_color_id, usage_amount, sort_order)
    select p_version_id, t.mm->>'role', (t.mm->>'material_id')::uuid, nullif(t.mm->>'material_color_id','')::uuid,
           coalesce((t.mm->>'usage_amount')::numeric, 0), (t.ord - 1)::int
    from jsonb_array_elements(coalesce(p_materials, '[]'::jsonb)) with ordinality as t(mm, ord);
  end if;

  return jsonb_build_object(
    'affected',      v_affected,
    'count',         v_count,
    'currentSumJpy', v_cur_sum,
    'newSumJpy',     v_new_sum
  );
end;
$$;

grant execute on function public.apply_model_version_recipe(uuid, text, text[], text, jsonb, jsonb, boolean)
  to authenticated, service_role;
