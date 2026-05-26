'use client'

// app/dashboard/bookings/page.tsx  —  Phase 4 Bookings List
// · Fixed Supabase column mismatch by using select('*')
// · Fixed session cookie bug via createBrowserClient

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { type SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type BookingStatus = 'completed' | 'in_progress' | 'confirmed' | 'upcoming' | 'cancelled'

interface Booking {
  id: string
  client_name: string
  client_mobile: string
  service_name: string
  therapist_name: string
  amount: number
  status: BookingStatus
  payment_method: string
  created_at: string
  appt_time: string   // formatted HH:MM
  appt_date: string   // YYYY-MM-DD
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<BookingStatus, { label: string; color: string; bg: string; border: string }> = {
  completed: { label: 'Completed', color: '#3D7A4A', bg: 'rgba(61,122,74,0.12)', border: 'rgba(61,122,74,0.28)' },
  in_progress: { label: 'In Progress', color: '#2A6A8A', bg: 'rgba(42,106,138,0.13)', border: 'rgba(42,106,138,0.30)' },
  confirmed: { label: 'Confirmed', color: '#A07530', bg: 'rgba(197,143,59,0.14)', border: 'rgba(197,143,59,0.35)' },
  upcoming: { label: 'Upcoming', color: '#7A6A50', bg: 'rgba(122,106,80,0.10)', border: 'rgba(122,106,80,0.25)' },
  cancelled: { label: 'Cancelled', color: '#8B3A3A', bg: 'rgba(139,58,58,0.12)', border: 'rgba(139,58,58,0.28)' },
}

const VALID_STATUSES = Object.keys(STATUS_CFG) as BookingStatus[]

const FILTER_TABS = [
  { key: 'all', label: 'All', match: VALID_STATUSES },
  { key: 'active', label: 'Active', match: ['in_progress', 'confirmed'] as BookingStatus[] },
  { key: 'completed', label: 'Completed', match: ['completed'] as BookingStatus[] },
  { key: 'upcoming', label: 'Upcoming', match: ['upcoming'] as BookingStatus[] },
  { key: 'cancelled', label: 'Cancelled', match: ['cancelled'] as BookingStatus[] },
]

const fmt = (n: number) => '₱' + n.toLocaleString('en-PH')

function todayISO() { return new Date().toISOString().split('T')[0] }

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function mapBooking(row: Record<string, unknown>): Booking {
  const rawAmount = Number(row.amount)
  const rawStatus = String(row.status ?? '')
  const status = VALID_STATUSES.includes(rawStatus as BookingStatus) ? (rawStatus as BookingStatus) : 'upcoming'

  let apptTime = '--:--'
  try {
    if (row.appointment_time) {
      apptTime = String(row.appointment_time).slice(0, 5)
    } else if (row.created_at) {
      const d = new Date(String(row.created_at))
      if (!isNaN(d.getTime())) apptTime = d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: false })
    }
  } catch { /* silent */ }

  let apptDate = ''
  try {
    apptDate = row.appointment_date
      ? String(row.appointment_date)
      : new Date(String(row.created_at)).toISOString().split('T')[0]
  } catch { /* silent */ }

  return {
    id: String(row.id ?? ''),
    client_name: String(row.client_name ?? row.client ?? 'Guest'),
    // Flexible fallback: checks client_mobile, then mobile, then empty
    client_mobile: String(row.client_mobile ?? row.mobile ?? '—'),
    service_name: String(row.service_name ?? row.service ?? 'Service'),
    therapist_name: String(row.therapist_name ?? row.therapist ?? 'Staff'),
    amount: isFinite(rawAmount) && rawAmount >= 0 ? rawAmount : 0,
    status,
    payment_method: String(row.payment_method ?? '—'),
    created_at: String(row.created_at ?? ''),
    appt_time: apptTime,
    appt_date: apptDate,
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
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 3px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ backgroundColor: '#F8F4EE', padding: '12px 18px', display: 'flex', gap: 20, borderBottom: '1px solid rgba(26,26,26,0.09)' }}>
          {[60, 160, 120, 120, 80, 90].map((w, i) => <Shim key={i} w={w} h={10} />)}
        </div>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} style={{ padding: '16px 18px', display: 'flex', gap: 20, alignItems: 'center', borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
            {[60, 160, 120, 120, 80, 90].map((w, j) => <Shim key={j} w={w} h={14} />)}
          </div>
        ))}
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// BOOKING DETAIL PANEL
// ─────────────────────────────────────────────────────────────
function BookingDetail({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const st = STATUS_CFG[booking.status]
  return (
    <>
      <style>{`
        @keyframes slideIn{from{opacity:0;transform:translateY(14px) scale(0.98)}to{opacity:1;transform:none}}
        .bk-panel{animation:slideIn 260ms cubic-bezier(0.22,1,0.36,1) both;}
      `}</style>
      <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(10,8,6,0.48)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px' }} role="dialog" aria-modal="true">
        <div className="bk-panel" style={{ width: '100%', maxWidth: 420, backgroundColor: '#F9F4EB', backgroundImage: 'none', borderRadius: 18, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.26)', fontFamily: "'Inter',system-ui,sans-serif" }}>
          <div style={{ height: 3, backgroundColor: '#C58F3B' }} />
          <div style={{ padding: '22px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 4px' }}>Booking Detail</p>
                <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 22, fontWeight: 400, color: '#1A1A1A', margin: 0 }}>{booking.client_name}</h3>
              </div>
              <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(26,26,26,0.14)', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(26,26,26,0.40)' }} aria-label="Close">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
              </button>
            </div>

            {[
              ['Service', booking.service_name],
              ['Therapist', booking.therapist_name],
              ['Date', booking.appt_date || '—'],
              ['Time', booking.appt_time],
              ['Mobile', booking.client_mobile],
              ['Payment', booking.payment_method],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingBottom: 12, borderBottom: '1px solid rgba(26,26,26,0.07)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.40)' }}>{label}</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', textAlign: 'right' }}>{value}</span>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                {st.label}
              </span>
              <span style={{ fontFamily: "'Inter',system-ui,sans-serif", fontSize: 22, fontWeight: 700, color: '#1A1A1A' }}>{fmt(booking.amount)}</span>
            </div>

            <button onClick={onClose} style={{ width: '100%', height: 44, backgroundColor: '#1A1A1A', color: '#C58F3B', border: '1px solid rgba(197,143,59,0.35)', borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Close
            </button>
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
  const supabaseRef = useRef<SupabaseClient | null>(null)

  if (!supabaseRef.current) {
    // CRITICAL: Uses correct browser client for session stability
    supabaseRef.current = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  const supabase = supabaseRef.current

  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [statusFilter, setStatusFilter] = useState('all')
  const [bookings_import, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<Booking | null>(null)
  const [search, setSearch] = useState('')

  const loadBookings = useCallback(async (date: string) => {
    setLoading(true); setError(null)
    try {
      const { data, error: dbErr } = await supabase
        .from('bookings_import')
        .select('*') // CRITICAL FIX: select everything to prevent missing column errors
        .gte('created_at', `${date}T00:00:00.000Z`)
        .lte('created_at', `${date}T23:59:59.999Z`)
        .order('created_at', { ascending: false })

      if (dbErr) throw new Error(dbErr.message)
      setBookings((data ?? []).map(mapBooking))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadBookings(selectedDate) }, [selectedDate, loadBookings])

  function handleDateChange(val: string) {
    setSelectedDate(val)
    setStatusFilter('all')
  }

  const filterDef = FILTER_TABS.find(t => t.key === statusFilter) ?? FILTER_TABS[0]
  const filtered = bookings_import
    .filter(b => filterDef.match.includes(b.status))
    .filter(b => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return b.client_name.toLowerCase().includes(q)
        || b.service_name.toLowerCase().includes(q)
        || b.therapist_name.toLowerCase().includes(q)
        || b.client_mobile.includes(q)
    })

  const totalRevenue = bookings_import.filter(b => b.status === 'completed').reduce((a, b) => a + b.amount, 0)

  const isToday = selectedDate === todayISO()

  return (
    <>
      {detail && <BookingDetail booking={detail} onClose={() => setDetail(null)} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, fontFamily: "'Inter',system-ui,sans-serif" }}>

        {/* ── Header ─────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Reservations</p>
            <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 300, color: '#1A1A1A', margin: 0, lineHeight: 1.1 }}>
              Bookings
            </h2>
          </div>

          {/* Date navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().split('T')[0]) }}
              style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid rgba(26,26,26,0.16)', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(26,26,26,0.50)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <input type="date" value={selectedDate} onChange={e => handleDateChange(e.target.value)} max={todayISO()}
              style={{ height: 36, padding: '0 12px', border: '1px solid rgba(26,26,26,0.16)', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#1A1A1A', backgroundColor: '#FFFFFF', fontFamily: "'Inter',system-ui,sans-serif", cursor: 'pointer', outline: 'none' }}
            />
            <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); if (d.toISOString().split('T')[0] <= todayISO()) setSelectedDate(d.toISOString().split('T')[0]) }}
              disabled={isToday}
              style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid rgba(26,26,26,0.16)', backgroundColor: 'transparent', cursor: isToday ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isToday ? 'rgba(26,26,26,0.20)' : 'rgba(26,26,26,0.50)', opacity: isToday ? 0.4 : 1 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {!isToday && (
              <button onClick={() => setSelectedDate(todayISO())} style={{ padding: '0 14px', height: 36, borderRadius: 8, border: '1px solid rgba(197,143,59,0.40)', backgroundColor: 'transparent', color: '#C58F3B', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Today
              </button>
            )}
          </div>
        </div>

        {/* ── Summary strip ───────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(160px,100%),1fr))', gap: 12 }}>
          {[
            { label: 'Total Bookings', value: String(bookings_import.length), sub: selectedDate === todayISO() ? 'Today' : 'On this date' },
            { label: 'Completed', value: String(bookings_import.filter(b => b.status === 'completed').length), sub: `${fmt(totalRevenue)} collected` },
            { label: 'Active Now', value: String(bookings_import.filter(b => b.status === 'in_progress' || b.status === 'confirmed').length), sub: 'In session or confirmed' },
            { label: 'Upcoming', value: String(bookings_import.filter(b => b.status === 'upcoming').length), sub: 'Scheduled ahead' },
          ].map(t => (
            <div key={t.label} style={{ backgroundColor: '#FFFFFF', backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '16px 18px', position: 'relative', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 2, backgroundColor: '#C58F3B', opacity: 0.40, borderRadius: '0 0 2px 2px' }} />
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 6px' }}>{t.label}</p>
              <p style={{ fontFamily: "'Inter',system-ui,sans-serif", fontSize: 28, fontWeight: 700, color: '#1A1A1A', margin: '0 0 2px', lineHeight: 1 }}>{t.value}</p>
              <p style={{ fontSize: 11, color: '#9A8E85', margin: 0 }}>{t.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Filters + search ────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FILTER_TABS.map(tab => (
              <button key={tab.key} onClick={() => setStatusFilter(tab.key)} style={{ padding: '0 14px', height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', border: '1px solid', transition: 'all 150ms ease', fontFamily: "'Inter',system-ui,sans-serif", backgroundColor: statusFilter === tab.key ? '#1A1A1A' : 'transparent', borderColor: statusFilter === tab.key ? '#1A1A1A' : 'rgba(26,26,26,0.16)', color: statusFilter === tab.key ? '#C58F3B' : 'rgba(26,26,26,0.42)' }}>
                {tab.label}
              </button>
            ))}
          </div>
          <input
            type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search client, service, therapist…"
            style={{ height: 36, padding: '0 14px', border: '1px solid rgba(26,26,26,0.14)', borderRadius: 8, fontSize: 13, color: '#1A1A1A', backgroundColor: '#FFFFFF', fontFamily: "'Inter',system-ui,sans-serif", outline: 'none', minWidth: 240 }}
          />
        </div>

        {/* ── Table ───────────────────────────────────────── */}
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <div style={{ padding: '20px', backgroundColor: 'rgba(139,58,58,0.09)', border: '1px solid rgba(139,58,58,0.28)', borderRadius: 12, color: '#8B3A3A', fontSize: 14 }}>
            {error} <button onClick={() => loadBookings(selectedDate)} style={{ marginLeft: 12, padding: '4px 12px', borderRadius: 7, backgroundColor: 'rgba(139,58,58,0.14)', border: '1px solid rgba(139,58,58,0.28)', color: '#8B3A3A', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Retry</button>
          </div>
        ) : (
          <div style={{ backgroundColor: '#FFFFFF', backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, boxShadow: '0 3px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)' }}>
                    {['Time', 'Client', 'Service', 'Therapist', 'Amount', 'Status', ''].map((h, i) => (
                      <th key={i} style={{ padding: '11px 16px', textAlign: 'left', fontFamily: "'Inter',system-ui,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C58F3B', backgroundColor: '#F8F4EE', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b, i) => {
                    const st = STATUS_CFG[b.status]
                    return (
                      <tr key={b.id}
                        style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(26,26,26,0.06)' : 'none', cursor: 'pointer', transition: 'background 130ms ease' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(197,143,59,0.04)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        onClick={() => setDetail(b)}
                      >
                        <td style={{ padding: '13px 16px', fontWeight: 700, color: '#1A1A1A', whiteSpace: 'nowrap' }}>{b.appt_time}</td>
                        <td style={{ padding: '13px 16px', color: '#2A2A2A' }}>
                          <div style={{ fontWeight: 600 }}>{b.client_name}</div>
                          <div style={{ fontSize: 11, color: 'rgba(26,26,26,0.40)', marginTop: 2 }}>{b.client_mobile}</div>
                        </td>
                        <td style={{ padding: '13px 16px', color: '#2A2A2A', maxWidth: 200 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.service_name}</div>
                        </td>
                        <td style={{ padding: '13px 16px', color: '#4A4A4A', whiteSpace: 'nowrap' }}>{b.therapist_name}</td>
                        <td style={{ padding: '13px 16px', fontWeight: 700, color: '#1A1A1A', whiteSpace: 'nowrap', fontSize: 15 }}>{fmt(b.amount)}</td>
                        <td style={{ padding: '13px 16px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}`, whiteSpace: 'nowrap' }}>
                            {st.label}
                          </span>
                        </td>
                        <td style={{ padding: '13px 16px' }}>
                          <span style={{ fontSize: 12, color: 'rgba(26,26,26,0.35)', whiteSpace: 'nowrap' }}>View →</span>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '44px 16px', textAlign: 'center', color: '#9A8E85', fontStyle: 'italic' }}>
                      {bookings_import.length === 0 ? 'No bookings found for this date.' : 'No bookings match the current filter.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', backgroundColor: '#F8F4EE', borderTop: '1px solid rgba(26,26,26,0.07)', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#9A8E85' }}>Showing {filtered.length} of {bookings_import.length} bookings</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>Revenue: <strong style={{ color: '#C58F3B' }}>{fmt(totalRevenue)}</strong></span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}