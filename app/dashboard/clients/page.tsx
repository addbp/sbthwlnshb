'use client'

// app/dashboard/clients/page.tsx
// FIX: Supabase default row limit is 1000. fetchAllPaginated() loops
//   in 1000-row chunks to retrieve all 10,200 records.
// FIX: No separate 'clients' table — deduplication is done in JS
//   by normalising client_name to lowercase as the identity key.

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────────────────────
const MONTHS_MAP: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

function parseImportDate(raw: string): Date | null {
  const m = String(raw ?? '').trim().match(/^(\d{1,2})[-\/]([A-Za-z]{3,})[-\/](\d{2,4})$/)
  if (!m) return null
  const day = parseInt(m[1], 10)
  const mon = MONTHS_MAP[m[2].slice(0, 3).toLowerCase()]
  if (mon === undefined) return null
  const yr = parseInt(m[3], 10)
  const d = new Date(yr < 100 ? 2000 + yr : yr, mon, day)
  return isNaN(d.getTime()) ? null : d
}

function fmtDate(raw: string): string {
  if (!raw) return '—'
  const d = parseImportDate(raw)
  return d ? d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : raw
}

// Compare two import-format dates: positive = a is newer
function compareDates(a: string, b: string): number {
  const da = parseImportDate(a)?.getTime() ?? 0
  const db = parseImportDate(b)?.getTime() ?? 0
  return db - da   // descending (newest first)
}

const fmt = (n: number) => '₱' + n.toLocaleString('en-PH')

// ─────────────────────────────────────────────────────────────
// PAGINATED FETCH — key fix for 10,200 rows
// Loops in 1000-row chunks until all records are retrieved.
// ─────────────────────────────────────────────────────────────
async function fetchAllPaginated(
  supabase: ReturnType<typeof createClient>,
): Promise<Record<string, unknown>[]> {
  const PAGE = 1000
  const COLS = 'client_name,date,service,therapist,received_payment,category,customer_type'
  const all: Record<string, unknown>[] = []
  let from = 0

  for (; ;) {
    const { data, error } = await supabase
      .from('bookings_import')
      .select(COLS)
      .range(from, from + PAGE - 1)

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all.push(...data as Record<string, unknown>[])
    if (data.length < PAGE) break
    from += PAGE
    if (from > 200_000) break // safety
  }

  return all
}

// ─────────────────────────────────────────────────────────────
// CLIENT AGGREGATION
// Deduplicates by normalised client_name (lowercase).
// Computes: visitCount, totalSpend, lastVisit, topService, topTherapist.
// ─────────────────────────────────────────────────────────────
interface ClientSummary {
  name: string   // display name (original casing from latest row)
  visitCount: number
  totalSpend: number
  lastVisit: string   // raw import date
  topService: string
  topTherapist: string
  customerType: string
}

// Typed shape for each history-panel row — replaces Record<string,unknown>
// so TypeScript can validate the JSX conditionals below.
interface Visit {
  date: string
  service: string
  therapist: string
  received_payment: number
  category: string   // '' = no category
  gcash_bank_ref_no: string   // '' = no ref
  payment_method: string
}

function aggregateClients(rows: Record<string, unknown>[]): ClientSummary[] {
  const map: Record<string, Record<string, unknown>[]> = {}

  for (const r of rows) {
    const key = String(r.client_name ?? '').trim().toLowerCase() || '_unknown_'
      ; (map[key] ?? (map[key] = [])).push(r)
  }

  return Object.values(map).map(group => {
    // Sort group newest-first
    group.sort((a, b) => compareDates(String(a.date ?? ''), String(b.date ?? '')))
    const latest = group[0]

    const totalSpend = group.reduce((a, r) => a + Number(r.received_payment ?? 0), 0)

    // Most frequent therapist
    const tMap: Record<string, number> = {}
    for (const r of group) { const t = String(r.therapist ?? '').trim(); if (t && t !== '—') tMap[t] = (tMap[t] ?? 0) + 1 }
    const topTherapist = Object.entries(tMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

    // Most frequent service
    const sMap: Record<string, number> = {}
    for (const r of group) { const s = String(r.service ?? '').trim(); if (s && s !== '—') sMap[s] = (sMap[s] ?? 0) + 1 }
    const topService = Object.entries(sMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

    return {
      name: String(latest.client_name ?? 'Guest'),
      visitCount: group.length,
      totalSpend,
      lastVisit: String(latest.date ?? ''),
      topService,
      topTherapist,
      customerType: String(latest.customer_type ?? '—'),
    }
  }).sort((a, b) => b.visitCount - a.visitCount)  // most frequent clients first
}

// ─────────────────────────────────────────────────────────────
// VISIT HISTORY PANEL  (slide-in from right)
// ─────────────────────────────────────────────────────────────
function ClientHistoryPanel({ client, onClose }: { client: ClientSummary; onClose: () => void }) {
  const supabase = useRef(createClient()).current
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data, error: dbErr } = await supabase
          .from('bookings_import')
          .select('date,service,therapist,received_payment,net_sales,category,customer_type,payment_method,gcash_bank_ref_no')
          .ilike('client_name', client.name)   // case-insensitive name match
          .order('date', { ascending: false })
          .limit(200)

        if (dbErr) throw new Error(dbErr.message)
        // Map to typed Visit objects, then sort newest-first
        const sorted: Visit[] = (data ?? [])
          .map(r => ({
            date: String(r.date ?? ''),
            service: String(r.service ?? '—'),
            therapist: String(r.therapist ?? '—'),
            received_payment: Number(r.received_payment ?? 0),
            category: String(r.category ?? ''),
            gcash_bank_ref_no: String(r.gcash_bank_ref_no ?? ''),
            payment_method: String(r.payment_method ?? '—'),
          }))
          .sort((a, b) => compareDates(a.date, b.date))
        setVisits(sorted)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [client.name, supabase])

  const initials = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
  const PALETTE = ['#3D7A4A', '#2A6A8A', '#A07530', '#6A3D7A', '#7A3D40', '#3D5A7A']
  const ac = PALETTE[((client.name.charCodeAt(0) ?? 65) - 65) % PALETTE.length]

  return (
    <>
      <style>{`@keyframes sIn{from{opacity:0;transform:translateX(32px)}to{opacity:1;transform:none}} @keyframes shimmer{from{background-position:-200% center}to{background-position:200% center}}`}</style>
      <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(10,8,6,0.45)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: '100%', maxWidth: 480, backgroundColor: '#F9F4EB', backgroundImage: 'none', height: '100%', overflowY: 'auto', boxShadow: '-24px 0 60px rgba(0,0,0,0.20)', animation: 'sIn 280ms cubic-bezier(0.22,1,0.36,1)', fontFamily: "'Inter',system-ui,sans-serif" }}>

          {/* Sticky header */}
          <div style={{ position: 'sticky', top: 0, backgroundColor: '#F9F4EB', borderBottom: '1px solid rgba(26,26,26,0.10)', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14, zIndex: 1 }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', backgroundColor: ac, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 21, fontWeight: 400, flexShrink: 0 }}>
              {initials(client.name)}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 21, fontWeight: 400, color: '#1A1A1A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</h3>
              <p style={{ fontSize: 11, color: 'rgba(26,26,26,0.45)', margin: 0 }}>{client.customerType} · {client.visitCount} visit{client.visitCount !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(26,26,26,0.14)', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(26,26,26,0.40)', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
            </button>
          </div>

          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              {[
                { label: 'Total Spend', value: fmt(client.totalSpend), big: true },
                { label: 'Visits', value: client.visitCount.toLocaleString(), big: true },
                { label: 'Fave Service', value: client.topService, small: true },
                { label: 'Fave Therapist', value: client.topTherapist, small: true },
                { label: 'Last Visit', value: fmtDate(client.lastVisit), small: true },
              ].map(s => (
                <div key={s.label} style={{ backgroundColor: '#FFFFFF', backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 10, padding: '11px 13px' }}>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.40)', margin: '0 0 3px' }}>{s.label}</p>
                  <p style={{ fontSize: s.big ? 19 : 13, fontWeight: s.big ? 700 : 500, color: '#1A1A1A', margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Visit history */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(197,143,59,0.65)', margin: '0 0 10px' }}>Visit History</p>

              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ backgroundColor: '#FFFFFF', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                      <div style={{ width: '60%', height: 13, borderRadius: 4, background: 'linear-gradient(90deg,#EDE8E0 0%,#E0D8CE 50%,#EDE8E0 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite' }} />
                      <div style={{ width: '40%', height: 10, borderRadius: 4, background: 'linear-gradient(90deg,#EDE8E0 0%,#E0D8CE 50%,#EDE8E0 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite' }} />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div style={{ padding: '11px 13px', backgroundColor: 'rgba(139,58,58,0.09)', border: '1px solid rgba(139,58,58,0.25)', borderRadius: 10, color: '#8B3A3A', fontSize: 13 }}>{error}</div>
              ) : visits.length === 0 ? (
                <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.38)', fontStyle: 'italic' }}>No visit history found.</p>
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
                        {v.gcash_bank_ref_no ? (
                          <span style={{ fontSize: 10, color: 'rgba(26,26,26,0.35)', fontFamily: 'monospace' }}>Ref: {v.gcash_bank_ref_no}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {visits.length >= 200 && (
                    <p style={{ fontSize: 11, color: 'rgba(26,26,26,0.35)', textAlign: 'center', fontStyle: 'italic', margin: 0 }}>Showing last 200 visits</p>
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
// PAGE
// ─────────────────────────────────────────────────────────────
export default function ClientsPage() {
  const supabase = useRef(createClient()).current

  const [clients, setClients] = useState<ClientSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ClientSummary | null>(null)
  const [loadedRows, setLoadedRows] = useState(0)

  const loadClients = useCallback(async () => {
    setLoading(true); setError(null); setLoadedRows(0)
    try {
      const rows = await fetchAllPaginated(supabase)
      setLoadedRows(rows.length)
      setClients(aggregateClients(rows))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadClients() }, [loadClients])

  const filtered = clients.filter(c => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q)
      || c.topService.toLowerCase().includes(q)
      || c.topTherapist.toLowerCase().includes(q)
  })

  const totalSpend = clients.reduce((a, c) => a + c.totalSpend, 0)
  const returningCount = clients.filter(c => c.visitCount > 1).length

  const initials = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
  const PALETTE = ['#3D7A4A', '#2A6A8A', '#A07530', '#6A3D7A', '#7A3D40', '#3D5A7A']

  return (
    <>
      {selected && <ClientHistoryPanel client={selected} onClose={() => setSelected(null)} />}
      <style>{`@keyframes shimmer{from{background-position:-200% center}to{background-position:200% center}}`}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 26, fontFamily: "'Inter',system-ui,sans-serif" }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Guest Management</p>
            <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Clients</h2>
            {loadedRows > 0 && !loading && (
              <p style={{ fontSize: 12, color: 'rgba(26,26,26,0.38)', margin: '3px 0 0' }}>
                {loadedRows.toLocaleString()} rows scanned · {clients.length.toLocaleString()} unique clients found
              </p>
            )}
          </div>
          <button onClick={loadClients} disabled={loading} style={{ padding: '0 16px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Inter',system-ui,sans-serif" }}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {/* Stats */}
        {!loading && !error && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(160px,100%),1fr))', gap: 12 }}>
            {[
              { label: 'Total Clients', value: clients.length.toLocaleString(), sub: 'Unique names' },
              { label: 'Returning', value: returningCount.toLocaleString(), sub: '2+ visits' },
              { label: 'New Clients', value: (clients.length - returningCount).toLocaleString(), sub: 'Single visit' },
              { label: 'Lifetime Value', value: '₱' + Math.round(totalSpend / 1000) + 'k', sub: 'All received payments' },
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

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(26,26,26,0.35)', pointerEvents: 'none' }}>
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 12l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, service, or therapist…"
            style={{ width: '100%', height: 42, paddingLeft: 36, paddingRight: 16, border: '1px solid rgba(26,26,26,0.14)', borderRadius: 9, fontSize: 14, color: '#1A1A1A', backgroundColor: '#FFFFFF', fontFamily: "'Inter',system-ui,sans-serif", outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 13, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(90deg,#EDE8E0 0%,#E0D8CE 50%,#EDE8E0 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ width: '55%', height: 14, borderRadius: 4, background: 'linear-gradient(90deg,#EDE8E0 0%,#E0D8CE 50%,#EDE8E0 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite' }} />
                  <div style={{ width: '38%', height: 10, borderRadius: 4, background: 'linear-gradient(90deg,#EDE8E0 0%,#E0D8CE 50%,#EDE8E0 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite' }} />
                </div>
              </div>
            ))}
            <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(26,26,26,0.38)', fontStyle: 'italic', margin: 0 }}>
              Scanning all records to find unique clients…
            </p>
          </div>
        ) : error ? (
          <div style={{ padding: '14px 18px', backgroundColor: 'rgba(139,58,58,0.09)', border: '1px solid rgba(139,58,58,0.28)', borderRadius: 11, color: '#8B3A3A', fontSize: 14 }}>
            {error} <button onClick={loadClients} style={{ marginLeft: 12, padding: '4px 12px', borderRadius: 7, backgroundColor: 'rgba(139,58,58,0.14)', border: '1px solid rgba(139,58,58,0.28)', color: '#8B3A3A', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '44px 24px' }}>
            <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 22, fontWeight: 400, color: '#1A1A1A', margin: '0 0 8px' }}>
              {clients.length === 0 ? 'No clients found' : 'No results'}
            </p>
            <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.40)', margin: 0 }}>
              {clients.length === 0 ? 'No data in bookings_import.' : `No match for "${search}".`}
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(c => {
                const ac = PALETTE[((c.name.charCodeAt(0) ?? 65) - 65) % PALETTE.length]
                return (
                  <div key={c.name} onClick={() => setSelected(c)}
                    style={{ backgroundColor: '#FFFFFF', backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 13, padding: '14px 17px', display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer', transition: 'all 200ms ease', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(197,143,59,0.30)'; el.style.boxShadow = '0 5px 20px rgba(0,0,0,0.08)'; el.style.transform = 'translateY(-1px)' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(26,26,26,0.09)'; el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; el.style.transform = '' }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: ac, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 18, fontWeight: 400, flexShrink: 0, boxShadow: `0 0 0 3px ${ac}28` }}>
                      {initials(c.name)}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                        {c.visitCount > 1 && (
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 99, backgroundColor: 'rgba(197,143,59,0.12)', color: '#C58F3B', border: '1px solid rgba(197,143,59,0.28)', flexShrink: 0 }}>
                            Returning
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(26,26,26,0.42)' }}>
                        {c.topService !== '—' && <span>{c.topService}</span>}
                        {c.topTherapist !== '—' && <> &middot; <span>{c.topTherapist}</span></>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>{fmt(c.totalSpend)}</div>
                      <div style={{ fontSize: 11, color: 'rgba(26,26,26,0.40)', marginTop: 2 }}>{c.visitCount} visit{c.visitCount !== 1 ? 's' : ''}</div>
                      {c.lastVisit && <div style={{ fontSize: 10, color: 'rgba(26,26,26,0.28)', marginTop: 2 }}>{fmtDate(c.lastVisit)}</div>}
                    </div>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: 'rgba(26,26,26,0.22)' }}>
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