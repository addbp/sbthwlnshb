'use client'

// app/dashboard/reports/page.tsx — Real Analytics
// Fetches all records from bookings_import and computes:
//   · Revenue over time (last 30 days)
//   · Top services by revenue and count
//   · Category breakdown
//   · Customer type (New vs Returning)
//   · Therapist performance
//   · Payment method breakdown
// Uses received_payment for all revenue. Dates parsed from "1-May-25" text format.

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  const year = yr < 100 ? 2000 + yr : yr
  const d = new Date(year, mon, day)
  return isNaN(d.getTime()) ? null : d
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function nDaysAgo(n: number): Date {
  const d = new Date(); d.setDate(d.getDate() - n); return d
}

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface Row {
  date: string
  client_name: string
  service: string
  therapist: string
  received_payment: number
  net_sales: number
  service_amount: number
  category: string
  customer_type: string
  payment_method: string
}

interface Stat { name: string; revenue: number; count: number }

interface Analytics {
  totalRevenue: number
  totalNetSales: number
  sessionCount: number
  avgValue: number
  newClients: number
  returningClients: number
  topService: string
  serviceStats: Stat[]
  categoryStats: Stat[]
  therapistStats: (Stat & { avgValue: number })[]
  paymentStats: Stat[]
  dailyStats: { label: string; iso: string; revenue: number; count: number }[]  // last 30 days
  monthlyStats: { label: string; revenue: number; count: number }[]
}

// ─────────────────────────────────────────────────────────────
// COMPUTE ANALYTICS from raw rows
// ─────────────────────────────────────────────────────────────
function compute(rows: Row[], periodDays: number): Analytics {
  const cutoff = nDaysAgo(periodDays)
  const cutoffISO = isoOf(cutoff)

  // Filter to period
  const inPeriod = rows.filter(r => {
    const d = parseImportDate(r.date)
    if (!d) return false
    return isoOf(d) >= cutoffISO
  })

  // Aggregation helpers
  function groupBy<K extends keyof Row>(arr: Row[], key: K): Record<string, Row[]> {
    const m: Record<string, Row[]> = {}
    for (const r of arr) {
      const k = String(r[key] ?? 'Unknown') || 'Unknown'
        ; (m[k] ?? (m[k] = [])).push(r)
    }
    return m
  }

  function toStat(groups: Record<string, Row[]>): Stat[] {
    return Object.entries(groups)
      .map(([name, rows]) => ({
        name,
        revenue: rows.reduce((a, r) => a + (r.received_payment ?? 0), 0),
        count: rows.length,
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }

  const totalRevenue = inPeriod.reduce((a, r) => a + (r.received_payment ?? 0), 0)
  const totalNetSales = inPeriod.reduce((a, r) => a + (r.net_sales ?? 0), 0)
  const sessionCount = inPeriod.length
  const avgValue = sessionCount > 0 ? totalRevenue / sessionCount : 0
  const newCount = inPeriod.filter(r => r.customer_type?.toLowerCase().includes('new')).length
  const returningCount = sessionCount - newCount
  const serviceStats = toStat(groupBy(inPeriod, 'service')).slice(0, 8)
  const categoryStats = toStat(groupBy(inPeriod, 'category'))
  const paymentStats = toStat(groupBy(inPeriod, 'payment_method'))

  const therapistGroups = groupBy(inPeriod, 'therapist')
  const therapistStats = Object.entries(therapistGroups)
    .map(([name, rows]) => {
      const rev = rows.reduce((a, r) => a + (r.received_payment ?? 0), 0)
      return { name, revenue: rev, count: rows.length, avgValue: rows.length > 0 ? rev / rows.length : 0 }
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // Daily stats — last 30 days
  const dailyMap: Record<string, { revenue: number; count: number }> = {}
  for (let i = periodDays - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    dailyMap[isoOf(d)] = { revenue: 0, count: 0 }
  }
  for (const r of inPeriod) {
    const d = parseImportDate(r.date)
    if (!d) continue
    const iso = isoOf(d)
    if (dailyMap[iso]) {
      dailyMap[iso].revenue += r.received_payment ?? 0
      dailyMap[iso].count++
    }
  }
  const dailyStats = Object.entries(dailyMap).map(([iso, v]) => ({
    iso,
    label: new Date(iso + 'T12:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
    ...v,
  }))

  // Monthly stats — all time
  const monthlyMap: Record<string, { revenue: number; count: number }> = {}
  for (const r of rows) {
    const d = parseImportDate(r.date)
    if (!d) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const lbl = `${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`
    if (!monthlyMap[key]) monthlyMap[key] = { revenue: 0, count: 0 }
    monthlyMap[key].revenue += r.received_payment ?? 0
    monthlyMap[key].count++
  }
  const monthlyStats = Object.entries(monthlyMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => {
      const parts = key.split('-')
      return { label: `${MONTH_ABBR[parseInt(parts[1], 10) - 1]} ${parts[0]}`, ...v }
    })
    .slice(-12)   // last 12 months

  return {
    totalRevenue, totalNetSales, sessionCount, avgValue,
    newClients: newCount, returningClients: returningCount,
    topService: serviceStats[0]?.name ?? '—',
    serviceStats, categoryStats, therapistStats, paymentStats,
    dailyStats, monthlyStats,
  }
}

// ─────────────────────────────────────────────────────────────
// FORMATTERS
// ─────────────────────────────────────────────────────────────
const fmt = (n: number) => '₱' + n.toLocaleString('en-PH')
const fmtK = (n: number) => n >= 1000 ? `₱${(n / 1000).toFixed(1)}k` : fmt(n)

// ─────────────────────────────────────────────────────────────
// INLINE SVG BAR CHART
// ─────────────────────────────────────────────────────────────
function BarChart({
  data,
  height = 100,
  color = '#C58F3B',
  showLabels = true,
}: {
  data: { label: string; value: number }[]
  height?: number
  color?: string
  showLabels?: boolean
}) {
  const max = Math.max(...data.map(d => d.value), 1)
  const bw = 100 / data.length
  const barH = height - (showLabels ? 20 : 4)

  return (
    <div style={{ position: 'relative', width: '100%', height: height + 4 }}>
      <svg viewBox={`0 0 ${data.length * 20} ${height}`} preserveAspectRatio="none"
        style={{ width: '100%', height: height, display: 'block' }}>
        {data.map((d, i) => {
          const h = Math.round((d.value / max) * barH)
          const x = i * 20 + 1
          const y = barH - h
          return (
            <g key={i}>
              {/* Background */}
              <rect x={x} y={0} width={18} height={barH} fill="rgba(197,143,59,0.08)" rx={2} />
              {/* Bar */}
              <rect x={x} y={y} width={18} height={h} fill={d.value > 0 ? color : 'transparent'} rx={2}>
                <title>{d.label}: {fmtK(d.value)}</title>
              </rect>
            </g>
          )
        })}
      </svg>
      {showLabels && (
        <div style={{ display: 'flex', width: '100%', marginTop: 3 }}>
          {data.map((d, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'rgba(26,26,26,0.38)', fontFamily: "'Inter',system-ui,sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 1px' }}>
              {d.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// HORIZONTAL BAR (for service / category rankings)
// ─────────────────────────────────────────────────────────────
function HBar({ label, value, max, sub, rank }: { label: string; value: number; max: number; sub?: string; rank?: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5, flexWrap: 'wrap', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {rank !== undefined && (
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(26,26,26,0.25)', fontFamily: "'Inter',system-ui,sans-serif", minWidth: 16 }}>#{rank}</span>
          )}
          <span style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', fontFamily: "'Inter',system-ui,sans-serif" }}>{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', fontFamily: "'Inter',system-ui,sans-serif" }}>{fmt(value)}</span>
          {sub && <span style={{ fontSize: 11, color: 'rgba(26,26,26,0.40)', fontFamily: "'Inter',system-ui,sans-serif" }}>{sub}</span>}
        </div>
      </div>
      <div style={{ height: 7, borderRadius: 99, backgroundColor: 'rgba(197,143,59,0.12)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 99, backgroundColor: '#C58F3B', width: `${pct}%`, transition: 'width 700ms cubic-bezier(0.22,1,0.36,1)' }} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SECTION CARD
// ─────────────────────────────────────────────────────────────
function Card({ title, children, sub }: { title: string; children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ backgroundColor: '#FFFFFF', backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, padding: '22px 22px', boxShadow: '0 3px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, paddingBottom: 12, borderBottom: '1px solid rgba(197,143,59,0.13)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 18, height: 2, backgroundColor: '#C58F3B', display: 'inline-block', flexShrink: 0, borderRadius: 2 }} />
          <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 19, fontWeight: 400, color: '#1A1A1A', margin: 0 }}>{title}</h3>
        </div>
        {sub && <span style={{ fontSize: 11, color: 'rgba(26,26,26,0.38)', fontFamily: "'Inter',system-ui,sans-serif", fontStyle: 'italic', flexShrink: 0 }}>{sub}</span>}
      </div>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const supabase = useRef(createClient()).current

  const [allRows, setAllRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState(30)   // days: 7 | 30 | 90 | 365

  const loadAll = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data, error: dbErr } = await supabase
        .from('bookings_import')
        .select('date, client_name, service, therapist, received_payment, net_sales, service_amount, category, customer_type, payment_method')
        .order('date', { ascending: false })   // text sort — good enough for recent-first display

      if (dbErr) throw new Error(dbErr.message)
      setAllRows((data ?? []) as Row[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadAll() }, [loadAll])

  const a = compute(allRows, period)

  // Shimmer skeleton
  const Shim = ({ w = '100%', h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) => (
    <div style={{ width: w, height: h, borderRadius: r, background: 'linear-gradient(90deg,#EDE8E0 0%,#E0D8CE 50%,#EDE8E0 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite' }} />
  )

  return (
    <>
      <style>{`@keyframes shimmer{from{background-position:-200% center}to{background-position:200% center}}`}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, fontFamily: "'Inter',system-ui,sans-serif" }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Analytics</p>
            <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Reports</h2>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'rgba(26,26,26,0.38)', fontFamily: "'Inter',system-ui,sans-serif", marginRight: 4 }}>Period:</span>
            {[
              { label: '7 days', v: 7 },
              { label: '30 days', v: 30 },
              { label: '90 days', v: 90 },
              { label: 'All year', v: 365 },
            ].map(opt => (
              <button key={opt.v} onClick={() => setPeriod(opt.v)} style={{ padding: '0 14px', height: 34, borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', border: '1px solid', transition: 'all 150ms ease', fontFamily: "'Inter',system-ui,sans-serif", backgroundColor: period === opt.v ? '#1A1A1A' : 'transparent', borderColor: period === opt.v ? '#1A1A1A' : 'rgba(26,26,26,0.16)', color: period === opt.v ? '#C58F3B' : 'rgba(26,26,26,0.42)' }}>
                {opt.label}
              </button>
            ))}
            <button onClick={loadAll} style={{ padding: '0 16px', height: 34, border: '1px solid rgba(197,143,59,0.40)', borderRadius: 8, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'Inter',system-ui,sans-serif" }}>
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '14px 18px', backgroundColor: 'rgba(139,58,58,0.09)', border: '1px solid rgba(139,58,58,0.28)', borderRadius: 12, color: '#8B3A3A', fontSize: 14 }}>
            {error} <button onClick={loadAll} style={{ marginLeft: 12, padding: '4px 12px', borderRadius: 7, backgroundColor: 'rgba(139,58,58,0.14)', border: '1px solid rgba(139,58,58,0.28)', color: '#8B3A3A', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Retry</button>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(190px,100%),1fr))', gap: 14 }}>
              {[1, 2, 3, 4].map(i => <div key={i} style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}><Shim w={80} h={10} /><Shim w="70%" h={32} /><Shim w={120} h={10} /></div>)}
            </div>
          </div>
        ) : (
          <>
            {/* ── KPI Strip ───────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(180px,100%),1fr))', gap: 14 }}>
              {[
                { label: 'Total Revenue', value: fmt(a.totalRevenue), sub: `Last ${period} days`, dark: true },
                { label: 'Net Sales', value: fmt(a.totalNetSales), sub: 'After deductions', dark: false },
                { label: 'Sessions', value: String(a.sessionCount), sub: `${fmt(Math.round(a.avgValue))} avg`, dark: false },
                { label: 'New Clients', value: String(a.newClients), sub: `${a.returningClients} returning`, dark: false },
                { label: 'Top Service', value: a.topService, sub: a.serviceStats[0] ? `${fmt(a.serviceStats[0].revenue)}` : '', dark: false, small: true },
              ].map(t => {
                const bg = t.dark ? '#1A1A1A' : '#FFFFFF'
                const vCol = t.dark ? '#F3E9E0' : '#1A1A1A'
                const lCol = t.dark ? 'rgba(243,233,224,0.50)' : '#7A6E65'
                const sCol = t.dark ? 'rgba(243,233,224,0.38)' : '#9A8E85'
                const bdr = t.dark ? 'rgba(197,143,59,0.20)' : 'rgba(26,26,26,0.09)'
                return (
                  <div key={t.label} style={{ position: 'relative', overflow: 'hidden', backgroundColor: bg, backgroundImage: 'none', border: `1px solid ${bdr}`, borderRadius: 16, padding: '18px 20px', boxShadow: t.dark ? '0 6px 20px rgba(0,0,0,0.18)' : '0 2px 10px rgba(0,0,0,0.06)' }}>
                    {!t.dark && <div style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 2, backgroundColor: '#C58F3B', opacity: 0.40, borderRadius: '0 0 2px 2px' }} />}
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: lCol, margin: '0 0 9px' }}>{t.label}</p>
                    <p style={{ fontSize: t.small ? '1rem' : 'clamp(1.4rem,2.4vw,1.9rem)', fontWeight: 700, lineHeight: 1, color: vCol, margin: '0 0 5px' }}>{t.value}</p>
                    <p style={{ fontSize: 11, color: sCol, margin: 0 }}>{t.sub}</p>
                  </div>
                )
              })}
            </div>

            {/* ── Revenue Over Time + Monthly ──────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(340px,100%),1fr))', gap: 16 }}>
              <Card title={`Daily Revenue — Last ${period} Days`} sub={`${fmt(a.totalRevenue)} total`}>
                <BarChart
                  data={a.dailyStats.map(d => ({ label: d.label, value: d.revenue }))}
                  height={110}
                  showLabels={period <= 30}
                />
                {period > 30 && (
                  <p style={{ fontSize: 11, color: 'rgba(26,26,26,0.38)', margin: 0, textAlign: 'center', fontStyle: 'italic' }}>
                    Labels hidden for {period}-day view — hover bars for values
                  </p>
                )}
              </Card>

              <Card title="Monthly Revenue — All Time" sub={`${a.monthlyStats.length} months`}>
                <BarChart
                  data={a.monthlyStats.map(d => ({ label: d.label, value: d.revenue }))}
                  height={110}
                />
              </Card>
            </div>

            {/* ── Top Services + Categories ────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(340px,100%),1fr))', gap: 16 }}>
              <Card title="Top Services by Revenue" sub={`Last ${period} days`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {a.serviceStats.length === 0 && (
                    <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.38)', fontStyle: 'italic', margin: 0 }}>No data for this period.</p>
                  )}
                  {a.serviceStats.map((s, i) => (
                    <HBar
                      key={s.name}
                      label={s.name}
                      value={s.revenue}
                      max={a.serviceStats[0]?.revenue ?? 1}
                      sub={`${s.count} session${s.count !== 1 ? 's' : ''}`}
                      rank={i + 1}
                    />
                  ))}
                </div>
              </Card>

              <Card title="Category Breakdown" sub={`${a.categoryStats.length} categories`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {a.categoryStats.length === 0 && (
                    <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.38)', fontStyle: 'italic', margin: 0 }}>No data for this period.</p>
                  )}
                  {a.categoryStats.map(s => (
                    <HBar
                      key={s.name}
                      label={s.name}
                      value={s.revenue}
                      max={a.categoryStats[0]?.revenue ?? 1}
                      sub={`${s.count} sessions`}
                    />
                  ))}
                </div>
                {/* Customer type pie-style summary */}
                <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: '1px solid rgba(26,26,26,0.07)' }}>
                  {[
                    { label: 'New Clients', n: a.newClients, color: '#3D7A4A' },
                    { label: 'Returning Clients', n: a.returningClients, color: '#C58F3B' },
                  ].map(t => {
                    const pct = a.sessionCount > 0 ? Math.round((t.n / a.sessionCount) * 100) : 0
                    return (
                      <div key={t.label} style={{ flex: 1, padding: '10px 14px', backgroundColor: t.color + '14', border: `1px solid ${t.color}44`, borderRadius: 10, textAlign: 'center' }}>
                        <p style={{ fontSize: 22, fontWeight: 700, color: t.color, margin: '0 0 2px', fontFamily: "'Inter',system-ui,sans-serif" }}>{t.n}</p>
                        <p style={{ fontSize: 11, color: t.color, margin: '0 0 2px', fontWeight: 600, fontFamily: "'Inter',system-ui,sans-serif", letterSpacing: '0.05em' }}>{t.label}</p>
                        <p style={{ fontSize: 10, color: 'rgba(26,26,26,0.38)', margin: 0, fontFamily: "'Inter',system-ui,sans-serif" }}>{pct}% of sessions</p>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>

            {/* ── Therapist Performance ────────────────────────── */}
            <Card title="Therapist Performance" sub={`Top ${a.therapistStats.length} · Last ${period} days`}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)' }}>
                      {['Therapist', 'Sessions', 'Total Revenue', 'Avg per Session', '% of Revenue'].map(h => (
                        <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C58F3B', backgroundColor: '#F8F4EE', whiteSpace: 'nowrap', fontFamily: "'Inter',system-ui,sans-serif" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {a.therapistStats.map((t, i) => (
                      <tr key={t.name} style={{ borderBottom: i < a.therapistStats.length - 1 ? '1px solid rgba(26,26,26,0.06)' : 'none', transition: 'background 120ms ease' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(197,143,59,0.04)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1A1A1A', fontFamily: "'Inter',system-ui,sans-serif" }}>{t.name}</td>
                        <td style={{ padding: '11px 14px', color: 'rgba(26,26,26,0.60)', fontFamily: "'Inter',system-ui,sans-serif" }}>{t.count}</td>
                        <td style={{ padding: '11px 14px', fontWeight: 700, color: '#1A1A1A', fontFamily: "'Inter',system-ui,sans-serif" }}>{fmt(t.revenue)}</td>
                        <td style={{ padding: '11px 14px', color: 'rgba(26,26,26,0.60)', fontFamily: "'Inter',system-ui,sans-serif" }}>{fmt(Math.round(t.avgValue))}</td>
                        <td style={{ padding: '11px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, borderRadius: 99, backgroundColor: 'rgba(197,143,59,0.12)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', borderRadius: 99, backgroundColor: '#C58F3B', width: `${a.totalRevenue > 0 ? Math.round((t.revenue / a.totalRevenue) * 100) : 0}%` }} />
                            </div>
                            <span style={{ fontSize: 11, color: 'rgba(26,26,26,0.50)', minWidth: 30, fontFamily: "'Inter',system-ui,sans-serif" }}>
                              {a.totalRevenue > 0 ? Math.round((t.revenue / a.totalRevenue) * 100) : 0}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {a.therapistStats.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: '32px 14px', textAlign: 'center', color: '#9A8E85', fontStyle: 'italic', fontFamily: "'Inter',system-ui,sans-serif" }}>No data for this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* ── Payment Methods ──────────────────────────────── */}
            <Card title="Payment Methods" sub={`Last ${period} days`}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(180px,100%),1fr))', gap: 10 }}>
                {a.paymentStats.map(p => (
                  <div key={p.name} style={{ padding: '14px 16px', backgroundColor: 'rgba(197,143,59,0.06)', border: '1px solid rgba(197,143,59,0.18)', borderRadius: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 6px', fontFamily: "'Inter',system-ui,sans-serif" }}>{p.name || 'Unknown'}</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: '0 0 2px', fontFamily: "'Inter',system-ui,sans-serif" }}>{fmt(p.revenue)}</p>
                    <p style={{ fontSize: 12, color: 'rgba(26,26,26,0.45)', margin: 0, fontFamily: "'Inter',system-ui,sans-serif" }}>{p.count} transaction{p.count !== 1 ? 's' : ''}</p>
                  </div>
                ))}
                {a.paymentStats.length === 0 && (
                  <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.38)', fontStyle: 'italic', margin: 0, gridColumn: '1/-1' }}>No payment data for this period.</p>
                )}
              </div>
            </Card>

            {/* Data note */}
            <p style={{ fontSize: 11, color: 'rgba(26,26,26,0.30)', textAlign: 'center', margin: 0, fontStyle: 'italic', fontFamily: "'Inter',system-ui,sans-serif" }}>
              {allRows.length.toLocaleString()} total records · Revenue uses <code style={{ fontSize: 10, backgroundColor: 'rgba(26,26,26,0.07)', padding: '1px 5px', borderRadius: 4 }}>received_payment</code> column · Dates parsed from text format "D-Mon-YY"
            </p>
          </>
        )}
      </div>
    </>
  )
}