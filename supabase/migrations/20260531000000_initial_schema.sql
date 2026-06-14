-- ============================================================
-- KOBO System - Initial Schema
-- ============================================================

-- ============================================================
-- 1. seasons - シーズン管理
-- ============================================================
CREATE TABLE seasons (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,                  -- 例: "SS2026"
  type        text        NOT NULL CHECK (type IN ('SS', 'AW')),
  year        integer     NOT NULL CHECK (year >= 2000 AND year <= 2100),
  eur_jpy     numeric(10, 4) NOT NULL CHECK (eur_jpy > 0),  -- EUR/JPY為替レート
  is_active   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (type, year)
);

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. suppliers - 仕入れ先
-- ============================================================
CREATE TABLE suppliers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  country         text        NOT NULL,
  contact_name    text,
  contact_email   text,
  contact_phone   text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. materials - 原材料
-- ============================================================
CREATE TABLE materials (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  supplier_id  uuid        REFERENCES suppliers(id) ON DELETE SET NULL,
  unit_price   numeric(12, 4) NOT NULL CHECK (unit_price >= 0),
  currency     text        NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'JPY', 'USD')),
  unit         text        NOT NULL,   -- 例: "m", "kg", "個"
  category     text        NOT NULL,   -- 例: "生地", "副資材", "糸"
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. products - 商品
-- ============================================================
CREATE TABLE products (
  id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  sku             text           NOT NULL UNIQUE,   -- 品番
  name            text           NOT NULL,
  season_id       uuid           NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,
  category        text           NOT NULL,          -- 例: "トップス", "ボトムス"
  cost_eur        numeric(12, 4) NOT NULL DEFAULT 0 CHECK (cost_eur >= 0),   -- 原価 (EUR)
  wholesale_eur   numeric(12, 4) NOT NULL DEFAULT 0 CHECK (wholesale_eur >= 0), -- 下代 (EUR)
  retail_eur      numeric(12, 4) NOT NULL DEFAULT 0 CHECK (retail_eur >= 0),    -- 上代 (EUR)
  retail_jpy      integer        NOT NULL DEFAULT 0 CHECK (retail_jpy >= 0),    -- 上代 (JPY)
  description     text,
  image_url       text,
  is_active       boolean        NOT NULL DEFAULT true,
  created_at      timestamptz    NOT NULL DEFAULT now(),
  updated_at      timestamptz    NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. product_materials - 商品と原材料の中間テーブル
-- ============================================================
CREATE TABLE product_materials (
  id           uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid           NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  material_id  uuid           NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  quantity     numeric(12, 4) NOT NULL CHECK (quantity > 0),   -- 使用量
  notes        text,
  created_at   timestamptz    NOT NULL DEFAULT now(),
  UNIQUE (product_id, material_id)
);

ALTER TABLE product_materials ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. customers - 取引先
-- ============================================================
CREATE TABLE customers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name      text        NOT NULL,
  country         text        NOT NULL,
  city            text,
  contact_name    text,
  contact_email   text,
  contact_phone   text,
  billing_address text,
  notes           text,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. orders - 注文
-- ============================================================
CREATE TABLE orders (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid        NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  season_id     uuid        NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,
  order_date    date        NOT NULL DEFAULT CURRENT_DATE,
  status        text        NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'confirmed', 'in_production', 'shipped', 'delivered', 'cancelled')),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 8. order_items - 注文明細
-- ============================================================
CREATE TABLE order_items (
  id           uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid           NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   uuid           NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity     integer        NOT NULL CHECK (quantity > 0),
  unit_price   numeric(12, 4) NOT NULL CHECK (unit_price >= 0),  -- 注文時の単価 (EUR)
  currency     text           NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'JPY')),
  notes        text,
  created_at   timestamptz    NOT NULL DEFAULT now(),
  UNIQUE (order_id, product_id)
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- updated_at 自動更新トリガー
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_seasons_updated_at
  BEFORE UPDATE ON seasons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_materials_updated_at
  BEFORE UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- インデックス
-- ============================================================
CREATE INDEX idx_materials_supplier_id    ON materials(supplier_id);
CREATE INDEX idx_materials_category       ON materials(category);
CREATE INDEX idx_products_season_id       ON products(season_id);
CREATE INDEX idx_products_category        ON products(category);
CREATE INDEX idx_product_materials_product ON product_materials(product_id);
CREATE INDEX idx_product_materials_material ON product_materials(material_id);
CREATE INDEX idx_orders_customer_id       ON orders(customer_id);
CREATE INDEX idx_orders_season_id         ON orders(season_id);
CREATE INDEX idx_orders_status            ON orders(status);
CREATE INDEX idx_order_items_order_id     ON order_items(order_id);
CREATE INDEX idx_order_items_product_id   ON order_items(product_id);

-- ============================================================
-- RLS ポリシー (認証済みユーザーに全操作を許可)
-- ============================================================
CREATE POLICY "authenticated_all" ON seasons        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON suppliers      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON materials      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON products       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON product_materials FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON customers      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON orders         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON order_items    FOR ALL TO authenticated USING (true) WITH CHECK (true);
