import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// Waiver autocomplete lookup.
//
// Replaces the client-side fetch in app/waiver/page.tsx:136-192, which pulled
// bookings + bookings_import + clients with select('*') under the ANON key on a
// public page — the entire customer ledger into the browser.
//
// This route runs server-side with the service-role key, so it keeps working
// after 005_enable_rls.sql denies anon SELECT on those tables. It returns ONLY
// the four fields the autocomplete renders (name, service, branch, date) — no
// phone, no email, no price, no payment status, no notes, no health data.
//
// SECURITY NOTE: this is a PUBLIC route (middleware.ts matches only
// ['/dashboard/:path*', '/login']). It is a name-lookup endpoint by design, so
// it is guarded by a minimum query length and a hard result cap. It must never
// be widened to select('*') or to return contact columns.
// ─────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

const MIN_QUERY_LENGTH = 3
const MAX_ROWS_PER_TABLE = 100
const MAX_RESULTS = 60

type LookupRow = {
  name: string
  service: string
  branch: string
  date: string | null
}

function serviceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()

  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ results: [] })
  }

  const supabase = serviceRoleClient()
  if (!supabase) {
    console.error('[waiver-lookup] SUPABASE_SERVICE_ROLE_KEY is not configured')
    return NextResponse.json({ error: 'Lookup unavailable.' }, { status: 503 })
  }

  // Escape PostgREST ilike wildcards so a typed % or _ cannot broaden the match.
  const esc = (s: string) => s.replace(/[%_]/g, (c) => `\\${c}`)

  // Match every typed token independently (AND), not the whole string as one
  // substring. Typing "ian fernandez" must still match "Ian A. Fernandez", which
  // a single ilike '%ian fernandez%' would miss.
  const tokens = q.split(/\s+/).filter(Boolean).map((t) => `%${esc(t)}%`)

  // Exact, case-insensitive full-name match for the visit count.
  const exactName = esc(q)

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const andTokens = (builder: any, column: string) =>
      tokens.reduce((acc, t) => acc.ilike(column, t), builder)

    const [liveRes, importRes, clientRes, liveCount, importCount] = await Promise.all([
      andTokens(
        supabase.from('bookings').select('client_name, service_name, branch, appointment_date'),
        'client_name',
      ).limit(MAX_ROWS_PER_TABLE),
      andTokens(
        supabase.from('bookings_import').select('client_name, service, branch, date'),
        'client_name',
      ).limit(MAX_ROWS_PER_TABLE),
      andTokens(
        supabase.from('clients').select('full_name'),
        'full_name',
      ).limit(MAX_ROWS_PER_TABLE),
      supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .ilike('client_name', exactName),
      supabase
        .from('bookings_import')
        .select('*', { count: 'exact', head: true })
        .ilike('client_name', exactName),
    ])

    const rows: LookupRow[] = []

    if (liveRes.error) console.error('[waiver-lookup] bookings:', liveRes.error.message)
    else for (const r of liveRes.data ?? []) {
      if (!r.client_name) continue
      rows.push({
        name: String(r.client_name).trim(),
        service: String(r.service_name || 'Spa Service'),
        branch: String(r.branch || ''),
        date: r.appointment_date ? String(r.appointment_date) : null,
      })
    }

    if (importRes.error) console.error('[waiver-lookup] bookings_import:', importRes.error.message)
    else for (const r of importRes.data ?? []) {
      if (!r.client_name) continue
      rows.push({
        name: String(r.client_name).trim(),
        service: String(r.service || 'Spa Service'),
        branch: String(r.branch || ''),
        date: r.date ? String(r.date) : null,
      })
    }

    // clients contributes name suggestions only — it carries no service history.
    if (clientRes.error) console.error('[waiver-lookup] clients:', clientRes.error.message)
    else for (const r of clientRes.data ?? []) {
      if (!r.full_name) continue
      rows.push({
        name: String(r.full_name).trim(),
        service: 'Spa Service',
        branch: '',
        date: null,
      })
    }

    rows.sort((a, b) => {
      const at = a.date ? Date.parse(a.date) : 0
      const bt = b.date ? Date.parse(b.date) : 0
      return (Number.isNaN(bt) ? 0 : bt) - (Number.isNaN(at) ? 0 : at)
    })

    // Exact-match visit count, independent of MAX_RESULTS truncation. `head: true`
    // returns no rows — only the count — so this leaks nothing.
    if (liveCount.error) console.error('[waiver-lookup] bookings count:', liveCount.error.message)
    if (importCount.error) console.error('[waiver-lookup] bookings_import count:', importCount.error.message)
    const visitCount = (liveCount.count ?? 0) + (importCount.count ?? 0)

    return NextResponse.json({ results: rows.slice(0, MAX_RESULTS), visitCount })
  } catch (err) {
    console.error('[waiver-lookup] unexpected error:', err)
    return NextResponse.json({ error: 'Lookup failed.' }, { status: 500 })
  }
}
