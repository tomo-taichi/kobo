-- ADR-0011 — backfill orderable_sizes for versions that have none (926 of 936). Rule:
--   non-apparel category (Shoes/Bag/Watch/Accessories/Eyewear/Other/…) → {Free};
--   apparel (Coat/Jacket/Trousers/Knitwear/Shirt/T-shirt) → by the version's products' sex:
--     all Men → 5..10; all Women → 1..4; Unisex/mixed/none → 1..10.
-- Versions that already have sizes are left untouched. Rollback-tested (self-aborting DO
-- block): 926 filled, 0 left empty; Men(5-10)=533 / Free=306 / Women(1-4)=62 / 1-10=25.
with derived as (
  select v.id as version_id, m.category,
    (select array_agg(distinct p.product_sex) from public.products p
       where p.model_version_id = v.id and p.product_sex is not null) as sexes
  from public.model_versions v
  join public.models m on m.id = v.model_id
  where coalesce(array_length(v.orderable_sizes, 1), 0) = 0
),
plan as (
  select version_id,
    case
      when category not in ('Coat','Jacket','Trousers','Knitwear','Shirt','T-shirt') then array['Free']
      when sexes = array['Men'] then array['5','6','7','8','9','10']
      when sexes = array['Women'] then array['1','2','3','4']
      else array['1','2','3','4','5','6','7','8','9','10']
    end as sizes
  from derived
)
update public.model_versions v
set orderable_sizes = plan.sizes
from plan
where v.id = plan.version_id;
