'use client'

// app/dashboard/clients/page.tsx
//
// Fix 3: source of truth is now the dedicated `clients` table.
//   Columns: id · full_name · mobile_number · email · address
//   No more expensive bookings_import scan-and-deduplicate.
//
// History panel: queries bookings_import with
//   .ilike('client_name', client.full_name)  (case-insensitive name match)
//   because bookings_import has no mobile_number column.
//
// Fix 1: date parser updated for "May 1, 2025" format.

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────
// DATE HELPERS  — "May 1, 2025" format
// ─────────────────────────────────────────────────────────────
const MONTH_FULL: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
}

function parseImportDate(raw: string): Date | null {
  if (!raw) return null
  const m = String(raw).trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/)
  if (!m) return null
  const mon = MONTH_FULL[m[1].toLowerCase()]
  if (mon === undefined) return null
  const d = new Date(parseInt(m[3], 10), mon, parseInt(m[2], 10))
  return isNaN(d.getTime()) ? null : d
}

function fmtDate(raw: string): string {
  if (!raw) return '—'
  const d = parseImportDate(raw)
  return d
    ? d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
    : raw
}

// Compare two import-format date strings for sort — newer = lower index
function compareDates(a: string, b: string): number {
  const da = parseImportDate(a)?.getTime() ?? 0
  const db = parseImportDate(b)?.getTime() ?? 0
  return db - da  // descending
}

const fmt = (n: number) => '₱' + n.toLocaleString('en-PH')

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

/** One row from the `clients` table */
interface Client {
  id: string
  full_name: string
  mobile_number: string
  email: string
  address: string
}

/** One row from bookings_import for the history panel */
interface Visit {
  date: string
  service: string
  therapist: string
  received_payment: number
  category: string
  payment_method: string
}

/** Aggregated stats computed from Visit[] after the history load */
interface VisitStats {
  visitCount: number
  totalSpend: number
  lastVisit: string
  topService: string
  topTherapist: string
}

function computeStats(visits: Visit[]): VisitStats {
  const totalSpend = visits.reduce((a, v) => a + v.received_payment, 0)

  const tMap: Record<string, number> = {}
  const sMap: Record<string, number> = {}
  for (const v of visits) {
    if (v.therapist && v.therapist !== '—') tMap[v.therapist] = (tMap[v.therapist] ?? 0) + 1
    if (v.service && v.service !== '—') sMap[v.service] = (sMap[v.service] ?? 0) + 1
  }

  return {
    visitCount: visits.length,
    totalSpend,
    lastVisit: visits[0]?.date ?? '',   // array is already sorted newest-first
    topService: Object.entries(sMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—',
    topTherapist: Object.entries(tMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—',
  }
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
}
const PALETTE = ['#3D7A4A', '#2A6A8A', '#A07530', '#6A3D7A', '#7A3D40', '#3D5A7A']
function avatarColor(name: string) {
  return PALETTE[((name.charCodeAt(0) ?? 65) - 65) % PALETTE.length]
}

// ─────────────────────────────────────────────────────────────
// SKELETON ATOMS
// ─────────────────────────────────────────────────────────────
function Shim({ w = '100%', h = 13, r = 5 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg,#EDE8E0 0%,#E0D8CE 50%,#EDE8E0 100%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite'
    }} />
  )
}

// ─────────────────────────────────────────────────────────────
// HISTORY PANEL  (slide-in from right)
// Loads visit history from bookings_import, matched by client name.
// ─────────────────────────────────────────────────────────────
function ClientHistoryPanel({ client, onClose }: { client: Client; onClose: () => void }) {
  const supabase = useRef(createClient()).current

  const [visits, setVisits] = useState<Visit[]>([])
  const [stats, setStats] = useState<VisitStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        // Note: matching by client_name because bookings_import has no mobile column.
        // .ilike = case-insensitive exact match (no wildcards).
        const { data, error: dbErr } = await supabase
          .from('bookings_import')
          .select('date,service,therapist,received_payment,category,payment_method')
          .ilike('client_name', client.full_name)
          .limit(200)

        if (dbErr) throw new Error(dbErr.message)

        const mapped: Visit[] = (data ?? []).map(r => ({
          date: String(r.date ?? ''),
          service: String(r.service ?? '—'),
          therapist: String(r.therapist ?? '—'),
          received_payment: Number(r.received_payment ?? 0),
          category: String(r.category ?? ''),
          payment_method: String(r.payment_method ?? '—'),
        })).sort((a, b) => compareDates(a.date, b.date))

        setVisits(mapped)
        setStats(computeStats(mapped))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [client.full_name, supabase])

  const ac = avatarColor(client.full_name)

  return (
    <>
      <style>{`
        @keyframes sIn { from{opacity:0;transform:translateX(32px)} to{opacity:1;transform:none} }
        @keyframes shimmer { from{background-position:-200% center} to{background-position:200% center} }
      `}</style>
      <div
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
        style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(10,8,6,0.45)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'flex-end' }}
      >
        <div style={{ width: '100%', maxWidth: 480, backgroundColor: '#F9F4EB', backgroundImage: 'none', height: '100%', overflowY: 'auto', boxShadow: '-24px 0 60px rgba(0,0,0,0.20)', animation: 'sIn 280ms cubic-bezier(0.22,1,0.36,1)', fontFamily: "'Inter',system-ui,sans-serif" }}>

          {/* Sticky header */}
          <div style={{ position: 'sticky', top: 0, backgroundColor: '#F9F4EB', borderBottom: '1px solid rgba(26,26,26,0.10)', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14, zIndex: 1 }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', backgroundColor: ac, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 21, fontWeight: 400, flexShrink: 0 }}>
              {initials(client.full_name)}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 21, fontWeight: 400, color: '#1A1A1A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.full_name}</h3>
              <p style={{ fontSize: 11, color: 'rgba(26,26,26,0.45)', margin: 0 }}>{client.mobile_number || 'No mobile'}</p>
            </div>
            <button onClick={onClose}
              style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(26,26,26,0.14)', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(26,26,26,0.40)', flexShrink: 0 }}
              aria-label="Close">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Client info from clients table */}
            <div style={{ backgroundColor: '#FFFFFF', backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Mobile', value: client.mobile_number || '—' },
                { label: 'Email', value: client.email || '—' },
                { label: 'Address', value: client.address || '—' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.38)', minWidth: 56 }}>{row.label}</span>
                  <span style={{ fontSize: 13, color: '#1A1A1A', flex: 1, wordBreak: 'break-word' }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Visit stats — computed from bookings_import */}
            {!loading && stats && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                {[
                  { label: 'Total Spend', value: fmt(stats.totalSpend), big: true },
                  { label: 'Visits', value: stats.visitCount.toLocaleString(), big: true },
                  { label: 'Fave Service', value: stats.topService, small: true },
                  { label: 'Fave Therapist', value: stats.topTherapist, small: true },
                  { label: 'Last Visit', value: fmtDate(stats.lastVisit), small: true },
                ].map(s => (
                  <div key={s.label} style={{ backgroundColor: '#FFFFFF', backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 10, padding: '11px 13px' }}>
                    <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.40)', margin: '0 0 3px' }}>{s.label}</p>
                    <p style={{ fontSize: s.big ? 19 : 13, fontWeight: s.big ? 700 : 500, color: '#1A1A1A', margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Visit history list */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(197,143,59,0.65)', margin: '0 0 10px' }}>
                Visit History
              </p>

              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ backgroundColor: '#FFFFFF', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                      <Shim w="60%" h={13} /> <Shim w="40%" h={10} />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div style={{ padding: '11px 13px', backgroundColor: 'rgba(139,58,58,0.09)', border: '1px solid rgba(139,58,58,0.25)', borderRadius: 10, color: '#8B3A3A', fontSize: 13 }}>{error}</div>
              ) : visits.length === 0 ? (
                <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.38)', fontStyle: 'italic' }}>
                  No visit records found for this client name in bookings_import.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {visits.map((v, i) => (
                    <div key={i} style={{ backgroundColor: '#FFFFFF', backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.3 }}>{v.service}</span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', flexShrink: 0 }}>{fmt(v.received_payment)}</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'rgba(26,26,26,0.50)' }}>{v.therapist}</span>
                        <span style={{ fontSize: 10, color: 'rgba(26,26,26,0.25)' }}>·</span>
                        <span style={{ fontSize: 11, color: 'rgba(26,26,26,0.50)' }}>{fmtDate(v.date)}</span>
                        {v.category ? (
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#A07530', padding: '2px 7px', borderRadius: 99, backgroundColor: 'rgba(197,143,59,0.10)', border: '1px solid rgba(197,143,59,0.25)' }}>
                            {v.category}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {visits.length >= 200 && (
                    <p style={{ fontSize: 11, color: 'rgba(26,26,26,0.35)', textAlign: 'center', fontStyle: 'italic', margin: 0 }}>Showing most recent 200 visits</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// PAGE — fetches directly from `clients` table
// ─────────────────────────────────────────────────────────────
export default function ClientsPage() {
  const supabase = useRef(createClient()).current

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Client | null>(null)
  const [totalCount, setTotalCount] = useState(0)

  // Paginated fetch from `clients` table
  const loadClients = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const PAGE = 1000
      const all: Client[] = []
      let from = 0

      for (; ;) {
        const { data, error: dbErr } = await supabase
          .from('clients')
          .select('id,full_name,mobile_number,email,address')
          .range(from, from + PAGE - 1)
          .order('full_name', { ascending: true })

        if (dbErr) throw new Error(dbErr.message)
        if (!data || data.length === 0) break
        all.push(...(data as Client[]))
        if (data.length < PAGE) break
        from += PAGE
        if (from > 200_000) break
      }

      setClients(all)
      setTotalCount(all.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadClients() }, [loadClients])

  const filtered = clients.filter(c => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return c.full_name.toLowerCase().includes(q)
      || c.mobile_number.includes(q)
      || c.email.toLowerCase().includes(q)
  })

  return (
    <>
      {selected && (
        <ClientHistoryPanel client={selected} onClose={() => setSelected(null)} />
      )}
      <style>{`@keyframes shimmer{from{background-position:-200% center}to{background-position:200% center}}`}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 26, fontFamily: "'Inter',system-ui,sans-serif" }}>

        {/* ── Header ─────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Guest Directory</p>
            <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Clients</h2>
            {totalCount > 0 && !loading && (
              <p style={{ fontSize: 12, color: 'rgba(26,26,26,0.38)', margin: '3px 0 0' }}>
                {totalCount.toLocaleString()} clients in directory
              </p>
            )}
          </div>
          <button onClick={loadClients} disabled={loading}
            style={{ padding: '0 16px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Inter',system-ui,sans-serif" }}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {/* ── Stats strip ──────────────────────────────────── */}
        {!loading && !error && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(160px,100%),1fr))', gap: 12 }}>
            {[
              { label: 'Total Clients', value: totalCount.toLocaleString(), sub: 'In directory' },
              { label: 'With Mobile', value: clients.filter(c => c.mobile_number).length.toLocaleString(), sub: 'Have a phone number' },
              { label: 'With Email', value: clients.filter(c => c.email).length.toLocaleString(), sub: 'Have an email address' },
              { label: 'Search Results', value: filtered.length.toLocaleString(), sub: search ? `matching "${search}"` : 'All clients' },
            ].map(t => (
              <div key={t.label} style={{ backgroundColor: '#FFFFFF', backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 13, padding: '14px 16px', position: 'relative', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ position: 'absolute', top: 0, left: 13, right: 13, height: 2, backgroundColor: '#C58F3B', opacity: 0.40, borderRadius: '0 0 2px 2px' }} />
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 5px' }}>{t.label}</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: '#1A1A1A', margin: '0 0 2px', lineHeight: 1 }}>{t.value}</p>
                <p style={{ fontSize: 11, color: '#9A8E85', margin: 0 }}>{t.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Search ───────────────────────────────────────── */}
        <div style={{ position: 'relative' }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none"
            style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(26,26,26,0.35)', pointerEvents: 'none' }}>
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 12l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="search" value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, mobile, or email…"
            style={{ width: '100%', height: 42, paddingLeft: 36, paddingRight: 16, border: '1px solid rgba(26,26,26,0.14)', borderRadius: 9, fontSize: 14, color: '#1A1A1A', backgroundColor: '#FFFFFF', fontFamily: "'Inter',system-ui,sans-serif", outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* ── Client list ──────────────────────────────────── */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 13, padding: '15px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(90deg,#EDE8E0 0%,#E0D8CE 50%,#EDE8E0 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <Shim w="55%" h={14} /> <Shim w="40%" h={10} />
                </div>
              </div>
            ))}
            <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(26,26,26,0.38)', fontStyle: 'italic', margin: 0 }}>
              Loading client directory…
            </p>
          </div>
        ) : error ? (
          <div style={{ padding: '14px 18px', backgroundColor: 'rgba(139,58,58,0.09)', border: '1px solid rgba(139,58,58,0.28)', borderRadius: 11, color: '#8B3A3A', fontSize: 14 }}>
            {error}
            <button onClick={loadClients} style={{ marginLeft: 12, padding: '4px 12px', borderRadius: 7, backgroundColor: 'rgba(139,58,58,0.14)', border: '1px solid rgba(139,58,58,0.28)', color: '#8B3A3A', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '44px 24px' }}>
            <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 22, fontWeight: 400, color: '#1A1A1A', margin: '0 0 8px' }}>
              {clients.length === 0 ? 'No clients found' : 'No results'}
            </p>
            <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.40)', margin: 0 }}>
              {clients.length === 0
                ? 'The clients table is empty or could not be reached.'
                : `No client matches "${search}".`}
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(c => {
                const ac = avatarColor(c.full_name)
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelected(c)}
                    style={{ backgroundColor: '#FFFFFF', backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 13, padding: '14px 17px', display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer', transition: 'all 200ms ease', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(197,143,59,0.30)'; el.style.boxShadow = '0 5px 20px rgba(0,0,0,0.08)'; el.style.transform = 'translateY(-1px)' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(26,26,26,0.09)'; el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; el.style.transform = '' }}
                  >
                    {/* Avatar */}
                    <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: ac, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 18, fontWeight: 400, flexShrink: 0, boxShadow: `0 0 0 3px ${ac}28` }}>
                      {initials(c.full_name)}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.full_name}
                      </p>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {c.mobile_number && (
                          <span style={{ fontSize: 12, color: 'rgba(26,26,26,0.50)' }}>{c.mobile_number}</span>
                        )}
                        {c.email && (
                          <span style={{ fontSize: 12, color: 'rgba(26,26,26,0.38)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{c.email}</span>
                        )}
                      </div>
                      {c.address && (
                        <p style={{ fontSize: 11, color: 'rgba(26,26,26,0.30)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.address}</p>
                      )}
                    </div>

                    {/* Arrow */}
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
                      style={{ flexShrink: 0, color: 'rgba(26,26,26,0.22)' }}>
                      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )
              })}
            </div>
            <p style={{ fontSize: 11, color: 'rgba(26,26,26,0.30)', textAlign: 'center', margin: 0 }}>
              {filtered.length.toLocaleString()} of {clients.length.toLocaleString()} clients
            </p>
          </>
        )}
      </div>
    </>
  )
}