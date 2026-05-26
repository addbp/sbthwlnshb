'use client'

// app/dashboard/page.tsx — Overview
// bookings_import schema:
//   date TEXT "1-May-25" · client_name · service · therapist
//   received_payment · net_sales · service_amount · category
//   customer_type · payment_method
//
// FIX: Supabase caps queries at 1000 rows by default.
//   fetchAll() paginates in 1000-row chunks to retrieve all records.
// FIX: Date column is "1-May-25" text from 2025 — the old .eq(todayStr)
//   returned 0 rows because today is 2026. Default mode is now "All Records".

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────────────────────
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
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

/** "2025-05-01" (ISO from <input type=date>) → "1-May-25" (import format) */
function isoToImportDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  if (isNaN(d.getTime())) return iso
  const yr = String(d.getFullYear()).slice(-2)
  return `${d.getDate()}-${MONTH_ABBR[d.getMonth()]}-${yr}`
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDateShort(raw: string): string {
  const d = parseImportDate(raw)
  if (!d) return raw || '—'
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtDateLong(raw: string): string {
  const d = parseImportDate(raw)
  if (!d) return raw || '—'
  return d.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

const fmt = (n: number) => '₱' + n.toLocaleString('en-PH')
const fmtK = (n: number) => n >= 1_000_000 ? `₱${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `₱${(n / 1000).toFixed(1)}k` : fmt(n)

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface Sale {
  _key: string
  date: string
  service: string
  therapist: string
  client: string
  revenue: number
  netSales: number
  category: string
  customerType: string
  payMethod: string
}

interface Summary {
  revenue: number
  netSalesTotal: number
  sessions: number
  avgValue: number
  newClients: number
  uniqueClients: number
}

interface ServiceStat { name: string; revenue: number; count: number }

// ─────────────────────────────────────────────────────────────
// PAGINATED FETCH — bypasses Supabase 1000-row default limit
// Fetches every row in bookings_import in 1000-row chunks.
// Returns all rows regardless of date — caller filters/aggregates.
// ─────────────────────────────────────────────────────────────
const _cache: { data: Sale[] | null; ts: number } = { data: null, ts: 0 }
const CACHE_TTL = 60_000

async function fetchAll(
  supabase: ReturnType<typeof createClient>,
  force = false,
): Promise<Sale[]> {
  if (typeof window === 'undefined') return []   // SSR guard — must be first

  if (!force && _cache.data && Date.now() - _cache.ts < CACHE_TTL) {
    return _cache.data
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('AUTH_REQUIRED: Please log in.')

  const COLS = 'date,client_name,service,therapist,received_payment,net_sales,category,customer_type,payment_method'
  const PAGE = 1000
  const all: Sale[] = []
  let from = 0

  for (; ;) {
    const { data, error } = await supabase
      .from('bookings_import')
      .select(COLS)
      .range(from, from + PAGE - 1)
      .order('date', { ascending: false })

    if (error) {
      const isSchema = error.message.includes('column') || error.message.includes('does not exist')
      if (isSchema) { console.warn('[overview] schema:', error.message); break }
      throw new Error(error.message)
    }
    if (!data || data.length === 0) break

    data.forEach((r, i) => {
      const rev = Number(r.received_payment ?? 0)
      all.push({
        _key: `${r.client_name}-${r.date}-${from + i}`,
        date: String(r.date ?? ''),
        service: String(r.service ?? '—'),
        therapist: String(r.therapist ?? '—'),
        client: String(r.client_name ?? 'Guest'),
        revenue: isFinite(rev) ? rev : 0,
        netSales: Number(r.net_sales ?? 0),
        category: String(r.category ?? '—'),
        customerType: String(r.customer_type ?? '—'),
        payMethod: String(r.payment_method ?? '—'),
      })
    })

    if (data.length < PAGE) break
    from += PAGE
    if (from > 200_000) break // hard safety limit
  }

  _cache.data = all
  _cache.ts = Date.now()
  return all
}

// ─────────────────────────────────────────────────────────────
// COMPUTATIONS
// ─────────────────────────────────────────────────────────────
function computeSummary(sales: Sale[]): Summary {
  const rev = sales.reduce((a, s) => a + s.revenue, 0)
  const net = sales.reduce((a, s) => a + s.netSales, 0)
  const names = new Set(sales.map(s => s.client.trim().toLowerCase()))
  return {
    revenue: rev,
    netSalesTotal: net,
    sessions: sales.length,
    avgValue: sales.length > 0 ? Math.round(rev / sales.length) : 0,
    newClients: sales.filter(s => s.customerType.toLowerCase().includes('new')).length,
    uniqueClients: names.size,
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
  return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 8)
}

// Sort all records by parsed date descending (newest first)
function sortByDate(sales: Sale[]): Sale[] {
  return [...sales].sort((a, b) => {
    const da = parseImportDate(a.date)
    const db = parseImportDate(b.date)
    if (!da && !db) return 0
    if (!da) return 1
    if (!db) return -1
    return db.getTime() - da.getTime()
  })
}

// ─────────────────────────────────────────────────────────────
// GREETING
// ─────────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'Good morning'
  if (h >= 12 && h < 17) return 'Good afternoon'
  if (h >= 17 && h < 21) return 'Good evening'
  return 'Good night'
}

// ─────────────────────────────────────────────────────────────
// UI ATOMS
// ─────────────────────────────────────────────────────────────
function Shim({ w = '100%', h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: 'linear-gradient(90deg,#EDE8E0 0%,#E0D8CE 50%,#EDE8E0 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite' }} />
}

// ─────────────────────────────────────────────────────────────
// KPI TILES
// ─────────────────────────────────────────────────────────────
function KpiTiles({ s, label }: { s: Summary; label: string }) {
  const tiles = [
    { key: 'a', l: 'Total Revenue', v: fmtK(s.revenue), sub: label, dark: true },
    { key: 'b', l: 'Total Net Sales', v: fmtK(s.netSalesTotal), sub: 'After deductions', dark: false },
    { key: 'c', l: 'Total Sessions', v: s.sessions.toLocaleString(), sub: `${fmtK(s.avgValue)} avg per session`, dark: false },
    { key: 'd', l: 'Unique Clients', v: s.uniqueClients.toLocaleString(), sub: `${s.newClients} new · ${s.sessions - s.newClients} returning`, dark: false },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(190px,100%),1fr))', gap: 14 }}>
      {tiles.map(t => {
        const bg = t.dark ? '#1A1A1A' : '#FFFFFF'
        const vCol = t.dark ? '#F3E9E0' : '#1A1A1A'
        const lCol = t.dark ? 'rgba(243,233,224,0.50)' : '#7A6E65'
        const sCol = t.dark ? 'rgba(243,233,224,0.38)' : '#9A8E85'
        const bdr = t.dark ? 'rgba(197,143,59,0.20)' : 'rgba(26,26,26,0.09)'
        return (
          <div key={t.key} style={{ position: 'relative', overflow: 'hidden', backgroundColor: bg, backgroundImage: 'none', border: `1px solid ${bdr}`, borderRadius: 16, padding: '20px 22px', boxShadow: t.dark ? '0 6px 20px rgba(0,0,0,0.18)' : '0 2px 10px rgba(0,0,0,0.06)' }}>
            {!t.dark && <div style={{ position: 'absolute', top: 0, left: 16, right: 16, height: 2, backgroundColor: '#C58F3B', opacity: 0.40, borderRadius: '0 0 2px 2px' }} />}
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: lCol, margin: '0 0 10px', fontFamily: "'Inter',system-ui,sans-serif" }}>{t.l}</p>
            <p style={{ fontSize: 'clamp(1.4rem,2.4vw,1.9rem)', fontWeight: 700, lineHeight: 1, color: vCol, margin: '0 0 6px', fontFamily: "'Inter',system-ui,sans-serif" }}>{t.v}</p>
            <p style={{ fontSize: 12, color: sCol, margin: 0, fontFamily: "'Inter',system-ui,sans-serif" }}>{t.sub}</p>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SERVICE BREAKDOWN STRIP
// ─────────────────────────────────────────────────────────────
function BreakdownStrip({ stats }: { stats: ServiceStat[] }) {
  if (!stats.length) return (
    <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.38)', fontStyle: 'italic', fontFamily: "'Inter',system-ui,sans-serif", margin: 0 }}>No sessions to break down.</p>
  )
  const max = Math.max(...stats.map(s => s.revenue), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {stats.map(s => (
        <div key={s.name} style={{ backgroundColor: '#FFFFFF', backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 11, padding: '11px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5, flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', fontFamily: "'Inter',system-ui,sans-serif" }}>{s.name}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#C58F3B', fontFamily: "'Inter',system-ui,sans-serif" }}>{fmtK(s.revenue)} · {s.count.toLocaleString()} session{s.count !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(197,143,59,0.14)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, backgroundColor: '#C58F3B', width: `${Math.round((s.revenue / max) * 100)}%`, transition: 'width 700ms ease' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SESSIONS TABLE
// ─────────────────────────────────────────────────────────────
function SessionsTable({ sales, title }: { sales: Sale[]; title: string }) {
  const [catFilter, setCatFilter] = useState('all')
  const categories = Array.from(new Set(sales.map(s => s.category).filter(Boolean)))
  const visible = catFilter === 'all' ? sales : sales.filter(s => s.category === catFilter)
  const totalRev = sales.reduce((a, s) => a + s.revenue, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(197,143,59,0.65)', margin: '0 0 3px', fontFamily: "'Inter',system-ui,sans-serif" }}>{title}</p>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#1A1A1A', display: 'flex', alignItems: 'baseline', gap: 10, fontFamily: "'Inter',system-ui,sans-serif", flexWrap: 'wrap' }}>
            {sales.length.toLocaleString()} records
            <span style={{ fontSize: 14, color: '#C58F3B' }}>{fmtK(totalRev)} total</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all', ...categories].map(tab => (
            <button key={tab} onClick={() => setCatFilter(tab)} style={{ padding: '0 11px', height: 28, borderRadius: 6, cursor: 'pointer', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', border: '1px solid', transition: 'all 130ms ease', fontFamily: "'Inter',system-ui,sans-serif", backgroundColor: catFilter === tab ? '#1A1A1A' : 'transparent', borderColor: catFilter === tab ? '#1A1A1A' : 'rgba(26,26,26,0.15)', color: catFilter === tab ? '#C58F3B' : 'rgba(26,26,26,0.40)' }}>
              {tab === 'all' ? 'All' : tab}
            </button>
          ))}
        </div>
      </div>

      <div style={{ backgroundColor: '#FFFFFF', backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, boxShadow: '0 3px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)' }}>
                {['Date', 'Client', 'Service', 'Therapist', 'Category', 'Revenue', 'Payment'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: "'Inter',system-ui,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.11em', textTransform: 'uppercase', color: '#C58F3B', backgroundColor: '#F8F4EE', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((s, i) => (
                <tr key={s._key} style={{ borderBottom: i < visible.length - 1 ? '1px solid rgba(26,26,26,0.06)' : 'none', transition: 'background 120ms' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(197,143,59,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: 'rgba(26,26,26,0.55)', whiteSpace: 'nowrap', fontFamily: "'Inter',system-ui,sans-serif" }}>{fmtDateShort(s.date)}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1A1A1A', fontFamily: "'Inter',system-ui,sans-serif" }}>{s.client}</td>
                  <td style={{ padding: '11px 14px', color: '#2A2A2A', maxWidth: 180, fontFamily: "'Inter',system-ui,sans-serif" }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.service}</div></td>
                  <td style={{ padding: '11px 14px', color: '#4A4A4A', whiteSpace: 'nowrap', fontFamily: "'Inter',system-ui,sans-serif" }}>{s.therapist}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', backgroundColor: 'rgba(197,143,59,0.10)', color: '#A07530', border: '1px solid rgba(197,143,59,0.28)', whiteSpace: 'nowrap', fontFamily: "'Inter',system-ui,sans-serif" }}>{s.category || '—'}</span>
                  </td>
                  <td style={{ padding: '11px 14px', fontWeight: 700, color: '#1A1A1A', whiteSpace: 'nowrap', fontFamily: "'Inter',system-ui,sans-serif", fontSize: 15 }}>{fmt(s.revenue)}</td>
                  <td style={{ padding: '11px 14px', color: 'rgba(26,26,26,0.50)', fontSize: 12, whiteSpace: 'nowrap', fontFamily: "'Inter',system-ui,sans-serif" }}>{s.payMethod || '—'}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '36px 14px', textAlign: 'center', color: '#9A8E85', fontStyle: 'italic', fontFamily: "'Inter',system-ui,sans-serif" }}>
                  No records match this filter.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 18px', backgroundColor: '#F8F4EE', borderTop: '1px solid rgba(26,26,26,0.07)', flexWrap: 'wrap', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#9A8E85', fontFamily: "'Inter',system-ui,sans-serif" }}>{visible.length.toLocaleString()} of {sales.length.toLocaleString()} shown</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', fontFamily: "'Inter',system-ui,sans-serif" }}>Revenue: <strong style={{ color: '#C58F3B' }}>{fmtK(totalRev)}</strong></span>
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

  const [greeting, setGreeting] = useState('')
  const [allSales, setAllSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loadedCount, setLoadedCount] = useState(0)   // live progress indicator

  // View mode: 'all' = all historical records, 'date' = specific date drilldown
  const [mode, setMode] = useState<'all' | 'date'>('all')
  const [selectedDate, setSelectedDate] = useState(todayISO())

  // Greeting — client-side only to avoid SSR mismatch
  useEffect(() => {
    const update = () => setGreeting(getGreeting())
    update()
    const t = setInterval(update, 60_000)
    return () => clearInterval(t)
  }, [])

  // ── Fetch all records (paginated) ─────────────────────────
  const loadData = useCallback(async (force = false) => {
    if (force) { _cache.data = null; _cache.ts = 0 }
    setRefreshing(true); setLoadedCount(0)
    try {
      const data = await fetchAll(supabase, force)
      setAllSales(data)
      setLoadedCount(data.length)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // ── Derived datasets ─────────────────────────────────────
  // All records sorted newest-first
  const sortedAll = sortByDate(allSales)

  // Records for the selected date (date drilldown mode)
  const importDateStr = isoToImportDate(selectedDate)
  const dateSales = allSales.filter(s => s.date === importDateStr)

  // What to show in the session table
  const tableSales = mode === 'date'
    ? dateSales
    : sortedAll.slice(0, 200)   // most recent 200 for overview

  const tableTitle = mode === 'date'
    ? `Sessions on ${fmtDateShort(importDateStr)}`
    : 'Most Recent Sessions (latest 200)'

  // Summary computed from all records (always all-time)
  const summary = computeSummary(allSales)
  const breakdown = computeBreakdown(mode === 'date' && dateSales.length > 0 ? dateSales : allSales)

  // Date range of the dataset
  const dateRange = allSales.length > 0
    ? `${fmtDateShort(sortedAll[sortedAll.length - 1]?.date)} – ${fmtDateShort(sortedAll[0]?.date)}`
    : ''

  return (
    <>
      <style>{`
        @keyframes shimmer { from{background-position:-200% center} to{background-position:200% center} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        .ov-section { animation: fadeIn 400ms ease both; }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, fontFamily: "'Inter',system-ui,sans-serif" }}>

        {/* ── Header ───────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Dashboard</p>
            <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 300, color: '#1A1A1A', margin: 0, lineHeight: 1.1, minHeight: '1.1em' }}>
              {greeting || '\u00A0'}
            </h2>
            {dateRange && (
              <p style={{ fontSize: 12, color: 'rgba(26,26,26,0.38)', margin: '4px 0 0' }}>
                {allSales.length.toLocaleString()} records · {dateRange}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {loadedCount > 0 && !loading && (
              <span style={{ fontSize: 11, color: 'rgba(26,26,26,0.38)' }}>{loadedCount.toLocaleString()} rows loaded</span>
            )}
            <button onClick={() => loadData(true)} disabled={refreshing}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 15px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', cursor: refreshing ? 'not-allowed' : 'pointer', fontFamily: "'Inter',system-ui,sans-serif" }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ animation: refreshing ? 'spin 700ms linear infinite' : 'none', flexShrink: 0 }}>
                <path d="M10.5 6a4.5 4.5 0 1 1-1.35-3.18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M10.5 2.25V5.5H7.25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {refreshing ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        {loading ? (
          /* ── Loading skeleton ──────────────────────────── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(190px,100%),1fr))', gap: 14 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Shim w={80} h={10} /> <Shim w="70%" h={28} /> <Shim w={120} h={10} />
                </div>
              ))}
            </div>
            <div style={{ padding: '16px 18px', backgroundColor: 'rgba(197,143,59,0.07)', borderRadius: 12, textAlign: 'center', color: 'rgba(26,26,26,0.45)', fontSize: 13, fontStyle: 'italic' }}>
              Fetching all records from bookings_import — this may take a moment for large datasets…
            </div>
          </div>

        ) : error ? (
          /* ── Error ─────────────────────────────────────── */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '40px 24px', textAlign: 'center' }}>
            <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 22, fontWeight: 400, color: '#1A1A1A', margin: 0 }}>
              {error.startsWith('AUTH') ? 'Session expired' : 'Connection error'}
            </p>
            <p style={{ fontSize: 14, color: 'rgba(26,26,26,0.50)', margin: 0, maxWidth: 400 }}>{error}</p>
            <button onClick={() => loadData(true)} style={{ padding: '0 22px', height: 42, backgroundColor: '#1A1A1A', color: '#C58F3B', border: '1px solid rgba(197,143,59,0.35)', borderRadius: 9, fontSize: 12, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'Inter',system-ui,sans-serif" }}>
              Retry
            </button>
          </div>

        ) : (
          <>
            {/* ── All-Time KPI summary ─────────────────────── */}
            <div className="ov-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(197,143,59,0.65)', margin: 0 }}>
                  Historical Summary — All {allSales.length.toLocaleString()} Records
                </p>
              </div>
              <KpiTiles s={summary} label={`${allSales.length.toLocaleString()} total sessions`} />
            </div>

            {/* ── Service breakdown ────────────────────────── */}
            <div className="ov-section" style={{ animationDelay: '60ms' }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(197,143,59,0.65)', margin: '0 0 10px' }}>
                Top Services {mode === 'date' && dateSales.length > 0 ? `on ${fmtDateShort(importDateStr)}` : '(All Time)'}
              </p>
              <BreakdownStrip stats={breakdown} />
            </div>

            {/* ── View mode toggle + date picker ───────────── */}
            <div className="ov-section" style={{ animationDelay: '120ms', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', borderRadius: 9, border: '1px solid rgba(26,26,26,0.14)', overflow: 'hidden' }}>
                {(['all', 'date'] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    style={{ padding: '0 18px', height: 36, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Inter',system-ui,sans-serif", transition: 'all 150ms ease', backgroundColor: mode === m ? '#1A1A1A' : 'transparent', color: mode === m ? '#C58F3B' : 'rgba(26,26,26,0.45)' }}>
                    {m === 'all' ? 'All Records' : 'By Date'}
                  </button>
                ))}
              </div>

              {mode === 'date' && (
                <>
                  <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                    style={{ height: 36, padding: '0 12px', border: '1px solid rgba(26,26,26,0.16)', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#1A1A1A', backgroundColor: '#FFFFFF', fontFamily: "'Inter',system-ui,sans-serif", cursor: 'pointer', outline: 'none' }}
                  />
                  <span style={{ fontSize: 12, color: 'rgba(26,26,26,0.45)', fontFamily: "'Inter',system-ui,sans-serif" }}>
                    → import format: <code style={{ fontSize: 11, padding: '2px 6px', backgroundColor: 'rgba(26,26,26,0.07)', borderRadius: 4 }}>{importDateStr}</code>
                  </span>
                </>
              )}
            </div>

            {/* ── Date-mode empty fallback banner ─────────── */}
            {mode === 'date' && dateSales.length === 0 && (
              <div style={{ padding: '14px 18px', backgroundColor: 'rgba(197,143,59,0.08)', border: '1px solid rgba(197,143,59,0.28)', borderRadius: 11, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="9" cy="9" r="7.5" stroke="#C58F3B" strokeWidth="1.3" />
                  <path d="M9 5.5v3.5M9 11.5h.01" stroke="#C58F3B" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <p style={{ fontSize: 13, color: '#1A1A1A', margin: 0, flex: 1, fontFamily: "'Inter',system-ui,sans-serif" }}>
                  No records found for <strong>{importDateStr}</strong>. Your data spans {dateRange}. &nbsp;
                  <button onClick={() => setMode('all')} style={{ background: 'none', border: 'none', color: '#C58F3B', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontSize: 13, fontFamily: "'Inter',system-ui,sans-serif", padding: 0 }}>
                    View all {allSales.length.toLocaleString()} records →
                  </button>
                </p>
              </div>
            )}

            {/* ── Sessions table ───────────────────────────── */}
            <div className="ov-section" style={{ animationDelay: '180ms' }}>
              <SessionsTable sales={tableSales} title={tableTitle} />
            </div>
          </>
        )}
      </div>
    </>
  )
}