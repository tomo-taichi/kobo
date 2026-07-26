-- ADR-0009 Phase 3 (Settings) — seed the managed lists with the values that were
-- previously hard-coded, so Brand users can curate (add/remove) them and forms
-- read the full set from day one. Idempotent (on conflict do nothing).
insert into public.list_options (domain, value, sort_order) values
  ('supplier_country','Japan',0),('supplier_country','Italy',1),('supplier_country','China',2),('supplier_country','USA',3),('supplier_country','UK',4),
  ('product_category','Coat',0),('product_category','Jacket',1),('product_category','Trousers',2),('product_category','Knitwear',3),('product_category','Shirt',4),('product_category','T-shirt',5),('product_category','Shoes',6),('product_category','Bag',7),('product_category','Watch',8),('product_category','Accessories',9),('product_category','Eyewear',10),('product_category','Other',11),
  ('product_sex','Men',0),('product_sex','Women',1),('product_sex','Unisex',2),('product_sex','Kids',3),
  ('product_accessory_composition','銀925-SILVER925',0),
  ('product_accessory_composition','錫-TIN + 銀925-SILVER925',1),
  ('product_accessory_composition','鉄-IRON',2),
  ('product_accessory_composition','ﾁﾀﾝ-TITANIUM + 銀925-SILVER925',3),
  ('product_accessory_composition','ｽﾃｨｰﾙ-STAINLESS STEEL + 銀925-SILVER925',4),
  ('product_accessory_composition','ｽﾃｨｰﾙ-STAINLESS STEEL',5),
  ('product_accessory_composition','鉄-IRON + 銀925-SILVER925',6),
  ('product_accessory_composition','ｱﾙﾐﾆｳﾑ-ALUMINIUM + 銀925-SILVER925',7),
  ('product_accessory_composition','水牛角-BUFFALO HORN + 銀925-SILVER925',8)
on conflict (domain, value) do nothing;
