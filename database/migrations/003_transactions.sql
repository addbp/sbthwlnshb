-- Sabbath Spa & Wellness Hub - Transactions / Payments Schema

-- payment_method enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE TYPE payment_method AS ENUM ('cash', 'gcash', 'card', 'bank_transfer', 'other');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  original_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  discount_id UUID REFERENCES discounts(id) ON DELETE SET NULL,
  discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  final_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payment_method payment_method DEFAULT 'cash',
  payment_status payment_status DEFAULT 'unpaid',
  reference_number TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view transactions" ON transactions;
CREATE POLICY "Authenticated users can view transactions"
ON transactions FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage transactions" ON transactions;
CREATE POLICY "Authenticated users can manage transactions"
ON transactions FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
