import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// Membership tier lookup for the public booking form.
//
// Replaces fetchUnlimited('memberships') in app/booking/page.tsx, which pulled
// EVERY membership row with select('*') under the ANON key — client_name,
// client_mobile, client_email, tier — into the browser of anyone opening
// /booking, purely so it could match one row client-side.
//
// This route does the matching server-side with the service-role key and
// returns ONLY the tier string. No contact field ever leaves the server: the
// booking form renders nothing but `membership_tier` (page.tsx:912) and derives
// the nail discount from it (page.tsx:443-447).
//
// SECURITY NOTE: this is a PUBLIC route (middleware.ts matches only
// ['/dashboard/:path*', '/login']). It is a membership oracle by design — a
// caller who already knows an email or full mobile number can learn whether it
// belongs to a member and at what tier. That is inherent to applying the
// discount before checkout, and it is a large reduction from the current
// behaviour, which hands the entire membership table to every visitor. The
// minimum-input guard below blocks blind enumeration with partial numbers.
// ─────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

const MIN_MOBILE_LENGTH = 10

function serviceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const email = (searchParams.get('email') ?? '').trim()
  const mobile = (searchParams.get('mobile') ?? '').trim()

  // Mirror the client-side precondition: an exact email, or a mobile long
  // enough not to be a fishing expedition.
  const hasEmail = email.length > 0 && email.includes('@')
  const hasMobile = mobile.length >= MIN_MOBILE_LENGTH
  if (!hasEmail && !hasMobile) {
    return NextResponse.json({ tier: null })
  }

  const supabase = serviceRoleClient()
  if (!supabase) {
    console.error('[membership-lookup] SUPABASE_SERVICE_ROLE_KEY is not configured')
    return NextResponse.json({ error: 'Lookup unavailable.' }, { status: 503 })
  }

  // Escape PostgREST ilike wildcards so a typed % or _ cannot broaden the match.
  const esc = (s: string) => s.replace(/[%_]/g, (c) => `\\${c}`)

  try {
    // Email takes precedence, matching the original `||` ordering at
    // app/booking/page.tsx:325-327.
    if (hasEmail) {
      const { data, error } = await supabase
        .from('memberships')
        .select('membership_tier')
        .eq('status', 'Active')
        .ilike('client_email', esc(email))
        .limit(1)

      if (error) console.error('[membership-lookup] email match:', error.message)
      else if (data && data.length > 0 && data[0].membership_tier) {
        return NextResponse.json({ tier: String(data[0].membership_tier) })
      }
    }

    if (hasMobile) {
      const { data, error } = await supabase
        .from('memberships')
        .select('membership_tier')
        .eq('status', 'Active')
        .ilike('client_mobile', `%${esc(mobile)}%`)
        .limit(1)

      if (error) console.error('[membership-lookup] mobile match:', error.message)
      else if (data && data.length > 0 && data[0].membership_tier) {
        return NextResponse.json({ tier: String(data[0].membership_tier) })
      }
    }

    return NextResponse.json({ tier: null })
  } catch (err) {
    console.error('[membership-lookup] unexpected error:', err)
    return NextResponse.json({ error: 'Lookup failed.' }, { status: 500 })
  }
}
