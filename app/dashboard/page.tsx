'use client'

// app/dashboard/page.tsx — Overview
// Schema: bookings_import table
//   date            TEXT  "1-May-25"  (NOT a timestamp — parsed client-side)
//   client_name     TEXT
//   service         TEXT  (was service_name)
//   therapist       TEXT  (was therapist_name)
//   received_payment NUMERIC — used for all revenue calculations
//   net_sales        NUMERIC
//   service_amount   NUMERIC
//   category         TEXT
//   customer_type    TEXT  ("New" | "Returning")
//   payment_method   TEXT

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────
// DATE HELPERS
// "1-May-25" ↔ "26-May-26" ↔ ISO "YYYY-MM-DD"
// ─────────────────────────────────────────────────────────────
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Parse "1-May-25" or "26-May-2025" → Date object */
function parseImportDate(raw: string): Date | null {
  if (!raw) return null
  const m = String(raw).trim().match(/^(\d{1,2})[-\/]([A-Za-z]{3,})[-\/](\d{2,4})$/)
  if (!m) return null
  const day = parseInt(m[1], 10)
  const mon = MONTHS[m[2].slice(0, 3).toLowerCase()]
  if (mon === undefined) return null
  const yr = parseInt(m[3], 10)
  const year = yr < 100 ? 2000 + yr : yr
  const d = new Date(year, mon, day)
  return isNaN(d.getTime()) ? null : d
}

/** Format today as "26-May-26" to match the import column exactly */
function todayAsImportDate(): string {
  const d = new Date()
  return `${d.getDate()}-${MONTH_NAMES[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`
}

/** Format any Date for human display */
function displayDate(raw: string): string {
  const d = parseImportDate(raw)
  if (!d) return raw || '—'
  return d.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface Sale {
  _key: string     // composite key (no id in import table)
  date: string     // raw text "1-May-25"
  service: string
  therapist: string
  client: string
  revenue: number     // received_payment
  netSales: number
  serviceAmt: number
  category: string
  customerType: string
  payMethod: string
}

interface Summary {
  revenue: number
  sessions: number
  avgValue: number
  newClients: number
  netSalesTotal: number   // sum of net_sales column — computed in computeSummary
}

interface ServiceStat { name: string; revenue: number; count: number }

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const CACHE_TTL = 30_000
const AUTO_REFRESH = 60_000

const _cache = {
  data: null as Sale[] | null,
  ts: 0,
  valid: () => _cache.data !== null && Date.now() - _cache.ts < CACHE_TTL,
  set: (d: Sale[]) => { _cache.data = d; _cache.ts = Date.now() },
  bust: () => { _cache.data = null; _cache.ts = 0 },
}

const fmt = (n: number) => '₱' + n.toLocaleString('en-PH')

// ─────────────────────────────────────────────────────────────
// GREETING (time-based, SSR-safe)
// ─────────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'Good morning'
  if (h >= 12 && h < 17) return 'Good afternoon'
  if (h >= 17 && h < 21) return 'Good evening'
  return 'Good night'
}

// ─────────────────────────────────────────────────────────────
// MAP raw Supabase row → Sale
// ─────────────────────────────────────────────────────────────
function mapRow(row: Record<string, unknown>, idx: number): Sale {
  const rev = Number(row.received_payment ?? 0)
  return {
    _key: `${row.client_name ?? idx}-${row.date ?? idx}-${idx}`,
    date: String(row.date ?? ''),
    service: String(row.service ?? '—'),
    therapist: String(row.therapist ?? '—'),
    client: String(row.client_name ?? 'Guest'),
    revenue: isFinite(rev) ? rev : 0,
    netSales: Number(row.net_sales ?? 0),
    serviceAmt: Number(row.service_amount ?? 0),
    category: String(row.category ?? '—'),
    customerType: String(row.customer_type ?? '—'),
    payMethod: String(row.payment_method ?? '—'),
  }
}

// ─────────────────────────────────────────────────────────────
// FETCH  — SSR guard must be FIRST LINE
// ─────────────────────────────────────────────────────────────
async function fetchTodaySales(
  supabase: ReturnType<typeof createClient>,
  force = false,
): Promise<Sale[]> {
  if (typeof window === 'undefined') return []   // SSR / build guard

  if (!force && _cache.valid()) return _cache.data!

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('AUTH_REQUIRED')

  const todayStr = todayAsImportDate()   // e.g. "26-May-26"

  const { data, error } = await supabase
    .from('bookings_import')
    .select('date, client_name, service, therapist, received_payment, net_sales, service_amount, category, customer_type, payment_method')
    .eq('date', todayStr)          // exact text match — avoids broken ISO range queries
    .order('service', { ascending: true })

  if (error) {
    const isSchema = error.message.includes('column') || error.message.includes('does not exist')
    if (isSchema) { console.warn('[overview] Schema mismatch:', error.message); return [] }
    throw new Error(error.message)
  }

  const sales = (data ?? []).map(mapRow)
  _cache.set(sales)
  return sales
}

// ─────────────────────────────────────────────────────────────
// COMPUTATIONS
// ─────────────────────────────────────────────────────────────
function computeSummary(sales: Sale[]): Summary {
  const rev = sales.reduce((a, s) => a + s.revenue, 0)
  const net = sales.reduce((a, s) => a + s.netSales, 0)
  return {
    revenue: rev,
    sessions: sales.length,
    avgValue: sales.length > 0 ? Math.round(rev / sales.length) : 0,
    newClients: sales.filter(s => s.customerType.toLowerCase().includes('new')).length,
    netSalesTotal: net,
  }
}

function computeBreakdown(sales: Sale[]): ServiceStat[] {
  const map: Record<string, ServiceStat> = {}
  for (const s of sales) {
    const k = s.service || s.category || 'Other'
    if (!map[k]) map[k] = { name: k, revenue: 0, count: 0 }
    map[k].revenue += s.revenue
    map[k].count++
  }
  return Object.values(map).sort((a, b) => b.revenue - a.revenue)
}

// ─────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────
function Shim({ w = '100%', h = 16, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: 'linear-gradient(90deg,#EDE8E0 0%,#E0D8CE 50%,#EDE8E0 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite' }} />
}

// ─────────────────────────────────────────────────────────────
// KPI TILES
// ─────────────────────────────────────────────────────────────
function KpiTiles({ s, count }: { s: Summary; count: number }) {
  const tiles = [
    { label: 'Gross Revenue', value: fmt(s.revenue), sub: `${count} session${count !== 1 ? 's' : ''}`, dark: false, gold: false },
    { label: 'Net Sales', value: fmt(s.sessions > 0 ? s.netSalesTotal ?? s.revenue : 0), sub: 'After discounts', dark: false, gold: false },
    { label: 'Avg per Session', value: fmt(s.avgValue), sub: 'Revenue per booking', dark: true, gold: false },
    { label: 'New Clients', value: String(s.newClients), sub: `${count - s.newClients} returning`, dark: false, gold: s.newClients > 0 },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(190px,100%),1fr))', gap: 14 }}>
      {tiles.map(t => {
        const bg = t.dark ? '#1A1A1A' : t.gold ? '#C58F3B' : '#FFFFFF'
        const vCol = t.dark ? '#F3E9E0' : t.gold ? '#1A1A1A' : '#1A1A1A'
        const lCol = t.dark ? 'rgba(243,233,224,0.50)' : t.gold ? 'rgba(26,26,26,0.65)' : '#7A6E65'
        const sCol = t.dark ? 'rgba(243,233,224,0.38)' : t.gold ? 'rgba(26,26,26,0.55)' : '#9A8E85'
        const bdr = t.dark ? 'rgba(197,143,59,0.20)' : t.gold ? '#A07530' : 'rgba(26,26,26,0.09)'
        return (
          <div key={t.label} style={{ position: 'relative', overflow: 'hidden', backgroundColor: bg, backgroundImage: 'none', border: `1px solid ${bdr}`, borderRadius: 16, padding: '20px 22px', boxShadow: (t.dark || t.gold) ? '0 6px 20px rgba(0,0,0,0.18)' : '0 2px 10px rgba(0,0,0,0.06)' }}>
            {!t.gold && <div style={{ position: 'absolute', top: 0, left: 16, right: 16, height: 2, backgroundColor: '#C58F3B', opacity: t.dark ? 0.65 : 0.40, borderRadius: '0 0 2px 2px' }} />}
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: lCol, margin: '0 0 10px', fontFamily: "'Inter',system-ui,sans-serif" }}>{t.label}</p>
            <p style={{ fontSize: 'clamp(1.5rem,2.6vw,2rem)', fontWeight: 700, lineHeight: 1, color: vCol, margin: '0 0 6px', fontFamily: "'Inter',system-ui,sans-serif" }}>{t.value}</p>
            <p style={{ fontSize: 12, color: sCol, margin: 0, fontFamily: "'Inter',system-ui,sans-serif" }}>{t.sub}</p>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SERVICE BREAKDOWN
// ─────────────────────────────────────────────────────────────
function ServiceBreakdown({ stats }: { stats: ServiceStat[] }) {
  if (!stats.length) return (
    <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.38)', fontStyle: 'italic', fontFamily: "'Inter',system-ui,sans-serif", margin: 0 }}>
      No sessions recorded for today yet.
    </p>
  )
  const maxRev = Math.max(...stats.map(s => s.revenue), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {stats.map(s => (
        <div key={s.name} style={{ backgroundColor: '#FFFFFF', backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 12, padding: '12px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', fontFamily: "'Inter',system-ui,sans-serif" }}>{s.name}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#C58F3B', fontFamily: "'Inter',system-ui,sans-serif" }}>{fmt(s.revenue)} · {s.count} session{s.count !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(197,143,59,0.15)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, backgroundColor: '#C58F3B', width: `${Math.round((s.revenue / maxRev) * 100)}%`, transition: 'width 600ms ease' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SESSIONS TABLE  (read-only — import data has no live status)
// ─────────────────────────────────────────────────────────────
function SessionsTable({ sales }: { sales: Sale[] }) {
  const [filter, setFilter] = useState('all')
  const categories = Array.from(new Set(sales.map(s => s.category).filter(Boolean)))
  const visible = filter === 'all' ? sales : sales.filter(s => s.category === filter)
  const totalRev = sales.reduce((a, s) => a + s.revenue, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(197,143,59,0.65)', margin: '0 0 4px', fontFamily: "'Inter',system-ui,sans-serif" }}>Today's Sessions</p>
          <div style={{ fontFamily: "'Inter',system-ui,sans-serif", fontSize: 18, fontWeight: 700, color: '#1A1A1A', display: 'flex', alignItems: 'baseline', gap: 12 }}>
            Daily Revenue Ledger
            <span style={{ fontSize: 14, color: '#C58F3B' }}>{fmt(totalRev)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all', ...categories].map(tab => (
            <button key={tab} onClick={() => setFilter(tab)} style={{ padding: '0 12px', height: 30, borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', fontFamily: "'Inter',system-ui,sans-serif", border: '1px solid', transition: 'all 150ms ease', backgroundColor: filter === tab ? '#1A1A1A' : 'transparent', borderColor: filter === tab ? '#1A1A1A' : 'rgba(26,26,26,0.16)', color: filter === tab ? '#C58F3B' : 'rgba(26,26,26,0.42)' }}>
              {tab === 'all' ? 'All' : tab}
            </button>
          ))}
        </div>
      </div>

      <div style={{ backgroundColor: '#FFFFFF', backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, boxShadow: '0 3px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)' }}>
                {['Client', 'Service', 'Therapist', 'Category', 'Type', 'Revenue', 'Payment'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: "'Inter',system-ui,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C58F3B', backgroundColor: '#F8F4EE', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((s, i) => (
                <tr key={s._key}
                  style={{ borderBottom: i < visible.length - 1 ? '1px solid rgba(26,26,26,0.06)' : 'none', transition: 'background 120ms ease' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(197,143,59,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1A1A1A', fontFamily: "'Inter',system-ui,sans-serif" }}>{s.client}</td>
                  <td style={{ padding: '12px 16px', color: '#2A2A2A', fontFamily: "'Inter',system-ui,sans-serif" }}>{s.service}</td>
                  <td style={{ padding: '12px 16px', color: '#4A4A4A', whiteSpace: 'nowrap', fontFamily: "'Inter',system-ui,sans-serif" }}>{s.therapist}</td>
                  <td style={{ padding: '12px 16px', fontFamily: "'Inter',system-ui,sans-serif" }}>
                    <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', backgroundColor: 'rgba(197,143,59,0.10)', color: '#A07530', border: '1px solid rgba(197,143,59,0.30)', whiteSpace: 'nowrap' }}>
                      {s.category || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#4A4A4A', whiteSpace: 'nowrap', fontFamily: "'Inter',system-ui,sans-serif", fontSize: 12 }}>
                    {s.customerType || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1A1A1A', whiteSpace: 'nowrap', fontFamily: "'Inter',system-ui,sans-serif", fontSize: 15 }}>
                    {fmt(s.revenue)}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'rgba(26,26,26,0.55)', whiteSpace: 'nowrap', fontFamily: "'Inter',system-ui,sans-serif", fontSize: 12 }}>
                    {s.payMethod || '—'}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: '#9A8E85', fontStyle: 'italic', fontFamily: "'Inter',system-ui,sans-serif" }}>
                  {sales.length === 0 ? 'No bookings recorded for today.' : 'No sessions match this filter.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', backgroundColor: '#F8F4EE', borderTop: '1px solid rgba(26,26,26,0.07)', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#9A8E85', fontFamily: "'Inter',system-ui,sans-serif" }}>{visible.length} of {sales.length} sessions</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', fontFamily: "'Inter',system-ui,sans-serif" }}>Revenue: <strong style={{ color: '#C58F3B' }}>{fmt(totalRev)}</strong></span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const supabase = useRef(createClient()).current

  const [greeting, setGreeting] = useState('')         // empty on SSR — avoids hydration mismatch
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  // Dynamic greeting — client-side only
  useEffect(() => {
    const update = () => setGreeting(getGreeting())
    update()
    const t = setInterval(update, 60_000)
    return () => clearInterval(t)
  }, [])

  const loadData = useCallback(async (force = false) => {
    if (force) _cache.bust()
    setRefreshing(true)
    try {
      const data = await fetchTodaySales(supabase, force)
      setSales(data)
      setError(null)
      setLastFetched(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [supabase])

  useEffect(() => {
    loadData()
    const t = setInterval(() => loadData(false), AUTO_REFRESH)
    return () => clearInterval(t)
  }, [loadData])

  const summary = computeSummary(sales)   // netSalesTotal included in Summary now
  const breakdown = computeBreakdown(sales)
  const todayLabel = displayDate(todayAsImportDate())

  return (
    <>
      <style>{`@keyframes shimmer{from{background-position:-200% center}to{background-position:200% center}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, fontFamily: "'Inter',system-ui,sans-serif" }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Daily Overview</p>
            <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.8rem,3vw,2.5rem)', fontWeight: 300, color: '#1A1A1A', margin: 0, lineHeight: 1.1, minHeight: '1.1em' }}>
              {greeting || '\u00A0'}
            </h2>
            <p style={{ color: 'rgba(26,26,26,0.40)', fontSize: 13, margin: '4px 0 0' }}>{todayLabel}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {lastFetched && (
              <span style={{ fontSize: 11, color: 'rgba(26,26,26,0.35)' }}>
                Updated {lastFetched.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button onClick={() => loadData(true)} disabled={refreshing}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 16px', height: 40, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 10, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', cursor: refreshing ? 'not-allowed' : 'pointer' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ animation: refreshing ? 'spin 700ms linear infinite' : 'none', flexShrink: 0 }}>
                <path d="M10.5 6a4.5 4.5 0 1 1-1.35-3.18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M10.5 2.25V5.5H7.25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {refreshing ? 'Syncing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(190px,100%),1fr))', gap: 14 }}>
              {[1, 2, 3, 4].map(i => <div key={i} style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}><Shim w={80} h={10} /><Shim w="70%" h={32} /><Shim w={120} h={10} /></div>)}
            </div>
          </div>
        ) : error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 22, fontWeight: 400, color: '#1A1A1A', margin: 0 }}>
              {error.startsWith('AUTH') ? 'Session expired' : 'Connection error'}
            </p>
            <p style={{ fontSize: 14, color: 'rgba(26,26,26,0.50)', margin: 0 }}>{error}</p>
            <button onClick={() => loadData(true)} style={{ padding: '0 22px', height: 44, backgroundColor: '#1A1A1A', color: '#C58F3B', border: '1px solid rgba(197,143,59,0.40)', borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* KPI tiles */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(197,143,59,0.65)', margin: '0 0 12px' }}>Daily Sales Summary</p>
              <KpiTiles s={summary} count={sales.length} />
            </div>

            {/* Service breakdown */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(197,143,59,0.65)', margin: '0 0 12px' }}>Services Availed Today</p>
              <ServiceBreakdown stats={breakdown} />
            </div>

            {/* Sessions table */}
            <SessionsTable sales={sales} />
          </>
        )}
      </div>
    </>
  )
}