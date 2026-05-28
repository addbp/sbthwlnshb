'use client'
export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── SAFE CURRENCY PARSER ───
function parseCurrency(val: any): number {
    if (!val) return 0;
    return Number(String(val).replace(/[^0-9.-]+/g, '')) || 0;
}

// ─── INDESTRUCTIBLE DATE PARSER ───
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parseImportDate(raw: string | null | undefined): Date | null {
    if (!raw) return null;
    let clean = String(raw).trim();
    const dashMatch = clean.match(/^(\d{1,2})[-\s/]+([A-Za-z]{3,})[-\s/]+(\d{2,4})$/);
    if (dashMatch) {
        let year = dashMatch[3];
        if (year.length === 2) year = '20' + year;
        clean = `${dashMatch[2]} ${dashMatch[1]}, ${year}`;
    }
    let d = new Date(clean);
    if (!isNaN(d.getTime())) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
    }
    return null;
}

// ─── TYPES ───
interface ReportRecord {
    date: Date;
    service: string;
    therapist: string;
    client: string;
    revenue: number;
}

interface RankedItem {
    name: string;
    count: number;
    revenue: number;
}

export default function ReportsPage() {
    const supabase = useRef(createClient()).current

    // Raw Data State
    const [allRecords, setAllRecords] = useState<ReportRecord[]>([])
    const [loading, setLoading] = useState(true)

    // Filter State
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    // Fetch all historical data ONCE
    const loadAll = useCallback(async () => {
        setLoading(true)
        let from = 0; const PAGE = 1000; const raw: ReportRecord[] = [];

        for (; ;) {
            const { data, error } = await supabase
                .from('bookings_import')
                .select('date, received_payment, service_amount, service, therapist, client_name')
                .range(from, from + PAGE - 1)

            if (error || !data || data.length === 0) break

            data.forEach((r: any) => {
                const d = parseImportDate(r.date)
                if (!d) return;
                const rev = parseCurrency(r.received_payment || r.service_amount)

                raw.push({
                    date: d,
                    revenue: rev,
                    service: String(r.service || '—').trim(),
                    therapist: String(r.therapist || '—').trim(),
                    client: String(r.client_name || 'Guest').trim()
                })
            })
            if (data.length < PAGE) break; from += PAGE;
        }

        setAllRecords(raw)
        setLoading(false)
    }, [supabase])

    useEffect(() => { loadAll() }, [loadAll])

    // ─── APPLY FILTERS ───
    const filteredRecords = allRecords.filter(r => {
        if (startDate && r.date < new Date(startDate)) return false;
        // Add 23:59:59 to end date to make it inclusive
        if (endDate && r.date > new Date(`${endDate}T23:59:59`)) return false;
        return true;
    })

    // ─── AGGREGATIONS ───
    const totalRev = filteredRecords.reduce((sum, r) => sum + r.revenue, 0)
    const totalBookings = filteredRecords.length

    // 1. Monthly Breakdown
    const monthlyMap: Record<string, number> = {}
    filteredRecords.forEach(r => {
        if (r.revenue === 0) return;
        const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}`
        if (!monthlyMap[key]) monthlyMap[key] = 0;
        monthlyMap[key] += r.revenue;
    })
    const monthlyStats = Object.entries(monthlyMap)
        .sort((a, b) => b[0].localeCompare(a[0])) // Descending
        .map(([key, revenue]) => {
            const [y, mo] = key.split('-')
            return { label: `${MONTH_ABBR[parseInt(mo, 10) - 1]} ${y}`, revenue }
        })

    // 2. Generic Leaderboard Generator
    const getLeaderboard = (key: 'service' | 'therapist' | 'client'): RankedItem[] => {
        const map = new Map<string, RankedItem>()
        filteredRecords.forEach(r => {
            const name = r[key];
            if (!name || name === '—' || name === 'Guest') return;
            const existing = map.get(name) || { name, count: 0, revenue: 0 }
            existing.count += 1;
            existing.revenue += r.revenue;
            map.set(name, existing);
        })
        return Array.from(map.values())
            .sort((a, b) => b.revenue - a.revenue) // Rank by Revenue
            .slice(0, 10) // Top 10
    }

    const topServices = getLeaderboard('service')
    const topTherapists = getLeaderboard('therapist')
    const topClients = getLeaderboard('client')

    // ─── UI COMPONENTS ───
    const LeaderboardTable = ({ title, data, type }: { title: string, data: RankedItem[], type: string }) => (
        <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 3px 12px rgba(0,0,0,0.03)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(197,143,59,0.2)', backgroundColor: '#FDFCF8' }}>
                <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 22, color: '#1A1A1A', margin: 0 }}>{title}</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                    <thead>
                        <tr style={{ backgroundColor: '#F8F4EE', color: '#C58F3B', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.1em' }}>
                            <th style={{ padding: '12px 20px' }}>{type}</th>
                            <th style={{ padding: '12px 20px' }}>Availments</th>
                            <th style={{ padding: '12px 20px' }}>Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((item, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                                <td style={{ padding: '12px 20px', fontWeight: 600, color: '#1A1A1A' }}>{item.name}</td>
                                <td style={{ padding: '12px 20px', color: '#666' }}>{item.count}</td>
                                <td style={{ padding: '12px 20px', fontWeight: 700, color: '#3D7A4A' }}>₱{item.revenue.toLocaleString()}</td>
                            </tr>
                        ))}
                        {data.length === 0 && <tr><td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No data available.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    )

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26, fontFamily: "'Inter',system-ui,sans-serif" }}>

            {/* ─── HEADER & FILTERS ─── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Analytics & Insights</p>
                    <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 36, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Master Reports</h2>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.16)', borderRadius: 10, padding: '4px 8px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>From</span>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: 13, color: '#1A1A1A', backgroundColor: 'transparent', cursor: 'pointer' }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase', borderLeft: '1px solid #ddd', paddingLeft: 8 }}>To</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: 13, color: '#1A1A1A', backgroundColor: 'transparent', cursor: 'pointer' }} />
                        {(startDate || endDate) && (
                            <button onClick={() => { setStartDate(''); setEndDate('') }} style={{ background: 'none', border: 'none', color: '#8B3A3A', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>&times;</button>
                        )}
                    </div>
                    <button onClick={loadAll} style={{ padding: '0 18px', height: 42, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 10, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>
                        {loading ? 'Syncing...' : 'Refresh Data'}
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: '#fff', borderRadius: 16, border: '1px solid rgba(26,26,26,0.09)' }}>
                    Generating comprehensive analytics...
                </div>
            ) : (
                <>
                    {/* ─── KPIs ─── */}
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(197,143,59,0.20)', borderRadius: 14, padding: '24px', minWidth: 260, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(243,233,224,0.50)', margin: '0 0 8px', letterSpacing: '0.05em' }}>Revenue (Filtered)</p>
                            <p style={{ fontSize: 36, fontWeight: 700, color: '#F3E9E0', margin: 0 }}>₱{totalRev.toLocaleString()}</p>
                        </div>
                        <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '24px', minWidth: 220, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 8px', letterSpacing: '0.05em' }}>Total Bookings</p>
                            <p style={{ fontSize: 36, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{totalBookings.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* ─── LEADERBOARDS (GRID OF 3) ─── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
                        <LeaderboardTable title="Top Services" type="Service" data={topServices} />
                        <LeaderboardTable title="Top Therapists" type="Therapist" data={topTherapists} />
                        <LeaderboardTable title="Top Clients" type="Client" data={topClients} />
                    </div>

                    {/* ─── MONTHLY BREAKDOWN ─── */}
                    {monthlyStats.length > 0 && (
                        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, padding: '24px', boxShadow: '0 3px 12px rgba(0,0,0,0.03)' }}>
                            <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 24, margin: '0 0 20px', color: '#1A1A1A' }}>Monthly Breakdown</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 16 }}>
                                {monthlyStats.map(m => (
                                    <div key={m.label} style={{ padding: '20px', backgroundColor: '#FDFCF8', border: '1px solid rgba(197,143,59,0.2)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <p style={{ fontSize: 11, fontWeight: 700, color: '#C58F3B', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{m.label}</p>
                                        <p style={{ fontSize: 22, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>₱{m.revenue.toLocaleString()}</p>
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