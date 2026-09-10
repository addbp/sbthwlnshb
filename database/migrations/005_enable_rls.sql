-- Sabbath Spa & Wellness Hub - Enable Row Level Security
--
-- The anon key is NEXT_PUBLIC_ prefixed, so Next.js embeds it in the browser
-- bundle. With RLS disabled, that key grants full read/write on eight tables to
-- anyone who opens a public page - including waivers (health conditions) and
-- clients (contact detail).
--
-- POSTURE: least privilege. Anon keeps ONLY the operations a public route needs.
-- Broad anon reads of customer data are removed even though the current app
-- depends on four of them - see BREAKING CHANGES. Every table also gets an
-- `authenticated` policy; without one the staff dashboard breaks entirely,
-- because enabling RLS with no matching policy is deny-all.
--
-- NOTE ON THE REVENUE REPORTS: daily_revenue_report and monthly_revenue_report
-- are VIEWS, not tables. RLS cannot be enabled on a view - `ALTER TABLE <view>
-- ENABLE ROW LEVEL SECURITY` raises an error.
--
-- A view does NOT automatically inherit the security of what it selects from.
-- By default (security_invoker = off, the PG15+ default) a view executes with
-- its OWNER's privileges. Both of these views are owned by `postgres`, which
-- bypasses RLS entirely - so enabling RLS on bookings and bookings_import
-- below does NOT protect them. Anyone able to select either view would read
-- all revenue data regardless of every policy in this file.
--
-- Two statements are required per view, and both are needed:
--   * security_invoker = on  -> the view executes with the CALLER's privileges,
--     so the base tables' RLS policies actually apply.
--   * REVOKE ALL ... FROM anon -> removes anon's ability to select the view at
--     all, independent of RLS.
-- They are applied at the end of this migration.
--
-- ─────────────────────────────────────────────────────────────
-- BREAKING CHANGES - these app paths STOP WORKING when this runs.
-- Do not deploy this migration without the companion code changes.
--
--   1. app/waiver/page.tsx:136-192 loops ['bookings','bookings_import',
--      'client','clients'] doing select('*') under the anon key to power name
--      autocomplete. All four reads are denied after this migration.
--      FIX: move that lookup to a server route using the service-role key.
--
--   2. app/api/reminders/route.ts:9 builds its client with
--      NEXT_PUBLIC_SUPABASE_ANON_KEY, then SELECTs bookings (:47) and UPDATEs
--      reminder_sent (:102). Anon UPDATE on bookings is deliberately NOT
--      granted - granting it would let any visitor mutate booking rows.
--      FIX: switch that handler to SUPABASE_SERVICE_ROLE_KEY. It is a Vercel
--      cron endpoint and never runs in a browser.
--
--   3. app/booking/page.tsx:483-489 SELECTs bookings directly for slot
--      availability. RLS is row-level, not column-level, so no policy can
--      expose appointment_time while hiding client_name and price on the same
--      row. This migration creates the view `public_booking_availability`
--      exposing only the six columns that query needs.
--      FIX: change that query from .from('bookings') to
--      .from('public_booking_availability').
--
--   4. app/booking/page.tsx:216 reads memberships to apply member discounts.
--      memberships holds client names, so anon SELECT is not granted.
--      FIX: resolve the member discount in a server route.
--
-- NOT AFFECTED: services and discounts already have RLS enabled and are read
-- by app/booking/page.tsx:214-215 and app/membership/page.tsx:60, so anon
-- SELECT policies already exist on them. This migration does not touch them.
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- bookings - anon INSERT only (public booking form at :679).
-- No anon SELECT, no anon UPDATE.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can create bookings" ON bookings;
CREATE POLICY "Public can create bookings"
ON bookings FOR INSERT
TO anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage bookings" ON bookings;
CREATE POLICY "Authenticated users can manage bookings"
ON bookings FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Column-restricted availability surface for the public booking form.
-- Six non-PII columns; no client_name, no price, no notes.
CREATE OR REPLACE VIEW public_booking_availability AS
SELECT
  appointment_date,
  appointment_time,
  therapist_name,
  branch,
  status,
  additional_mins
FROM bookings
WHERE status IS DISTINCT FROM 'Cancelled'
  AND status IS DISTINCT FROM 'Completed';

GRANT SELECT ON public_booking_availability TO anon;
GRANT SELECT ON public_booking_availability TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- bookings_import - staff only. No anon access.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE bookings_import ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage bookings_import" ON bookings_import;
CREATE POLICY "Authenticated users can manage bookings_import"
ON bookings_import FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- clients - staff only. No anon access. 19 columns of contact detail.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage clients" ON clients;
CREATE POLICY "Authenticated users can manage clients"
ON clients FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- memberships - anon INSERT only (public signup at membership/page.tsx:143).
-- No anon SELECT: the table holds client names.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can create memberships" ON memberships;
CREATE POLICY "Public can create memberships"
ON memberships FOR INSERT
TO anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage memberships" ON memberships;
CREATE POLICY "Authenticated users can manage memberships"
ON memberships FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- waivers - anon INSERT only (public waiver form at :306).
-- No anon SELECT: 18 columns including health_conditions.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE waivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can create waivers" ON waivers;
CREATE POLICY "Public can create waivers"
ON waivers FOR INSERT
TO anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage waivers" ON waivers;
CREATE POLICY "Authenticated users can manage waivers"
ON waivers FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- sabasu_orders - anon INSERT only (public cafe form at :92).
-- ─────────────────────────────────────────────────────────────
ALTER TABLE sabasu_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can create sabasu_orders" ON sabasu_orders;
CREATE POLICY "Public can create sabasu_orders"
ON sabasu_orders FOR INSERT
TO anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage sabasu_orders" ON sabasu_orders;
CREATE POLICY "Authenticated users can manage sabasu_orders"
ON sabasu_orders FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- staff - anon SELECT retained: the public booking form renders the therapist
-- picker (app/booking/page.tsx:213). Therapist names are already shown to
-- customers on that page, so this exposes nothing new.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view staff" ON staff;
CREATE POLICY "Public can view staff"
ON staff FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage staff" ON staff;
CREATE POLICY "Authenticated users can manage staff"
ON staff FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- products - staff only. No public page renders it; the only reader is
-- lib/actions/products.ts via components/bookings/BookingForm.tsx, which is
-- rendered exclusively by protected /dashboard routes.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage products" ON products;
CREATE POLICY "Authenticated users can manage products"
ON products FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- Revenue report views.
--
-- Both are owned by `postgres` (confirmed via pg_views.viewowner), so without
-- security_invoker they execute with owner privileges and bypass the RLS
-- enabled above on bookings and bookings_import.
--
-- security_invoker requires PostgreSQL 15+. Verify with `show server_version;`
-- before running: on PG14 or older these ALTER VIEW statements fail, and the
-- REVOKE statements alone would then be the only protection.
--
-- No application code reads either view - a repo-wide grep across app/,
-- components/ and lib/ returns no matches - so this breaks nothing today.
-- ─────────────────────────────────────────────────────────────
ALTER VIEW public.daily_revenue_report SET (security_invoker = on);
ALTER VIEW public.monthly_revenue_report SET (security_invoker = on);

REVOKE ALL ON public.daily_revenue_report FROM anon;
REVOKE ALL ON public.monthly_revenue_report FROM anon;
