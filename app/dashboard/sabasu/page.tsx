'use client'
export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SabasuOrder {
    id: string;
    client_name: string;
    location: string;
    items: string;
    total_amount: number;
    status: string;
    created_at: string;
}

export default function SabasuDashboard() {
    const supabase = useRef(createClient()).current
    const [orders, setOrders] = useState<SabasuOrder[]>([])
    const [loading, setLoading] = useState(true)

    const loadOrders = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('sabasu_orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100) // Keep kitchen view focused on recent orders

        if (!error && data) setOrders(data)
        setLoading(false)
    }, [supabase])

    useEffect(() => {
        loadOrders()
        // Optional: Auto-refresh every 30 seconds so kitchen doesn't miss orders
        const interval = setInterval(loadOrders, 30000)
        return () => clearInterval(interval)
    }, [loadOrders])

    const updateStatus = async (id: string, newStatus: string) => {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o))
        await supabase.from('sabasu_orders').update({ status: newStatus }).eq('id', id)
    }

    const getStatusColor = (status: string) => {
        if (status === 'Pending') return { bg: '#f5f5f5', text: '#666', border: '#ccc' }
        if (status === 'Preparing') return { bg: 'rgba(197,143,59,0.1)', text: '#C58F3B', border: 'rgba(197,143,59,0.3)' }
        if (status === 'Served') return { bg: 'rgba(61,122,74,0.1)', text: '#3D7A4A', border: 'rgba(61,122,74,0.3)' }
        return { bg: '#fff', text: '#000', border: '#eee' }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Inter',system-ui,sans-serif" }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Kitchen & Cafe</p>
                    <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 32, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>SABASU Orders</h2>
                </div>
                <button onClick={loadOrders} style={{ padding: '0 16px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>
                    {loading ? 'Refreshing...' : 'Refresh Orders'}
                </button>
            </div>

            <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ overflowX: 'auto', minHeight: 400 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)', backgroundColor: '#F8F4EE' }}>
                                {['Time', 'Status', 'Client', 'Location', 'Items Ordered', 'Amount'].map(h => (
                                    <th key={h} style={{ padding: '14px 20px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C58F3B', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((o) => {
                                const colors = getStatusColor(o.status)
                                return (
                                    <tr key={o.id} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                                        <td style={{ padding: '16px 20px', color: '#666', whiteSpace: 'nowrap' }}>
                                            {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <select
                                                value={o.status}
                                                onChange={(e) => updateStatus(o.id, e.target.value)}
                                                style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, cursor: 'pointer', outline: 'none' }}
                                            >
                                                <option value="Pending">Pending</option>
                                                <option value="Preparing">Preparing</option>
                                                <option value="Served">Served</option>
                                                <option value="Cancelled">Cancelled</option>
                                            </select>
                                        </td>
                                        <td style={{ padding: '16px 20px', fontWeight: 700, color: '#1A1A1A' }}>{o.client_name}</td>
                                        <td style={{ padding: '16px 20px', color: '#C58F3B', fontWeight: 600 }}>{o.location}</td>
                                        <td style={{ padding: '16px 20px', color: '#2A2A2A', maxWidth: 300 }}>{o.items}</td>
                                        <td style={{ padding: '16px 20px', fontWeight: 700, color: '#1A1A1A' }}>₱{o.total_amount.toLocaleString()}</td>
                                    </tr>
                                )
                            })}
                            {orders.length === 0 && <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No active SABASU orders.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}