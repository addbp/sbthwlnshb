'use client'

// app/dashboard/bookings/page.tsx — Bookings List
// bookings_import schema:
//   date (TEXT "1-May-25") · client_name · service · therapist
//   received_payment · net_sales · service_amount
//   category · customer_type · payment_method

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────────────────────
const MONTHS_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "1-May-25" → Date */
function parseImportDate(raw: string): Date | null {
  const m = String(raw ?? '').trim().match(/^(\d{1,2})[-\/]([A-Za-z]{3,})[-\/](\d{2,4})$/)
  if (!m) return null
  const day = parseInt(m[1], 10)
  const mon = MONTHS_MAP[m[2].slice(0, 3).toLowerCase()]
  if (mon === undefined) return null
  const yr = parseInt(m[3], 10)
  const year = yr < 100 ? 2000 + yr : yr
  const d = new Date(year, mon, day)
  return isNaN(d.getTime()) ? null : d
}

/** "2025-05-26" (ISO from <input type=date>) → "26-May-25" (import text format) */
function isoToImportDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')   // noon avoids UTC edge cases
  if (isNaN(d.getTime())) return iso
  return `${d.getDate()}-${MONTH_ABBR[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`
}

/** "26-May-25" → "2025-05-26" (for <input type=date value> ) */
function importDateToISO(raw: string): string {
  const d = parseImportDate(raw)
  if (!d) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDate(raw: string): string {
  const d = parseImportDate(raw)
  if (!d) return raw || '—'
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

const fmt = (n: number) => '₱' + n.toLocaleString('en-PH')

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface Booking {
  _key: string
  date: string    // raw "1-May-25"
  client: string    // client_name
  service: string
  therapist: string
  revenue: number    // received_payment
  netSales: number
  serviceAmt: number
  category: string
  customerType: string
  payMethod: string
}

// ─────────────────────────────────────────────────────────────
// MAP raw row → Booking
// ─────────────────────────────────────────────────────────────
function mapRow(row: Record<string, unknown>, idx: number): Booking {
  return {
    _key: `${row.client_name}-${row.date}-${idx}`,
    date: String(row.date ?? ''),
    client: String(row.client_name ?? 'Guest'),
    service: String(row.service ?? '—'),
    therapist: String(row.therapist ?? '—'),
    revenue: Number(row.received_payment ?? 0),
    netSales: Number(row.net_sales ?? 0),
    serviceAmt: Number(row.service_amount ?? 0),
    category: String(row.category ?? '—'),
    customerType: String(row.customer_type ?? '—'),
    payMethod: String(row.payment_method ?? '—'),
  }
}

// ─────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────
function Shim({ w = '100%', h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: 'linear-gradient(90deg,#EDE8E0 0%,#E0D8CE 50%,#EDE8E0 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite' }} />
}

function TableSkeleton() {
  return (
    <>
      <style>{`@keyframes shimmer{from{background-position:-200% center}to{background-position:200% center}}`}</style>
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ backgroundColor: '#F8F4EE', padding: '12px 18px', display: 'flex', gap: 20, borderBottom: '1px solid rgba(26,26,26,0.09)' }}>
          {[80, 160, 120, 120, 80, 90, 80].map((w, i) => <Shim key={i} w={w} h={10} />)}
        </div>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ padding: '15px 18px', display: 'flex', gap: 20, alignItems: 'center', borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
            {[80, 160, 120, 120, 80, 90, 80].map((w, j) => <Shim key={j} w={w} h={13} />)}
          </div>
        ))}
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// BOOKING DETAIL MODAL
// ─────────────────────────────────────────────────────────────
function BookingDetail({ b, onClose }: { b: Booking; onClose: () => void }) {
  return (
    <>
      <style>{`@keyframes mIn{from{opacity:0;transform:translateY(14px) scale(0.98)}to{opacity:1;transform:none}} .bkdet{animation:mIn 260ms cubic-bezier(0.22,1,0.36,1) both;}`}</style>
      <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(10,8,6,0.48)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px' }}>
        <div className="bkdet" style={{ width: '100%', maxWidth: 400, backgroundColor: '#F9F4EB', backgroundImage: 'none', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.26)', fontFamily: "'Inter',system-ui,sans-serif" }}>
          <div style={{ height: 3, backgroundColor: '#C58F3B' }} />
          <div style={{ padding: '22px 24px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 4px' }}>Booking Detail</p>
                <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 22, fontWeight: 400, color: '#1A1A1A', margin: 0 }}>{b.client}</h3>
              </div>
              <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(26,26,26,0.14)', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(26,26,26,0.40)' }} aria-label="Close">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
              </button>
            </div>
            {[
              ['Date', fmtDate(b.date)],
              ['Service', b.service],
              ['Therapist', b.therapist],
              ['Category', b.category],
              ['Customer Type', b.customerType],
              ['Payment Method', b.payMethod],
              ['Service Amount', fmt(b.serviceAmt)],
              ['Net Sales', fmt(b.netSales)],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingBottom: 11, borderBottom: '1px solid rgba(26,26,26,0.07)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.40)' }}>{label}</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', textAlign: 'right' }}>{value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.40)' }}>Revenue</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#1A1A1A' }}>{fmt(b.revenue)}</span>
            </div>
            <button onClick={onClose} style={{ width: '100%', height: 44, backgroundColor: '#1A1A1A', color: '#C58F3B', border: '1px solid rgba(197,143,59,0.35)', borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default function BookingsPage() {
  const supabase = useRef(createClient()).current

  // Date picker value is ISO "YYYY-MM-DD"; we convert to "D-Mon-YY" for the query
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [catFilter, setCatFilter] = useState('all')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<Booking | null>(null)
  const [search, setSearch] = useState('')

  const loadBookings = useCallback(async (isoDate: string) => {
    setLoading(true); setError(null)
    try {
      const importDateStr = isoToImportDate(isoDate)   // "2025-05-26" → "26-May-25"

      const { data, error: dbErr } = await supabase
        .from('bookings_import')
        .select('date, client_name, service, therapist, received_payment, net_sales, service_amount, category, customer_type, payment_method')
        .eq('date', importDateStr)     // exact text match on the date column
        .order('client_name', { ascending: true })

      if (dbErr) throw new Error(dbErr.message)
      setBookings((data ?? []).map(mapRow))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadBookings(selectedDate) }, [selectedDate, loadBookings])

  const isToday = selectedDate === todayISO()

  function prevDay() {
    const d = new Date(selectedDate + 'T12:00:00'); d.setDate(d.getDate() - 1)
    setSelectedDate(importDateToISO(isoToImportDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)) || `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  function nextDay() {
    if (isToday) return
    const d = new Date(selectedDate + 'T12:00:00'); d.setDate(d.getDate() + 1)
    const newISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (newISO <= todayISO()) setSelectedDate(newISO)
  }

  const categories = Array.from(new Set(bookings.map(b => b.category).filter(Boolean)))

  const filtered = bookings
    .filter(b => catFilter === 'all' || b.category === catFilter)
    .filter(b => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return b.client.toLowerCase().includes(q)
        || b.service.toLowerCase().includes(q)
        || b.therapist.toLowerCase().includes(q)
        || b.category.toLowerCase().includes(q)
    })

  const totalRevenue = bookings.reduce((a, b) => a + b.revenue, 0)

  return (
    <>
      <style>{`@keyframes shimmer{from{background-position:-200% center}to{background-position:200% center}}`}</style>
      {detail && <BookingDetail b={detail} onClose={() => setDetail(null)} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, fontFamily: "'Inter',system-ui,sans-serif" }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Reservations</p>
            <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Bookings</h2>
          </div>

          {/* Date navigation — converts between ISO (input) ↔ import format (query) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={prevDay} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid rgba(26,26,26,0.16)', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(26,26,26,0.50)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <input type="date" value={selectedDate} max={todayISO()}
              onChange={e => setSelectedDate(e.target.value)}
              style={{ height: 36, padding: '0 12px', border: '1px solid rgba(26,26,26,0.16)', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#1A1A1A', backgroundColor: '#FFFFFF', fontFamily: "'Inter',system-ui,sans-serif", cursor: 'pointer', outline: 'none' }}
            />
            <button onClick={nextDay} disabled={isToday}
              style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid rgba(26,26,26,0.16)', backgroundColor: 'transparent', cursor: isToday ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isToday ? 'rgba(26,26,26,0.20)' : 'rgba(26,26,26,0.50)', opacity: isToday ? 0.4 : 1 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {!isToday && (
              <button onClick={() => setSelectedDate(todayISO())} style={{ padding: '0 14px', height: 36, borderRadius: 8, border: '1px solid rgba(197,143,59,0.40)', backgroundColor: 'transparent', color: '#C58F3B', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>Today</button>
            )}
          </div>
        </div>

        {/* Summary strip */}
        {!loading && !error && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(160px,100%),1fr))', gap: 12 }}>
            {[
              { label: 'Total Bookings', value: String(bookings.length), sub: isoToImportDate(selectedDate) },
              { label: 'Revenue', value: fmt(totalRevenue), sub: 'Received payments' },
              { label: 'Net Sales', value: fmt(bookings.reduce((a, b) => a + b.netSales, 0)), sub: 'After deductions' },
              { label: 'New Clients', value: String(bookings.filter(b => b.customerType.toLowerCase().includes('new')).length), sub: 'vs returning' },
            ].map(t => (
              <div key={t.label} style={{ backgroundColor: '#FFFFFF', backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '15px 17px', position: 'relative', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 2, backgroundColor: '#C58F3B', opacity: 0.40, borderRadius: '0 0 2px 2px' }} />
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 6px' }}>{t.label}</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: '#1A1A1A', margin: '0 0 2px', lineHeight: 1 }}>{t.value}</p>
                <p style={{ fontSize: 11, color: '#9A8E85', margin: 0 }}>{t.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Category filter + search */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['all', ...categories].map(cat => (
              <button key={cat} onClick={() => setCatFilter(cat)} style={{ padding: '0 14px', height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', border: '1px solid', transition: 'all 150ms ease', fontFamily: "'Inter',system-ui,sans-serif", backgroundColor: catFilter === cat ? '#1A1A1A' : 'transparent', borderColor: catFilter === cat ? '#1A1A1A' : 'rgba(26,26,26,0.16)', color: catFilter === cat ? '#C58F3B' : 'rgba(26,26,26,0.42)' }}>
                {cat === 'all' ? 'All Categories' : cat}
              </button>
            ))}
          </div>
          <input type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search client, service, therapist…"
            style={{ height: 36, padding: '0 14px', border: '1px solid rgba(26,26,26,0.14)', borderRadius: 8, fontSize: 13, color: '#1A1A1A', backgroundColor: '#FFFFFF', fontFamily: "'Inter',system-ui,sans-serif", outline: 'none', minWidth: 220 }}
          />
        </div>

        {/* Table */}
        {loading ? <TableSkeleton /> : error ? (
          <div style={{ padding: '14px 18px', backgroundColor: 'rgba(139,58,58,0.09)', border: '1px solid rgba(139,58,58,0.28)', borderRadius: 12, color: '#8B3A3A', fontSize: 14 }}>
            {error} <button onClick={() => loadBookings(selectedDate)} style={{ marginLeft: 12, padding: '4px 12px', borderRadius: 7, backgroundColor: 'rgba(139,58,58,0.14)', border: '1px solid rgba(139,58,58,0.28)', color: '#8B3A3A', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Retry</button>
          </div>
        ) : (
          <div style={{ backgroundColor: '#FFFFFF', backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, boxShadow: '0 3px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)' }}>
                    {['Client', 'Service', 'Therapist', 'Category', 'Type', 'Revenue', 'Payment', ''].map((h, i) => (
                      <th key={i} style={{ padding: '11px 16px', textAlign: 'left', fontFamily: "'Inter',system-ui,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C58F3B', backgroundColor: '#F8F4EE', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b, i) => (
                    <tr key={b._key} style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(26,26,26,0.06)' : 'none', cursor: 'pointer', transition: 'background 120ms ease' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(197,143,59,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      onClick={() => setDetail(b)}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1A1A1A' }}>{b.client}</td>
                      <td style={{ padding: '12px 16px', color: '#2A2A2A', maxWidth: 180 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.service}</div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#4A4A4A', whiteSpace: 'nowrap' }}>{b.therapist}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', backgroundColor: 'rgba(197,143,59,0.10)', color: '#A07530', border: '1px solid rgba(197,143,59,0.28)', whiteSpace: 'nowrap' }}>{b.category || '—'}</span>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'rgba(26,26,26,0.55)', fontSize: 12, whiteSpace: 'nowrap' }}>{b.customerType || '—'}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1A1A1A', whiteSpace: 'nowrap', fontSize: 15 }}>{fmt(b.revenue)}</td>
                      <td style={{ padding: '12px 16px', color: 'rgba(26,26,26,0.50)', fontSize: 12, whiteSpace: 'nowrap' }}>{b.payMethod || '—'}</td>
                      <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 12, color: 'rgba(26,26,26,0.30)' }}>View →</span></td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '40px 16px', textAlign: 'center', color: '#9A8E85', fontStyle: 'italic' }}>
                      {bookings.length === 0 ? `No bookings found for ${isoToImportDate(selectedDate)}.` : 'No bookings match this filter.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', backgroundColor: '#F8F4EE', borderTop: '1px solid rgba(26,26,26,0.07)', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#9A8E85' }}>{filtered.length} of {bookings.length} bookings</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>Revenue: <strong style={{ color: '#C58F3B' }}>{fmt(totalRevenue)}</strong></span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}