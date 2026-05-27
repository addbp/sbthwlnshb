'use client'
export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────
// UNIVERSAL DATE PARSER
// ─────────────────────────────────────────────────────────────
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parseImportDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr) return null;
    const cleanStr = String(dateStr).trim().replace(/,/g, '');
    if (!cleanStr) return null;
    let d = new Date(cleanStr);
    if (!isNaN(d.getTime())) return d;
    const dashMatch = cleanStr.match(/^(\d{1,2})[-\s/]+([A-Za-z]{3,})[-\s/]+(\d{2,4})$/);
    if (dashMatch) {
        let year = dashMatch[3];
        if (year.length === 2) year = '20' + year;
        d = new Date(`${dashMatch[2]} ${dashMatch[1]}, ${year}`);
        if (!isNaN(d.getTime())) return d;
    }
    return null;
}

function isoOf(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─────────────────────────────────────────────────────────────
// DATA FETCH
// ─────────────────────────────────────────────────────────────
interface RawRow {
    date: string; client_name: string; service: string; therapist: string;
    received_payment: number; net_sales: number; category: string;
    customer_type: string; payment_method: string;
}

async function fetchAllPaginated(supabase: ReturnType<typeof createClient>): Promise<RawRow[]> {
    const COLS = 'date,client_name,service,therapist,received_payment,net_sales,category,customer_type,payment_method'
    const PAGE = 1000
    const all: RawRow[] = []
    let from = 0

    for (; ;) {
        const { data, error } = await supabase.from('bookings_import').select(COLS).range(from, from + PAGE - 1)
        if (error || !data || data.length === 0) break
        all.push(...data as RawRow[])
        if (data.length < PAGE) break
        from += PAGE
    }
    return all
}

// ─────────────────────────────────────────────────────────────
// ENGINE
// ─────────────────────────────────────────────────────────────
interface Stat { name: string; revenue: number; count: number }

function compute(rows: RawRow[], periodDays: number) {
    let inPeriod = rows
    if (periodDays > 0) {
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - periodDays)
        const cutoffISO = isoOf(cutoff)
        inPeriod = rows.filter(r => {
            const d = parseImportDate(r.date)
            return d ? isoOf(d) >= cutoffISO : false
        })
    }

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

    return {
        totalRevenue, totalNetSales, sessionCount, avgValue,
        newClients: newCount, returningClients: sessionCount - newCount,
        uniqueClients: uniqueNames.size,
        topService: groupStat(inPeriod, 'service')[0]?.name ?? '—',
        monthlyStats
    }
}

const fmt = (n: number) => '₱' + n.toLocaleString('en-PH')
const fmtK = (n: number) => n >= 1_000_000 ? `₱${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `₱${(n / 1000).toFixed(1)}k` : fmt(n)

export default function ReportsPage() {
    const supabase = useRef(createClient()).current
    const [allRows, setAllRows] = useState<RawRow[]>([])
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState(0)

    const loadAll = useCallback(async () => {
        setLoading(true)
        const rows = await fetchAllPaginated(supabase)
        setAllRows(rows)
        setLoading(false)
    }, [supabase])

    useEffect(() => { loadAll() }, [loadAll])

    const a = compute(allRows, period)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26, fontFamily: "'Inter',system-ui,sans-serif" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Analytics</p>
                    <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Reports</h2>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[{ l: 'All Time', v: 0 }, { l: '90 Days', v: 90 }].map(opt => (
                        <button key={opt.v} onClick={() => setPeriod(opt.v)} style={{ padding: '0 14px', height: 34, borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', backgroundColor: period === opt.v ? '#1A1A1A' : 'transparent', color: period === opt.v ? '#C58F3B' : '#1A1A1A' }}>{opt.l}</button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: 'rgba(197,143,59,0.07)', borderRadius: 12 }}>Analyzing records...</div>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(175px,100%),1fr))', gap: 12 }}>
                        {[
                            { l: 'Total Revenue', v: fmtK(a.totalRevenue), dk: true },
                            { l: 'Net Sales', v: fmtK(a.totalNetSales), dk: false },
                            { l: 'Sessions', v: a.sessionCount.toLocaleString(), dk: false },
                            { l: 'Unique Clients', v: a.uniqueClients.toLocaleString(), dk: false },
                        ].map(t => (
                            <div key={t.l} style={{ backgroundColor: t.dk ? '#1A1A1A' : '#FFFFFF', border: `1px solid ${t.dk ? 'rgba(197,143,59,0.20)' : 'rgba(26,26,26,0.09)'}`, borderRadius: 14, padding: '17px 18px' }}>
                                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: t.dk ? 'rgba(243,233,224,0.50)' : '#7A6E65', margin: '0 0 8px' }}>{t.l}</p>
                                <p style={{ fontSize: 'clamp(1.3rem,2.2vw,1.8rem)', fontWeight: 700, color: t.dk ? '#F3E9E0' : '#1A1A1A', margin: 0 }}>{t.v}</p>
                            </div>
                        ))}
                    </div>

                    {a.monthlyStats.length > 0 && (
                        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 15, padding: '20px' }}>
                            <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 19, margin: '0 0 16px' }}>Monthly Breakdown</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
                                {a.monthlyStats.map(m => (
                                    <div key={m.label} style={{ padding: '12px', backgroundColor: '#F8F4EE', borderRadius: 8 }}>
                                        <p style={{ fontSize: 11, fontWeight: 700, color: '#7A6E65', margin: '0 0 4px' }}>{m.label}</p>
                                        <p style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{fmt(m.revenue)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}