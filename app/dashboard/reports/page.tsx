'use client'

// app/dashboard/reports/page.tsx
// Phase 4 Reports 
// Fixed: Session Cookie bug via createBrowserClient
// Fixed: select('*') for unbreakable database mapping

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { type SupabaseClient } from '@supabase/supabase-js'

type Booking = {
    id: string
    amount: number
    service_name: string
    therapist_name: string
    payment_method: string
    appointment_date: string
}

export default function ReportsPage() {
    const [data, setData] = useState<Booking[]>([])
    const [loading, setLoading] = useState(true)

    const supabaseRef = useRef<SupabaseClient | null>(null)

    if (!supabaseRef.current) {
        // CRITICAL FIX: Use createBrowserClient so it reads the Next.js Cookie properly
        supabaseRef.current = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
    }

    const supabase = supabaseRef.current

    const fetchReportData = useCallback(async () => {
        setLoading(true)
        // CRITICAL FIX: Use select('*') to prevent column mismatch crashes
        const { data: bookings, error } = await supabase
            .from("bookings")
            .select("*")
            .eq("status", "completed")

        if (!error && bookings) {
            const formatted = bookings.map(b => ({
                id: String(b.id),
                amount: Number(b.amount || 0),
                service_name: String(b.service_name || b.service || "Standard Session"),
                therapist_name: String(b.therapist_name || b.therapist || "Unassigned"),
                payment_method: String(b.payment_method || "cash"),
                appointment_date: String(b.appointment_date || b.created_at?.split('T')[0] || ""),
            }))
            setData(formatted)
        }
        setLoading(false)
    }, [supabase])

    useEffect(() => {
        fetchReportData()
    }, [fetchReportData])

    // --- CALCULATIONS ---
    const totalRevenue = data.reduce((sum, b) => sum + Number(b.amount || 0), 0)
    const totalSessions = data.length
    const avgBookingValue = totalSessions > 0 ? totalRevenue / totalSessions : 0

    // Calculate Top Services
    const serviceCounts: Record<string, number> = {}
    data.forEach((b) => {
        const s = b.service_name || "Standard Session"
        serviceCounts[s] = (serviceCounts[s] || 0) + 1
    })
    const topServices = Object.entries(serviceCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5) // Top 5

    // Calculate Revenue by Therapist
    const therapistRev: Record<string, number> = {}
    data.forEach((b) => {
        const t = b.therapist_name || "Unassigned"
        therapistRev[t] = (therapistRev[t] || 0) + Number(b.amount || 0)
    })
    const topTherapists = Object.entries(therapistRev)
        .sort((a, b) => b[1] - a[1])

    // Calculate Payment Methods
    const payMethods: Record<string, number> = {}
    data.forEach((b) => {
        const p = b.payment_method || "cash"
        payMethods[p] = (payMethods[p] || 0) + Number(b.amount || 0)
    })

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#F9F4EB', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ display: 'inline-block', width: 32, height: 32, border: '2px solid rgba(197,143,59,0.3)', borderTopColor: '#C58F3B', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, fontFamily: "'Inter',system-ui,sans-serif" }}>

            {/* Header */}
            <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>
                    Analytics
                </p>
                <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 300, color: '#1A1A1A', margin: 0 }}>
                    Performance Reports
                </h2>
                <p style={{ color: 'rgba(26,26,26,0.40)', fontSize: 13, margin: '4px 0 0' }}>
                    Real-time data based on completed sessions.
                </p>
            </div>

            {/* --- KPI STATS --- */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px,100%),1fr))', gap: 16 }}>
                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, padding: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 20, right: 20, height: 2, backgroundColor: '#C58F3B', opacity: 0.4, borderRadius: '0 0 2px 2px' }} />
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 10px' }}>Total Revenue (All Time)</p>
                    <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: '3rem', fontWeight: 300, lineHeight: 1, color: '#1A1A1A', margin: 0, letterSpacing: '-0.02em' }}>
                        ₱{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                </div>

                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, padding: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 20, right: 20, height: 2, backgroundColor: '#1A1A1A', opacity: 0.2, borderRadius: '0 0 2px 2px' }} />
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 10px' }}>Completed Sessions</p>
                    <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: '3rem', fontWeight: 300, lineHeight: 1, color: '#1A1A1A', margin: 0, letterSpacing: '-0.02em' }}>
                        {totalSessions}
                    </p>
                </div>

                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, padding: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 20, right: 20, height: 2, backgroundColor: '#1A1A1A', opacity: 0.2, borderRadius: '0 0 2px 2px' }} />
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 10px' }}>Avg. Booking Value</p>
                    <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: '3rem', fontWeight: 300, lineHeight: 1, color: '#1A1A1A', margin: 0, letterSpacing: '-0.02em' }}>
                        ₱{avgBookingValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                </div>
            </div>

            {/* --- DATA BREAKDOWNS --- */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(400px,100%),1fr))', gap: 24 }}>

                {/* Top Services */}
                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, padding: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                    <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 22, color: '#1A1A1A', margin: '0 0 20px', paddingBottom: 10, borderBottom: '1px solid rgba(26,26,26,0.09)' }}>
                        Top Services by Volume
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {topServices.length > 0 ? topServices.map(([service, count], index) => (
                            <div key={service} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ color: '#C58F3B', fontWeight: 700, fontSize: 14 }}>0{index + 1}</span>
                                    <span style={{ fontWeight: 600, color: '#1A1A1A', fontSize: 15 }}>{service}</span>
                                </div>
                                <span style={{ fontSize: 12, color: '#7A6E65', backgroundColor: '#F9F4EB', padding: '4px 12px', borderRadius: 99, fontWeight: 600 }}>
                                    {count} sessions
                                </span>
                            </div>
                        )) : (
                            <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.4)' }}>No service data available yet.</p>
                        )}
                    </div>
                </div>

                {/* Revenue by Therapist */}
                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, padding: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                    <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 22, color: '#1A1A1A', margin: '0 0 20px', paddingBottom: 10, borderBottom: '1px solid rgba(26,26,26,0.09)' }}>
                        Revenue by Therapist
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {topTherapists.length > 0 ? topTherapists.map(([therapist, rev]) => (
                            <div key={therapist} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
                                    <span>{therapist}</span>
                                    <span>₱{rev.toLocaleString()}</span>
                                </div>
                                <div style={{ width: '100%', height: 8, backgroundColor: '#F9F4EB', borderRadius: 99, overflow: 'hidden' }}>
                                    <div
                                        style={{ height: '100%', backgroundColor: '#C58F3B', borderRadius: 99, width: `${(rev / totalRevenue) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )) : (
                            <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.4)' }}>No therapist data available yet.</p>
                        )}
                    </div>
                </div>

                {/* Payment Methods */}
                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, padding: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', gridColumn: '1 / -1' }}>
                    <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 22, color: '#1A1A1A', margin: '0 0 20px', paddingBottom: 10, borderBottom: '1px solid rgba(26,26,26,0.09)' }}>
                        Revenue by Payment Method
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                        {Object.entries(payMethods).map(([method, amount]) => (
                            <div key={method} style={{ padding: '16px', backgroundColor: '#F9F4EB', borderRadius: 12, border: '1px solid rgba(26,26,26,0.05)' }}>
                                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.5)', margin: '0 0 8px' }}>
                                    {method}
                                </p>
                                <p style={{ fontSize: 22, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
                                    ₱{amount.toLocaleString()}
                                </p>
                            </div>
                        ))}
                        {Object.keys(payMethods).length === 0 && (
                            <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.4)', margin: 0 }}>No payment data available yet.</p>
                        )}
                    </div>
                </div>

            </div>
        </div>
    )
}