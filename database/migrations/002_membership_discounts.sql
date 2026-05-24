-- Sabbath Spa & Wellness Hub - Membership & Discounts Schema

CREATE TABLE IF NOT EXISTS discounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  category TEXT,
  active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add discount_id to clients table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='discount_id') THEN
        ALTER TABLE clients ADD COLUMN discount_id UUID REFERENCES discounts(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Seed Official Sabbath Spa Discount Data
INSERT INTO discounts (name, discount_percentage, category, active)
VALUES
('BASIC', 5, 'membership', true),
('GOLD', 5, 'membership', true),
('PLATINUM', 10, 'membership', true),
('VIP', 10, 'membership', true),
('SENIOR', 20, 'discount', true),
('C/O Ma''am Gia', 100, 'special', true),
('C/O Pastor Erick', 40, 'special', true),
('EMPLOYEE DISCOUNT', 20, 'staff', true),
('SPECIAL DISCOUNT', 10, 'special', true),
('FLYER (FREE)', 100, 'promo', true),
('PLATINUM (Free Pho/Bahn mi)', 100, 'promo', true),
('DALISAY DISCOUNT', 10, 'special', true),
('FREE', 100, 'promo', true),
('MOTHER''S DAY 10%', 10, 'promo', true),
('VOTER''S 10%', 10, 'promo', true),
('HALF PAYMENT', 50, 'payment', true),
('BIRTHDAY TREAT', 100, 'promo', true)
ON CONFLICT (name) DO NOTHING;

-- RLS Policies
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view discounts" ON discounts;
CREATE POLICY "Authenticated users can view discounts"
ON discounts FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage discounts" ON discounts;
CREATE POLICY "Authenticated users can manage discounts"
ON discounts FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
