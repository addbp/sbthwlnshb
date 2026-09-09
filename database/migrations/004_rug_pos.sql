-- Sabbath Spa & Wellness Hub - RUG POS Schema
--
-- RUG is a distinct business line. These tables are deliberately separate from
-- `bookings`: `category` there is a render-time keyword match that defaults to
-- 'SABBATH' (app/dashboard/bookings/page.tsx:161-162), so RUG rows placed in
-- `bookings` would be counted as spa revenue by every KPI site.
--
-- `sabasu_orders` is intentionally NOT dropped, renamed or altered by this
-- migration. It holds live orders and remains closed-book historical data.
--
-- Money is NUMERIC(12,2) throughout - never float, never real.
-- Every money column on rug_orders and rug_menu_items is NOT NULL DEFAULT 0 so
-- a NULL can never reach the client-side row math (a NULL becomes NaN in JS and
-- propagates silently into displayed totals - the failure mode at
-- app/dashboard/page.tsx:538-541). rug_order_items.unit_price and .line_total
-- are deliberately NOT NULL with NO default: a malformed insert must error
-- rather than silently record a zero-value line item.
--
-- RLS NOTE: the policies below grant access to the `authenticated` role ONLY.
-- With RLS enabled and no policy for `anon`, PostgreSQL default-denies, so the
-- public anon key cannot read or write these tables. A public-facing RUG order
-- form (equivalent to app/sabasu/page.tsx, which inserts under the anon key)
-- will therefore require an explicit anon INSERT policy to be added at that
-- time. This is a deliberate default-closed posture, not an oversight.

-- ─────────────────────────────────────────────────────────────
-- rug_menu_items
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rug_menu_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_rug_menu_items_price_non_negative CHECK (price >= 0),
  CONSTRAINT chk_rug_menu_items_cost_non_negative CHECK (cost >= 0)
);

-- ─────────────────────────────────────────────────────────────
-- rug_orders
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rug_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_date DATE NOT NULL,
  order_time TIME NULL,
  customer_label TEXT NULL,
  branch TEXT NOT NULL DEFAULT 'Sabbath Malolos',
  business_line TEXT NOT NULL DEFAULT 'RUG',
  payment_method TEXT,
  payment_ref TEXT,
  discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  gross_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  received_payment NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_sales NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending',
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_rug_orders_discount_pct_range CHECK (discount_pct >= 0 AND discount_pct <= 100),
  CONSTRAINT chk_rug_orders_discount_amount_non_negative CHECK (discount_amount >= 0),
  CONSTRAINT chk_rug_orders_gross_amount_non_negative CHECK (gross_amount >= 0),
  CONSTRAINT chk_rug_orders_received_payment_non_negative CHECK (received_payment >= 0),
  CONSTRAINT chk_rug_orders_net_sales_non_negative CHECK (net_sales >= 0),
  CONSTRAINT chk_rug_orders_total_cost_non_negative CHECK (total_cost >= 0)
);

-- ─────────────────────────────────────────────────────────────
-- rug_order_items
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rug_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES rug_orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES rug_menu_items(id) ON DELETE SET NULL,
  item_name_text TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL,
  CONSTRAINT chk_rug_order_items_qty_positive CHECK (qty > 0),
  CONSTRAINT chk_rug_order_items_unit_price_non_negative CHECK (unit_price >= 0),
  CONSTRAINT chk_rug_order_items_unit_cost_non_negative CHECK (unit_cost >= 0),
  CONSTRAINT chk_rug_order_items_line_total_non_negative CHECK (line_total >= 0)
);

-- ─────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rug_orders_order_date ON rug_orders (order_date);
CREATE INDEX IF NOT EXISTS idx_rug_orders_branch ON rug_orders (branch);
CREATE INDEX IF NOT EXISTS idx_rug_order_items_order_id ON rug_order_items (order_id);

-- ─────────────────────────────────────────────────────────────
-- RLS - rug_menu_items
-- ─────────────────────────────────────────────────────────────
ALTER TABLE rug_menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view rug_menu_items" ON rug_menu_items;
CREATE POLICY "Authenticated users can view rug_menu_items"
ON rug_menu_items FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage rug_menu_items" ON rug_menu_items;
CREATE POLICY "Authenticated users can manage rug_menu_items"
ON rug_menu_items FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- RLS - rug_orders
-- ─────────────────────────────────────────────────────────────
ALTER TABLE rug_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view rug_orders" ON rug_orders;
CREATE POLICY "Authenticated users can view rug_orders"
ON rug_orders FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage rug_orders" ON rug_orders;
CREATE POLICY "Authenticated users can manage rug_orders"
ON rug_orders FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- RLS - rug_order_items
-- ─────────────────────────────────────────────────────────────
ALTER TABLE rug_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view rug_order_items" ON rug_order_items;
CREATE POLICY "Authenticated users can view rug_order_items"
ON rug_order_items FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage rug_order_items" ON rug_order_items;
CREATE POLICY "Authenticated users can manage rug_order_items"
ON rug_order_items FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
