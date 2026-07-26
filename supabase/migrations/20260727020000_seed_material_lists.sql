-- ADR-0009 Phase 3 (Settings) — seed the material select-lists with the previously
-- hard-coded values so Brand users can curate them. Categories keep their fabric /
-- accessory split (two domains, with display labels); units carry a label
-- (meter → m); compositions are a single flat list. Idempotent.
insert into public.list_options (domain, value, label, sort_order) values
  ('material_category_fabric','woven','Woven',0),('material_category_fabric','knitted','Knitted',1),('material_category_fabric','leather','Leather',2),
  ('material_category_accessory','accessory','Accessory',0),('material_category_accessory','eyewear','Eyewear',1),('material_category_accessory','other','Other',2),
  ('material_unit','meter','m',0),('material_unit','piece','pcs',1),('material_unit','ds','ds',2)
on conflict (domain, value) do nothing;

insert into public.list_options (domain, value, sort_order) values
  ('material_composition','綿-COTTON',0),('material_composition','海島綿-SEA ISLAND COTTON',1),('material_composition','毛-VIRGIN WOOL',2),('material_composition','英国羊毛-BRITISH WOOL',3),('material_composition','ｶｼﾐｱ-CASHMERE',4),('material_composition','ﾓﾝｺﾞﾘｱﾝｶｼﾐｱ-MONGOLIAN CASHMERE',5),('material_composition','ｱﾙﾊﾟｶ-ALPACA',6),('material_composition','ｱﾝｺﾞﾗ-ANGOLA',7),('material_composition','絹-SILK',8),('material_composition','ﾗﾐｰ-RAMIE',9),('material_composition','麻-LINEN',10),('material_composition','ﾍﾝﾌﾟ-HEMP',11),
  ('material_composition','反射ﾅｲﾛﾝ-REFLECT NYLON',12),('material_composition','ﾅｲﾛﾝ-NYLON',13),('material_composition','ﾎﾟﾘｴｽﾃﾙ-POLYESTER',14),('material_composition','ﾎﾟﾘｴﾁﾚﾝ-POLYETHYLENE',15),('material_composition','ﾎﾟﾘｳﾚﾀﾝ-POLYURETHANE',16),('material_composition','金属繊維-METAL FIBERS',17),('material_composition','ｷｭﾌﾟﾗ-CUPRA',18),('material_composition','ﾚｰﾖﾝ-RAYON',19),('material_composition','ｺｰﾃﾞｨﾗ-CORDURA',20),
  ('material_composition','仔牛-CALF FULL GRAIN',21),('material_composition','水牛-BISON FULL GRAIN',22),('material_composition','馬-HORSE FULL GRAIN',23),('material_composition','ｸﾛｺﾀﾞｲﾙ-CROCODILE',24),('material_composition','ｶﾝｶﾞﾙｰ-KANGAROO FULL GRAIN',25),('material_composition','鹿-DEER',26),
  ('material_composition','印刷紙-PRINTED PAPER',27),('material_composition','ｽｽﾞ-TIN',28),('material_composition','銀-SILVER925',29),('material_composition','鉄-IRON',30),('material_composition','ﾁﾀﾝ-TITANIUM',31),('material_composition','ｽﾃｨｰﾙ-STAINLESS STEEL',32),('material_composition','ｱﾙﾐﾆｳﾑ-ALUMINIUM',33),('material_composition','真鍮-BRASS',34),('material_composition','水牛角-BUFFALO HORN',35),('material_composition','ｴﾌｱｰﾙﾋﾟｰ-FRP',36)
on conflict (domain, value) do nothing;
