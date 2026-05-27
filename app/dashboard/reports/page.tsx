'use client'
export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── INDESTRUCTIBLE DATE PARSER ───
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parseImportDate(raw: string | null | undefined): Date | null {
    if (!raw) return null;
    const clean = String(raw).trim().replace(/,/g, '').replace(/\s+/g, ' ');
    if (!clean) return null;

    const MONTHS: Record<string, number> = {
        jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
        may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, september: 8,
        oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
    };

    let year = 0, month = 0, day = 1, matched = false;

    const match1 = clean.match(/^(\d{1,2})[-\s/]+([A-Za-z]{3,})[-\s/]+(\d{2,4})$/);
    if (match1) {
        day = parseInt(match1[1], 10); month = MONTHS[match1[2].toLowerCase()] ?? 0; year = parseInt(match1[3], 10); matched = true;
    }
    if (!matched) {
        const match2 = clean.match(/^([A-Za-z]{3,})[-\s/]+(\d{1,2})[-\s/]+(\d{2,4})$/);
        if (match2) {
            month = MONTHS[match2[1].toLowerCase()] ?? 0; day = parseInt(match2[2], 10); year = parseInt(match2[3], 10); matched = true;
        }
    }
    if (!matched) {
        const match3 = clean.match(/^(\d{4})[-\s/]+(\d{1,2})[-\s/]+(\d{1,2})$/);
        if (match3) {
            year = parseInt(match3[1], 10); month = parseInt(match3[2], 10) - 1; day = parseInt(match3[3], 10); matched = true;
        }
    }

    if (matched) {
        if (year < 100) year += 2000;
        return new Date(year, month, day, 12, 0, 0);
    }

    const d = new Date(clean);
    if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
    return null;
}

async function fetchHistory(supabase: ReturnType<typeof createClient>) {
    let from = 0; const PAGE = 1000; const all: any[] = [];
    for (; ;) {
        const { data } = await supabase.from('bookings_import').select('date,received_payment').range(from, from + PAGE - 1)
        if (!data || data.length === 0) break
        all.push(...data)
        if (data.length < PAGE) break; from += PAGE;
    }
    return all
}

export default function ReportsPage() {
    const supabase = useRef(createClient()).current
    const [monthlyStats, setMonthlyStats] = useState<{ label: string, revenue: number }[]>([])
    const [totalRev, setTotalRev] = useState(0)
    const [loading, setLoading] = useState(true)

    const loadAll = useCallback(async () => {
        setLoading(true)
        const rows = await fetchHistory(supabase)

        let total = 0;
        const monthlyMap: Record<string, number> = {}

        rows.forEach((r: any) => {
            const d = parseImportDate(r.date)
            if (!d) return;
            const rev = Number(r.received_payment || 0)
            total += rev;

            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            if (!monthlyMap[key]) monthlyMap[key] = 0;
            monthlyMap[key] += rev;
        })

        const formattedStats = Object.entries(monthlyMap)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, revenue]) => {
                const [y, mo] = key.split('-')
                return { label: `${MONTH_ABBR[parseInt(mo, 10) - 1]} ${y}`, revenue }
            })

        setTotalRev(total)
        setMonthlyStats(formattedStats)
        setLoading(false)
    }, [supabase])

    useEffect(() => { loadAll() }, [loadAll])

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26, fontFamily: "'Inter',system-ui,sans-serif" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Analytics</p>
                    <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 32, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Reports</h2>
                </div>
                <button onClick={loadAll} style={{ padding: '0 16px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>Refresh</button>
            </div>

            {loading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: 'rgba(197,143,59,0.07)', borderRadius: 12 }}>Generating monthly analytics...</div>
            ) : (
                <>
                    <div style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(197,143,59,0.20)', borderRadius: 14, padding: '18px', maxWidth: 300 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(243,233,224,0.50)', margin: '0 0 8px' }}>Total Revenue (All Time)</p>
                        <p style={{ fontSize: 28, fontWeight: 700, color: '#F3E9E0', margin: 0 }}>₱{totalRev.toLocaleString()}</p>
                    </div>

                    {monthlyStats.length > 0 && (
                        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 15, padding: '20px' }}>
                            <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 22, margin: '0 0 16px' }}>Monthly Breakdown</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
                                {monthlyStats.map(m => (
                                    <div key={m.label} style={{ padding: '16px', backgroundColor: '#F8F4EE', border: '1px solid rgba(197,143,59,0.2)', borderRadius: 8 }}>
                                        <p style={{ fontSize: 12, fontWeight: 700, color: '#C58F3B', margin: '0 0 4px', textTransform: 'uppercase' }}>{m.label}</p>
                                        <p style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>₱{m.revenue.toLocaleString()}</p>
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