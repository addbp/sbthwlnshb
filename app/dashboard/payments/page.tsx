'use client'

// app/dashboard/payments/page.tsx — Payment Ledger
// Fix 1: date format is "May 1, 2025" — regex updated accordingly.
// Fix 2: gcash_bank_ref_no removed — column does not exist in this table.
//        Add it back once the real reference-number column name is confirmed.
//
// bookings_import columns used:
//   date TEXT "May 1, 2025" · client_name · service · therapist
//   service_amount → Amount · received_payment → Received
//   payment_method · category

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
const MONTH_ABBR = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

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
  const d = parseImportDate(raw)
  return d
    ? d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
    : raw || '—'
}

/** Returns { year, month (0-based) } for a date string, or null */
function getYearMonth(raw: string): { year: number; month: number } | null {
  const d = parseImportDate(raw)
  return d ? { year: d.getFullYear(), month: d.getMonth() } : null
}

const fmt = (n: number) => '₱' + n.toLocaleString('en-PH')
const fmtK = (n: number) =>
  n >= 1_000_000 ? `₱${(n / 1_000_000).toFixed(1)}M`
    : n >= 1000 ? `₱${(n / 1000).toFixed(1)}k`
      : fmt(n)

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface TxRow {
  _key: string
  date: string
  client: string
  service: string
  therapist: string
  amount: number   // service_amount
  received: number   // received_payment
  method: string   // payment_method
  category: string
}

// ─────────────────────────────────────────────────────────────
// PAGINATED FETCH  — no gcash_bank_ref_no (column does not exist)
// ─────────────────────────────────────────────────────────────
async function fetchAllTransactions(
  supabase: ReturnType<typeof createClient>,
): Promise<TxRow[]> {
  // gcash_bank_ref_no is intentionally omitted — add back once column is confirmed
  const COLS = 'date,client_name,service,therapist,service_amount,received_payment,payment_method,category'
  const PAGE = 1000
  const all: TxRow[] = []
  let from = 0

  for (; ;) {
    const { data, error } = await supabase
      .from('bookings_import')
      .select(COLS)
      .range(from, from + PAGE - 1)

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break

    data.forEach((r, i) => {
      all.push({
        _key: `${r.client_name}-${r.date}-${from + i}`,
        date: String(r.date ?? ''),
        client: String(r.client_name ?? 'Guest'),
        service: String(r.service ?? '—'),
        therapist: String(r.therapist ?? '—'),
        amount: Number(r.service_amount ?? 0),
        received: Number(r.received_payment ?? 0),
        method: String(r.payment_method ?? '—'),
        category: String(r.category ?? '—'),
      })
    })

    if (data.length < PAGE) break
    from += PAGE
    if (from > 200_000) break
  }

  // Sort newest-first by parsed date
  all.sort((a, b) => {
    const da = parseImportDate(a.date)?.getTime() ?? 0
    const db = parseImportDate(b.date)?.getTime() ?? 0
    return db - da
  })

  return all
}

// ─────────────────────────────────────────────────────────────
// MONTH OPTIONS  — derived from actual data
// ─────────────────────────────────────────────────────────────
function getMonthOptions(rows: TxRow[]): { label: string; key: string }[] {
  const seen = new Set<string>()
  const opts: { label: string; key: string }[] = []
  for (const r of rows) {
    const ym = getYearMonth(r.date)
    if (!ym) continue
    const key = `${ym.year}-${ym.month}`
    if (!seen.has(key)) {
      seen.add(key)
      opts.push({ key, label: `${MONTH_ABBR[ym.month]} ${ym.year}` })
    }
  }
  return opts
}

// ─────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────
function Shim({ w = '100%', h = 13, r = 5 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg,#EDE8E0 0%,#E0D8CE 50%,#EDE8E0 100%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite'
    }}
    />
  )
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default function PaymentsPage() {
  const supabase = useRef(createClient()).current

  const [allTx, setAllTx] = useState<TxRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [methodFilt, setMethodFilt] = useState('all')
  const [monthFilt, setMonthFilt] = useState('all')

  const loadData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const rows = await fetchAllTransactions(supabase)
      setAllTx(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // Unique payment methods
  const methods = Array.from(new Set(allTx.map(t => t.method).filter(m => m && m !== '—')))

  // Month dropdown options derived from real data
  const monthOptions = getMonthOptions(allTx)

  // Apply all filters
  const filtered = allTx.filter(t => {
    if (methodFilt !== 'all' && t.method !== methodFilt) return false
    if (monthFilt !== 'all') {
      const [yr, mo] = monthFilt.split('-').map(Number)
      const ym = getYearMonth(t.date)
      if (!ym || ym.year !== yr || ym.month !== mo) return false
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!t.client.toLowerCase().includes(q)
        && !t.service.toLowerCase().includes(q)
        && !t.therapist.toLowerCase().includes(q)) return false
    }
    return true
  })

  const totalReceived = filtered.reduce((a, t) => a + t.received, 0)
  const totalAmount = filtered.reduce((a, t) => a + t.amount, 0)

  const CARET = `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23C58F3B' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`

  return (
    <>
      <style>{`@keyframes shimmer{from{background-position:-200% center}to{background-position:200% center}}`}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 26, fontFamily: "'Inter',system-ui,sans-serif" }}>

        {/* ── Header ─────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Transaction Ledger</p>
            <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Payments</h2>
            {allTx.length > 0 && !loading && (
              <p style={{ fontSize: 12, color: 'rgba(26,26,26,0.38)', margin: '3px 0 0' }}>
                {allTx.length.toLocaleString()} total records
              </p>
            )}
          </div>
          <button onClick={loadData} disabled={loading}
            style={{ padding: '0 16px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Inter',system-ui,sans-serif" }}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {/* ── KPI strip ────────────────────────────────────── */}
        {!loading && !error && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(175px,100%),1fr))', gap: 12 }}>
            {[
              { label: 'Received', value: fmtK(totalReceived), sub: `${filtered.length.toLocaleString()} transactions`, dark: true },
              { label: 'Service Amount', value: fmtK(totalAmount), sub: 'Billed amount', dark: false },
              { label: 'Avg per Tx', value: fmt(filtered.length > 0 ? Math.round(totalReceived / filtered.length) : 0), sub: 'Received ÷ count', dark: false },
              { label: 'Showing', value: filtered.length.toLocaleString(), sub: `of ${allTx.length.toLocaleString()} total`, dark: false },
            ].map(t => {
              const bg = t.dark ? '#1A1A1A' : '#FFFFFF'
              const vCol = t.dark ? '#F3E9E0' : '#1A1A1A'
              const lCol = t.dark ? 'rgba(243,233,224,0.50)' : '#7A6E65'
              const sCol = t.dark ? 'rgba(243,233,224,0.38)' : '#9A8E85'
              return (
                <div key={t.label} style={{ position: 'relative', overflow: 'hidden', backgroundColor: bg, backgroundImage: 'none', border: `1px solid ${t.dark ? 'rgba(197,143,59,0.20)' : 'rgba(26,26,26,0.09)'}`, borderRadius: 14, padding: '18px 18px', boxShadow: t.dark ? '0 5px 18px rgba(0,0,0,0.16)' : '0 2px 8px rgba(0,0,0,0.05)' }}>
                  {!t.dark && <div style={{ position: 'absolute', top: 0, left: 12, right: 12, height: 2, backgroundColor: '#C58F3B', opacity: 0.38, borderRadius: '0 0 2px 2px' }} />}
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: lCol, margin: '0 0 8px' }}>{t.label}</p>
                  <p style={{ fontSize: 'clamp(1.3rem,2.2vw,1.7rem)', fontWeight: 700, lineHeight: 1, color: vCol, margin: '0 0 4px', fontFamily: "'Inter',system-ui,sans-serif" }}>{t.value}</p>
                  <p style={{ fontSize: 11, color: sCol, margin: 0 }}>{t.sub}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Filters ──────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Month dropdown */}
          <select value={monthFilt} onChange={e => setMonthFilt(e.target.value)}
            style={{ height: 36, padding: '0 36px 0 12px', border: '1px solid rgba(26,26,26,0.16)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#1A1A1A', backgroundColor: '#FFFFFF', fontFamily: "'Inter',system-ui,sans-serif", cursor: 'pointer', outline: 'none', appearance: 'none', WebkitAppearance: 'none', backgroundImage: CARET, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
            <option value="all">All Months ({allTx.length.toLocaleString()})</option>
            {monthOptions.map(opt => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>

          {/* Method chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['all', ...methods].map(m => (
              <button key={m} onClick={() => setMethodFilt(m)}
                style={{ padding: '0 12px', height: 32, borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', border: '1px solid', transition: 'all 130ms ease', fontFamily: "'Inter',system-ui,sans-serif", backgroundColor: methodFilt === m ? '#1A1A1A' : 'transparent', borderColor: methodFilt === m ? '#1A1A1A' : 'rgba(26,26,26,0.16)', color: methodFilt === m ? '#C58F3B' : 'rgba(26,26,26,0.42)' }}>
                {m === 'all' ? 'All Methods' : m}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginLeft: 'auto' }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(26,26,26,0.35)', pointerEvents: 'none' }}>
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 12l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input type="search" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Client, service…"
              style={{ height: 36, paddingLeft: 32, paddingRight: 12, border: '1px solid rgba(26,26,26,0.14)', borderRadius: 8, fontSize: 13, color: '#1A1A1A', backgroundColor: '#FFFFFF', fontFamily: "'Inter',system-ui,sans-serif", outline: 'none', minWidth: 200 }}
            />
          </div>
        </div>

        {/* ── Table ────────────────────────────────────────── */}
        {loading ? (
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#F8F4EE', padding: '11px 16px', display: 'flex', gap: 16, borderBottom: '1px solid rgba(26,26,26,0.09)' }}>
              {[70, 110, 130, 110, 80, 80, 90].map((w, i) => <Shim key={i} w={w} h={9} />)}
            </div>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{ padding: '13px 16px', display: 'flex', gap: 16, alignItems: 'center', borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                {[70, 110, 130, 110, 80, 80, 90].map((w, j) => <Shim key={j} w={w} h={12} />)}
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ padding: '14px 18px', backgroundColor: 'rgba(139,58,58,0.09)', border: '1px solid rgba(139,58,58,0.28)', borderRadius: 11, color: '#8B3A3A', fontSize: 14 }}>
            {error}
            <button onClick={loadData} style={{ marginLeft: 12, padding: '4px 12px', borderRadius: 7, backgroundColor: 'rgba(139,58,58,0.14)', border: '1px solid rgba(139,58,58,0.28)', color: '#8B3A3A', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Retry</button>
          </div>
        ) : (
          <div style={{ backgroundColor: '#FFFFFF', backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, boxShadow: '0 3px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)' }}>
                    {['Date', 'Client', 'Service', 'Therapist', 'Amount', 'Received', 'Method'].map(h => (
                      <th key={h} style={{ padding: '10px 13px', textAlign: 'left', fontFamily: "'Inter',system-ui,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.11em', textTransform: 'uppercase', color: '#C58F3B', backgroundColor: '#F8F4EE', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 1000).map((t, i) => (
                    <tr key={t._key}
                      style={{ borderBottom: i < Math.min(filtered.length, 1000) - 1 ? '1px solid rgba(26,26,26,0.06)' : 'none', transition: 'background 120ms' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(197,143,59,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                      <td style={{ padding: '11px 13px', fontSize: 12, color: 'rgba(26,26,26,0.55)', whiteSpace: 'nowrap', fontFamily: "'Inter',system-ui,sans-serif" }}>{fmtDate(t.date)}</td>
                      <td style={{ padding: '11px 13px', fontWeight: 600, color: '#1A1A1A', fontFamily: "'Inter',system-ui,sans-serif" }}>{t.client}</td>
                      <td style={{ padding: '11px 13px', color: '#2A2A2A', maxWidth: 160, fontFamily: "'Inter',system-ui,sans-serif" }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.service}</div>
                      </td>
                      <td style={{ padding: '11px 13px', color: '#4A4A4A', whiteSpace: 'nowrap', fontFamily: "'Inter',system-ui,sans-serif" }}>{t.therapist}</td>
                      <td style={{ padding: '11px 13px', color: 'rgba(26,26,26,0.65)', whiteSpace: 'nowrap', fontFamily: "'Inter',system-ui,sans-serif" }}>{fmt(t.amount)}</td>
                      <td style={{ padding: '11px 13px', fontWeight: 700, color: '#1A1A1A', whiteSpace: 'nowrap', fontFamily: "'Inter',system-ui,sans-serif", fontSize: 15 }}>{fmt(t.received)}</td>
                      <td style={{ padding: '11px 13px', whiteSpace: 'nowrap', fontFamily: "'Inter',system-ui,sans-serif" }}>
                        <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', backgroundColor: 'rgba(197,143,59,0.09)', color: '#A07530', border: '1px solid rgba(197,143,59,0.25)' }}>
                          {t.method || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: '36px 14px', textAlign: 'center', color: '#9A8E85', fontStyle: 'italic', fontFamily: "'Inter',system-ui,sans-serif" }}>
                        No transactions match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', backgroundColor: '#F8F4EE', borderTop: '1px solid rgba(26,26,26,0.07)', flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#9A8E85', fontFamily: "'Inter',system-ui,sans-serif" }}>
                {filtered.length > 1000
                  ? `Showing first 1,000 of ${filtered.length.toLocaleString()} filtered`
                  : `${filtered.length.toLocaleString()} transactions`}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', fontFamily: "'Inter',system-ui,sans-serif" }}>
                Received: <strong style={{ color: '#C58F3B' }}>{fmtK(totalReceived)}</strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}