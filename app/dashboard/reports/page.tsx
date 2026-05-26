'use client'

// app/dashboard/reports/page.tsx — Real Analytics
// FIX 1: "All Time" uses periodDays=0 which skips the date filter entirely.
//   The old "All Year" (365 days) excluded 2025 data when accessed in 2026.
// FIX 2: fetchAllPaginated() retrieves all 10,200 rows via 1000-row chunks.
//   The old single query was capped at Supabase's 1000-row default limit.
// All revenue uses received_payment. Dates parsed from "D-Mon-YY" text.

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback, useRef } from 'react'
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

function isoOf(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─────────────────────────────────────────────────────────────
// PAGINATED FETCH — retrieves ALL rows regardless of count
// ─────────────────────────────────────────────────────────────
interface RawRow {
    date: string
    client_name: string
    service: string
    therapist: string
    received_payment: number
    net_sales: number
    category: string
    customer_type: string
    payment_method: string
}

async function fetchAllPaginated(
    supabase: ReturnType<typeof createClient>,
): Promise<RawRow[]> {
    const COLS = 'date,client_name,service,therapist,received_payment,net_sales,category,customer_type,payment_method'
    const PAGE = 1000
    const all: RawRow[] = []
    let from = 0

    for (; ;) {
        const { data, error } = await supabase
            .from('bookings_import')
            .select(COLS)
            .range(from, from + PAGE - 1)

        if (error) throw new Error(error.message)
        if (!data || data.length === 0) break
        all.push(...data as RawRow[])
        if (data.length < PAGE) break
        from += PAGE
        if (from > 200_000) break // safety
    }

    return all
}

// ─────────────────────────────────────────────────────────────
// ANALYTICS ENGINE
// periodDays = 0 → ALL TIME (no date filter)
// periodDays > 0 → last N calendar days from today
// ─────────────────────────────────────────────────────────────
interface Stat { name: string; revenue: number; count: number }

interface Analytics {
    totalRevenue: number
    totalNetSales: number
    sessionCount: number
    avgValue: number
    newClients: number
    returningClients: number
    uniqueClients: number
    topService: string
    serviceStats: Stat[]
    categoryStats: Stat[]
    therapistStats: (Stat & { avgValue: number })[]
    paymentStats: Stat[]
    dailyStats: { label: string; iso: string; revenue: number; count: number }[]
    monthlyStats: { label: string; revenue: number; count: number }[]
    dataRange: string
}

function compute(rows: RawRow[], periodDays: number): Analytics {
    // ── Filter to period ──────────────────────────────────────
    // periodDays === 0 means "All Time" — use every row
    let inPeriod: RawRow[]
    if (periodDays === 0) {
        inPeriod = rows   // ALL records, no date filter
    } else {
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - periodDays)
        const cutoffISO = isoOf(cutoff)
        inPeriod = rows.filter(r => {
            const d = parseImportDate(r.date)
            return d ? isoOf(d) >= cutoffISO : false
        })
    }

    // ── Aggregation helper ────────────────────────────────────
    function groupStat(arr: RawRow[], key: keyof RawRow): Stat[] {
        const m: Record<string, Stat> = {}
        for (const r of arr) {
            const k = String(r[key] ?? 'Unknown') || 'Unknown'
            if (!m[k]) m[k] = { name: k, revenue: 0, count: 0 }
            m[k].revenue += Number(r.received_payment ?? 0)
            m[k].count++
        }
        return Object.values(m).sort((a, b) => b.revenue - a.revenue)
    }

    const totalRevenue = inPeriod.reduce((a, r) => a + Number(r.received_payment ?? 0), 0)
    const totalNetSales = inPeriod.reduce((a, r) => a + Number(r.net_sales ?? 0), 0)
    const sessionCount = inPeriod.length
    const avgValue = sessionCount > 0 ? totalRevenue / sessionCount : 0
    const newCount = inPeriod.filter(r => r.customer_type?.toLowerCase().includes('new')).length
    const uniqueNames = new Set(inPeriod.map(r => String(r.client_name ?? '').toLowerCase()))
    const serviceStats = groupStat(inPeriod, 'service').slice(0, 10)
    const categoryStats = groupStat(inPeriod, 'category')
    const paymentStats = groupStat(inPeriod, 'payment_method')

    const therapistGroups: Record<string, number[]> = {}
    for (const r of inPeriod) {
        const t = String(r.therapist ?? 'Unknown')
            ; (therapistGroups[t] ?? (therapistGroups[t] = [])).push(Number(r.received_payment ?? 0))
    }
    const therapistStats = Object.entries(therapistGroups).map(([name, vals]) => ({
        name,
        revenue: vals.reduce((a, v) => a + v, 0),
        count: vals.length,
        avgValue: vals.length > 0 ? vals.reduce((a, v) => a + v, 0) / vals.length : 0,
    })).sort((a, b) => b.revenue - a.revenue).slice(0, 10)

    // ── Daily stats ───────────────────────────────────────────
    // For "All Time" or large periods, show monthly bars instead of daily
    const useDailyBars = periodDays > 0 && periodDays <= 90
    const dailyMap: Record<string, { revenue: number; count: number }> = {}

    if (useDailyBars) {
        for (let i = periodDays - 1; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i)
            dailyMap[isoOf(d)] = { revenue: 0, count: 0 }
        }
    }

    for (const r of inPeriod) {
        const d = parseImportDate(r.date)
        if (!d) continue
        const iso = isoOf(d)
        if (useDailyBars && dailyMap[iso]) {
            dailyMap[iso].revenue += Number(r.received_payment ?? 0)
            dailyMap[iso].count++
        } else if (!useDailyBars) {
            if (!dailyMap[iso]) dailyMap[iso] = { revenue: 0, count: 0 }
            dailyMap[iso].revenue += Number(r.received_payment ?? 0)
            dailyMap[iso].count++
        }
    }

    const dailyStats = Object.entries(dailyMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([iso, v]) => ({
            iso,
            label: new Date(iso + 'T12:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
            ...v,
        }))

    // ── Monthly stats (always computed for the monthly chart) ─
    const monthlyMap: Record<string, { revenue: number; count: number }> = {}
    for (const r of inPeriod) {
        const d = parseImportDate(r.date)
        if (!d) continue
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (!monthlyMap[key]) monthlyMap[key] = { revenue: 0, count: 0 }
        monthlyMap[key].revenue += Number(r.received_payment ?? 0)
        monthlyMap[key].count++
    }
    const monthlyStats = Object.entries(monthlyMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, v]) => {
            const [y, mo] = key.split('-')
            return { label: `${MONTH_ABBR[parseInt(mo, 10) - 1]} ${y}`, ...v }
        })

    // ── Date range label ──────────────────────────────────────
    const allDates = inPeriod
        .map(r => parseImportDate(r.date))
        .filter((d): d is Date => d !== null)
    let dataRange = ''
    if (allDates.length > 0) {
        const sorted = allDates.sort((a, b) => a.getTime() - b.getTime())
        const fmtD = (d: Date) => d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
        dataRange = `${fmtD(sorted[0])} – ${fmtD(sorted[sorted.length - 1])}`
    }

    return {
        totalRevenue, totalNetSales, sessionCount, avgValue,
        newClients: newCount, returningClients: sessionCount - newCount,
        uniqueClients: uniqueNames.size,
        topService: serviceStats[0]?.name ?? '—',
        serviceStats, categoryStats, therapistStats, paymentStats,
        dailyStats, monthlyStats, dataRange,
    }
}

// ─────────────────────────────────────────────────────────────
// FORMATTERS
// ─────────────────────────────────────────────────────────────
const fmt = (n: number) => '₱' + n.toLocaleString('en-PH')
const fmtK = (n: number) => n >= 1_000_000 ? `₱${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `₱${(n / 1000).toFixed(1)}k` : fmt(n)

// ─────────────────────────────────────────────────────────────
// BAR CHART  (inline SVG)
// ─────────────────────────────────────────────────────────────
function BarChart({ data, height = 100, showLabels = true }: { data: { label: string; value: number }[]; height?: number; showLabels?: boolean }) {
    const max = Math.max(...data.map(d => d.value), 1)
    const barH = height - (showLabels ? 22 : 4)
    const bw = 100 / Math.max(data.length, 1)

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <svg viewBox={`0 0 ${Math.max(data.length, 1) * 20} ${height}`} preserveAspectRatio="none"
                style={{ width: '100%', height: height, display: 'block' }}>
                {data.map((d, i) => {
                    const h = Math.max(Math.round((d.value / max) * barH), d.value > 0 ? 2 : 0)
                    const x = i * 20 + 1
                    return (
                        <g key={i}>
                            <rect x={x} y={0} width={18} height={barH} fill="rgba(197,143,59,0.08)" rx="2" />
                            {h > 0 && (
                                <rect x={x} y={barH - h} width={18} height={h} fill="#C58F3B" rx="2">
                                    <title>{d.label}: {fmtK(d.value)}</title>
                                </rect>
                            )}
                        </g>
                    )
                })}
            </svg>
            {showLabels && data.length <= 31 && (
                <div style={{ display: 'flex', width: '100%' }}>
                    {data.map((d, i) => (
                        <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: 'rgba(26,26,26,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '2px 1px', fontFamily: "'Inter',system-ui,sans-serif" }}>
                            {d.label}
                        </div>
                    ))}
                </div>
            )}
            {showLabels && data.length > 31 && (
                <p style={{ fontSize: 10, color: 'rgba(26,26,26,0.35)', textAlign: 'center', margin: '4px 0 0', fontStyle: 'italic', fontFamily: "'Inter',system-ui,sans-serif" }}>
                    {data.length} data points — hover bars for values
                </p>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// HORIZONTAL BAR
// ─────────────────────────────────────────────────────────────
function HBar({ label, value, max, sub, rank }: { label: string; value: number; max: number; sub?: string; rank?: number }) {
    const pct = max > 0 ? (value / max) * 100 : 0
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {rank !== undefined && <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(26,26,26,0.22)', minWidth: 18, fontFamily: "'Inter',system-ui,sans-serif" }}>#{rank}</span>}
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', fontFamily: "'Inter',system-ui,sans-serif" }}>{label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', fontFamily: "'Inter',system-ui,sans-serif" }}>{fmtK(value)}</span>
                    {sub && <span style={{ fontSize: 11, color: 'rgba(26,26,26,0.40)', fontFamily: "'Inter',system-ui,sans-serif" }}>{sub}</span>}
                </div>
            </div>
            <div style={{ height: 6, borderRadius: 99, backgroundColor: 'rgba(197,143,59,0.11)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 99, backgroundColor: '#C58F3B', width: `${pct}%`, transition: 'width 700ms cubic-bezier(0.22,1,0.36,1)' }} />
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// CARD WRAPPER
// ─────────────────────────────────────────────────────────────
function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
    return (
        <div style={{ backgroundColor: '#FFFFFF', backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 15, padding: '20px 20px', boxShadow: '0 3px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, paddingBottom: 11, borderBottom: '1px solid rgba(197,143,59,0.12)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ width: 16, height: 2, backgroundColor: '#C58F3B', display: 'inline-block', flexShrink: 0, borderRadius: 2 }} />
                    <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 19, fontWeight: 400, color: '#1A1A1A', margin: 0 }}>{title}</h3>
                </div>
                {sub && <span style={{ fontSize: 11, color: 'rgba(26,26,26,0.36)', fontFamily: "'Inter',system-ui,sans-serif", fontStyle: 'italic', flexShrink: 0 }}>{sub}</span>}
            </div>
            {children}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────

// Period options — 0 means "All Time" (no date filter)
const PERIODS = [
    { label: 'All Time', v: 0 },
    { label: '90 Days', v: 90 },
    { label: '30 Days', v: 30 },
    { label: '7 Days', v: 7 },
]

export default function ReportsPage() {
    const supabase = useRef(createClient()).current

    const [allRows, setAllRows] = useState<RawRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [period, setPeriod] = useState(0)   // default: All Time

    const loadAll = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const rows = await fetchAllPaginated(supabase)
            setAllRows(rows)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load analytics.')
        } finally {
            setLoading(false)
        }
    }, [supabase])

    useEffect(() => { loadAll() }, [loadAll])

    const a = compute(allRows, period)

    // For the revenue chart: use daily if ≤90 days, monthly otherwise
    const revenueChartData = period > 0 && period <= 90
        ? a.dailyStats.map(d => ({ label: d.label, value: d.revenue }))
        : a.monthlyStats.map(d => ({ label: d.label, value: d.revenue }))
    const revenueChartTitle = period > 0 && period <= 90 ? `Daily Revenue — Last ${period} Days` : 'Monthly Revenue'

    const Shim = ({ w = '100%', h = 13, r = 5 }: { w?: string | number; h?: number; r?: number }) => (
        <div style={{ width: w, height: h, borderRadius: r, background: 'linear-gradient(90deg,#EDE8E0 0%,#E0D8CE 50%,#EDE8E0 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite' }} />
    )

    return (
        <>
            <style>{`@keyframes shimmer{from{background-position:-200% center}to{background-position:200% center}}`}</style>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 26, fontFamily: "'Inter',system-ui,sans-serif" }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Analytics</p>
                        <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Reports</h2>
                        {allRows.length > 0 && !loading && (
                            <p style={{ fontSize: 12, color: 'rgba(26,26,26,0.38)', margin: '3px 0 0' }}>
                                {allRows.length.toLocaleString()} total records · {a.dataRange || 'all time'}
                            </p>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {PERIODS.map(opt => (
                            <button key={opt.v} onClick={() => setPeriod(opt.v)}
                                style={{ padding: '0 14px', height: 34, borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', border: '1px solid', transition: 'all 140ms ease', fontFamily: "'Inter',system-ui,sans-serif", backgroundColor: period === opt.v ? '#1A1A1A' : 'transparent', borderColor: period === opt.v ? '#1A1A1A' : 'rgba(26,26,26,0.16)', color: period === opt.v ? '#C58F3B' : 'rgba(26,26,26,0.42)' }}>
                                {opt.label}
                            </button>
                        ))}
                        <button onClick={loadAll} style={{ padding: '0 14px', height: 34, border: '1px solid rgba(197,143,59,0.40)', borderRadius: 7, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'Inter',system-ui,sans-serif" }}>
                            Refresh
                        </button>
                    </div>
                </div>

                {error && (
                    <div style={{ padding: '13px 16px', backgroundColor: 'rgba(139,58,58,0.09)', border: '1px solid rgba(139,58,58,0.28)', borderRadius: 11, color: '#8B3A3A', fontSize: 14 }}>
                        {error} <button onClick={loadAll} style={{ marginLeft: 12, padding: '4px 12px', borderRadius: 6, backgroundColor: 'rgba(139,58,58,0.14)', border: '1px solid rgba(139,58,58,0.28)', color: '#8B3A3A', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Retry</button>
                    </div>
                )}

                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(180px,100%),1fr))', gap: 13 }}>
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <Shim w={70} h={9} /> <Shim w="65%" h={26} /> <Shim w={110} h={9} />
                                </div>
                            ))}
                        </div>
                        <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(26,26,26,0.38)', fontStyle: 'italic', margin: 0 }}>
                            Fetching all records — this may take a moment…
                        </p>
                    </div>
                ) : (
                    <>
                        {/* ── KPI strip ──────────────────────────────── */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(175px,100%),1fr))', gap: 12 }}>
                            {[
                                { l: 'Total Revenue', v: fmtK(a.totalRevenue), s: `${a.sessionCount.toLocaleString()} sessions`, dk: true },
                                { l: 'Net Sales', v: fmtK(a.totalNetSales), s: 'After deductions', dk: false },
                                { l: 'Avg per Session', v: fmtK(Math.round(a.avgValue)), s: 'Revenue ÷ sessions', dk: false },
                                { l: 'Unique Clients', v: a.uniqueClients.toLocaleString(), s: `${a.newClients} new · ${a.returningClients} returning`, dk: false },
                                { l: 'Top Service', v: a.topService, s: a.serviceStats[0] ? fmtK(a.serviceStats[0].revenue) : '', dk: false, small: true },
                            ].map(t => {
                                const bg = t.dk ? '#1A1A1A' : '#FFFFFF'
                                const vCol = t.dk ? '#F3E9E0' : '#1A1A1A'
                                const lCol = t.dk ? 'rgba(243,233,224,0.50)' : '#7A6E65'
                                const sCol = t.dk ? 'rgba(243,233,224,0.38)' : '#9A8E85'
                                return (
                                    <div key={t.l} style={{ position: 'relative', overflow: 'hidden', backgroundColor: bg, backgroundImage: 'none', border: `1px solid ${t.dk ? 'rgba(197,143,59,0.20)' : 'rgba(26,26,26,0.09)'}`, borderRadius: 14, padding: '17px 18px', boxShadow: t.dk ? '0 5px 18px rgba(0,0,0,0.16)' : '0 2px 8px rgba(0,0,0,0.05)' }}>
                                        {!t.dk && <div style={{ position: 'absolute', top: 0, left: 12, right: 12, height: 2, backgroundColor: '#C58F3B', opacity: 0.38, borderRadius: '0 0 2px 2px' }} />}
                                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: lCol, margin: '0 0 8px', fontFamily: "'Inter',system-ui,sans-serif" }}>{t.l}</p>
                                        <p style={{ fontSize: t.small ? '1rem' : 'clamp(1.3rem,2.2vw,1.8rem)', fontWeight: 700, lineHeight: 1, color: vCol, margin: '0 0 4px', fontFamily: "'Inter',system-ui,sans-serif" }}>{t.v}</p>
                                        <p style={{ fontSize: 11, color: sCol, margin: 0, fontFamily: "'Inter',system-ui,sans-serif" }}>{t.s}</p>
                                    </div>
                                )
                            })}
                        </div>

                        {/* ── Revenue chart + Monthly chart ──────────── */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(340px,100%),1fr))', gap: 15 }}>
                            <Card title={revenueChartTitle} sub={fmtK(a.totalRevenue) + ' total'}>
                                <BarChart data={revenueChartData} height={120} showLabels={revenueChartData.length <= 31} />
                            </Card>

                            {period === 0 && a.monthlyStats.length > 0 && (
                                <Card title="Monthly Breakdown" sub={`${a.monthlyStats.length} months`}>
                                    <BarChart data={a.monthlyStats.map(d => ({ label: d.label, value: d.revenue }))} height={120} />
                                </Card>
                            )}
                        </div>

                        {/* ── Top services + Categories ───────────────── */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(340px,100%),1fr))', gap: 15 }}>
                            <Card title="Top Services" sub={`${a.serviceStats.length} services`}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                                    {a.serviceStats.length === 0 ? (
                                        <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.38)', fontStyle: 'italic', margin: 0 }}>No data.</p>
                                    ) : a.serviceStats.map((s, i) => (
                                        <HBar key={s.name} label={s.name} value={s.revenue} max={a.serviceStats[0]?.revenue ?? 1}
                                            sub={`${s.count.toLocaleString()} sessions`} rank={i + 1} />
                                    ))}
                                </div>
                            </Card>

                            <Card title="Category Breakdown" sub={`${a.categoryStats.length} categories`}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                                    {a.categoryStats.map(s => (
                                        <HBar key={s.name} label={s.name} value={s.revenue} max={a.categoryStats[0]?.revenue ?? 1}
                                            sub={`${s.count.toLocaleString()} sessions`} />
                                    ))}
                                </div>
                                {/* New vs Returning */}
                                <div style={{ display: 'flex', gap: 9, paddingTop: 8, borderTop: '1px solid rgba(26,26,26,0.07)' }}>
                                    {[
                                        { label: 'New Clients', n: a.newClients, color: '#3D7A4A' },
                                        { label: 'Returning Clients', n: a.returningClients, color: '#C58F3B' },
                                    ].map(t => {
                                        const pct = a.sessionCount > 0 ? Math.round((t.n / a.sessionCount) * 100) : 0
                                        return (
                                            <div key={t.label} style={{ flex: 1, padding: '10px 12px', backgroundColor: t.color + '14', border: `1px solid ${t.color}44`, borderRadius: 9, textAlign: 'center' }}>
                                                <p style={{ fontSize: 20, fontWeight: 700, color: t.color, margin: '0 0 1px', fontFamily: "'Inter',system-ui,sans-serif" }}>{t.n.toLocaleString()}</p>
                                                <p style={{ fontSize: 10, color: t.color, margin: '0 0 1px', fontWeight: 700, fontFamily: "'Inter',system-ui,sans-serif", letterSpacing: '0.05em', textTransform: 'uppercase' }}>{t.label}</p>
                                                <p style={{ fontSize: 10, color: 'rgba(26,26,26,0.35)', margin: 0, fontFamily: "'Inter',system-ui,sans-serif" }}>{pct}%</p>
                                            </div>
                                        )
                                    })}
                                </div>
                            </Card>
                        </div>

                        {/* ── Therapist table ─────────────────────────── */}
                        <Card title="Therapist Performance" sub={`Top ${a.therapistStats.length}`}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)' }}>
                                            {['Therapist', 'Sessions', 'Revenue', 'Avg / Session', 'Share'].map(h => (
                                                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.11em', textTransform: 'uppercase', color: '#C58F3B', backgroundColor: '#F8F4EE', whiteSpace: 'nowrap', fontFamily: "'Inter',system-ui,sans-serif" }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {a.therapistStats.map((t, i) => (
                                            <tr key={t.name} style={{ borderBottom: i < a.therapistStats.length - 1 ? '1px solid rgba(26,26,26,0.06)' : 'none', transition: 'background 120ms' }}
                                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(197,143,59,0.04)')}
                                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                                                <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1A1A1A', fontFamily: "'Inter',system-ui,sans-serif" }}>{t.name}</td>
                                                <td style={{ padding: '10px 12px', color: 'rgba(26,26,26,0.55)', fontFamily: "'Inter',system-ui,sans-serif" }}>{t.count.toLocaleString()}</td>
                                                <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1A1A1A', fontFamily: "'Inter',system-ui,sans-serif" }}>{fmtK(t.revenue)}</td>
                                                <td style={{ padding: '10px 12px', color: 'rgba(26,26,26,0.55)', fontFamily: "'Inter',system-ui,sans-serif" }}>{fmtK(Math.round(t.avgValue))}</td>
                                                <td style={{ padding: '10px 12px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                        <div style={{ flex: 1, height: 5, borderRadius: 99, backgroundColor: 'rgba(197,143,59,0.11)', overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', borderRadius: 99, backgroundColor: '#C58F3B', width: `${a.totalRevenue > 0 ? Math.round((t.revenue / a.totalRevenue) * 100) : 0}%` }} />
                                                        </div>
                                                        <span style={{ fontSize: 11, color: 'rgba(26,26,26,0.45)', minWidth: 28, fontFamily: "'Inter',system-ui,sans-serif" }}>
                                                            {a.totalRevenue > 0 ? Math.round((t.revenue / a.totalRevenue) * 100) : 0}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {a.therapistStats.length === 0 && (
                                            <tr><td colSpan={5} style={{ padding: '28px 12px', textAlign: 'center', color: '#9A8E85', fontStyle: 'italic', fontFamily: "'Inter',system-ui,sans-serif" }}>No data for this period.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>

                        {/* ── Payment methods ─────────────────────────── */}
                        <Card title="Payment Methods">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(175px,100%),1fr))', gap: 9 }}>
                                {a.paymentStats.map(p => (
                                    <div key={p.name} style={{ padding: '13px 14px', backgroundColor: 'rgba(197,143,59,0.06)', border: '1px solid rgba(197,143,59,0.18)', borderRadius: 11 }}>
                                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px', fontFamily: "'Inter',system-ui,sans-serif" }}>{p.name || 'Unknown'}</p>
                                        <p style={{ fontSize: 17, fontWeight: 700, color: '#1A1A1A', margin: '0 0 2px', fontFamily: "'Inter',system-ui,sans-serif" }}>{fmtK(p.revenue)}</p>
                                        <p style={{ fontSize: 11, color: 'rgba(26,26,26,0.42)', margin: 0, fontFamily: "'Inter',system-ui,sans-serif" }}>{p.count.toLocaleString()} transactions</p>
                                    </div>
                                ))}
                                {a.paymentStats.length === 0 && (
                                    <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.38)', fontStyle: 'italic', margin: 0, gridColumn: '1/-1' }}>No payment data.</p>
                                )}
                            </div>
                        </Card>

                        {/* Footer note */}
                        <p style={{ fontSize: 11, color: 'rgba(26,26,26,0.28)', textAlign: 'center', margin: 0, fontStyle: 'italic', fontFamily: "'Inter',system-ui,sans-serif" }}>
                            {allRows.length.toLocaleString()} total records loaded ·
                            {period === 0 ? ` All Time (${a.dataRange})` : ` Last ${period} days`} ·
                            Revenue = <code style={{ fontSize: 10, backgroundColor: 'rgba(26,26,26,0.06)', padding: '1px 4px', borderRadius: 3 }}>received_payment</code>
                        </p>
                    </>
                )}
            </div>
        </>
    )
}