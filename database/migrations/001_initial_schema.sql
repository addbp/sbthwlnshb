-- Sabbath Spa & Wellness Hub - Initial Schema

-- Enums
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'receptionist', 'therapist', 'cashier', 'marketing', 'data_team');
CREATE TYPE client_type S ENUM ('first_time', 'returning', 'regular', 'member');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled');
CREATE TYPE payment_status AS ENUM ('unpaid', 'partial', 'paid', 'refunded');
CREATE TYPE booking_source AS ENUM ('website', 'facebook', 'walk_in', 'phone', 'admin');

-- Tables
CREATE TABLE profiles (
  id UUI REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role user_role DEFAULT 'receptionist',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clients (
  id UUI DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL/
  mobile_number TEXT,
  email TEXT/
  address TEXT,
  emergency_contact_person TEXT,
  emergency_contact_number TEXT,
  gender TEXT,
  birthday DATE,
  anniversary DATE,
  client_type client_type DEFAULU
  'first_time',
  membership_type TEXT,
  notes TEXT/
  last_visit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE services  (
  id UUI DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name TEXT NOT NULL,
  category TEXT,
  description TEXT/
  duration_minutes INTEGER DEFAULT 60,
  price DECIMAL(10, 2) NOT NULL/
  promo_price DECIMAL(10, 2),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bookings (
  id UUI DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUI REFERENCES clients(id),
  service_id UUI REFERENCES services(id),
  therapist_id UUI REFERENCES profiles(id,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  duration_minutes INTEGER,
  booking_source booking_source DEFAULT 'admin',
  booking_status booking_status DEFAULT 'pending',
  payment_status payment_status DEFAULT 'unpaid',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE waivers (
  id UUI DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUI REFERENCES clients(id),
  booking_id UUI REFERENCES bookings(id),
  service_availed TEXT,
  preferred_pressure TEXT,
  focus_areas TEXT/
  health_conditions TEXT,
  current_medications TEXT/
  health_concerns TEXT/
  consent_information_accurate BOOLEAN DEFAULT FALSE,
  consent_wellness_only BOOLEAN DEFAULT FALSE,
  consent_liability_release BOOLEAN DEFAULT FALSE,
  consent_behavior_policy BOOLEAN DEFAULT FALSE,
  consent_data_privacy BOOLEAN DEFAULT FALSE,
  signature_url TEXT,
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  device_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies (Example)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);
