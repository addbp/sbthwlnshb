'use client'

// app/dashboard/audit/page.tsx
// Receptionist Record & System Audit Logs

export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────
const BG = '#F9F4EB'
const BLACK = '#1A1A1A'
const GOLD = '#C58F3B'
const WHITE = '#FFFFFF'
const BODY = "'Inter', system-ui, sans-serif"
const DSP = "'Cormorant Garamond', Georgia, serif"

interface AuditLog {
    id: string;
    created_at: string;
    receptionist_email: string;
    action: string;
    description: string;
}

export default function ReceptionistRecordPage() {
    const [logs, setLogs] = useState<AuditLog[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    const fetchLogs = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500)

        if (!error && data) {
            setLogs(data)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchLogs()
    }, [])

    const formatDateTime = (dateStr: string) => {
        const d = new Date(dateStr)
        return d.toLocaleString('en-PH', {
            month: 'short', day: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        })
    }

    const getActionColor = (action: string) => {
        if (action.includes('NEW')) return { bg: 'rgba(61,122,74,0.1)', color: '#3D7A4A' }
        if (action.includes('UPDATE')) return { bg: 'rgba(197,143,59,0.1)', color: '#C58F3B' }
        return { bg: 'rgba(26,26,26,0.05)', color: '#666' }
    }

    return (
        <div style={{ backgroundColor: BG, minHeight: '100vh', padding: '40px', fontFamily: BODY }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

                {/* HEADER SECTION */}
                <div style={{ borderBottom: '1px solid rgba(197,143,59,0.2)', paddingBottom: '20px', marginBottom: '30px' }}>
                    <h1 style={{ fontFamily: DSP, fontSize: '32px', color: BLACK, margin: 0 }}>Accountability</h1>
                </div>

                {/* CONTROLS SECTION */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
                    <div>
                        <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', color: GOLD, textTransform: 'uppercase', margin: '0 0 8px 0' }}>SYSTEM SECURITY</p>
                        <h2 style={{ fontFamily: DSP, fontSize: '28px', color: BLACK, margin: 0 }}>Receptionist Audit Record</h2>
                    </div>

                    <button
                        onClick={fetchLogs}
                        disabled={loading}
                        style={{ padding: '12px 24px', backgroundColor: 'transparent', border: `1px solid ${GOLD}`, borderRadius: '8px', color: GOLD, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease' }}
                    >
                        {loading ? 'Scanning Logs...' : 'Refresh Logs'}
                    </button>
                </div>

                {/* METRICS CARD */}
                <div style={{ backgroundColor: WHITE, padding: '24px 30px', borderRadius: '16px', border: '1px solid rgba(26,26,26,0.08)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', marginBottom: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: '#666', margin: '0 0 12px 0', textTransform: 'uppercase' }}>Recent Tracked Edits & Operations</p>
                    <h3 style={{ fontSize: '38px', fontWeight: 700, color: BLACK, margin: 0, fontFamily: BODY }}>
                        {loading ? '...' : logs.length.toLocaleString()}
                    </h3>
                </div>

                {/* LOGS TABLE */}
                <div style={{ backgroundColor: WHITE, borderRadius: '12px', border: '1px solid rgba(26,26,26,0.08)', overflowX: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'rgba(249,244,235,0.5)', borderBottom: '1px solid rgba(26,26,26,0.08)' }}>
                                <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>TIMESTAMP</th>
                                <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em' }}>RECEPTIONIST ACCOUNT</th>
                                <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em' }}>ACTION TAKEN</th>
                                <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em' }}>DETAILS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Fetching secure audit logs...</td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No modifications detected yet. Make a change in the POS to see it here!</td></tr>
                            ) : (
                                logs.map((log) => {
                                    const colors = getActionColor(log.action);
                                    return (
                                        <tr key={log.id} style={{ borderBottom: '1px solid rgba(26,26,26,0.05)' }}>
                                            <td style={{ padding: '16px 20px', color: '#666', whiteSpace: 'nowrap', fontWeight: 600 }}>
                                                {formatDateTime(log.created_at)}
                                            </td>

                                            <td style={{ padding: '16px 20px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: BLACK, color: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                                                        {log.receptionist_email[0].toUpperCase()}
                                                    </div>
                                                    <span style={{ fontWeight: 700, color: BLACK }}>{log.receptionist_email}</span>
                                                </div>
                                            </td>

                                            <td style={{ padding: '16px 20px' }}>
                                                <span style={{ backgroundColor: colors.bg, color: colors.color, padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em' }}>
                                                    {log.action}
                                                </span>
                                            </td>

                                            <td style={{ padding: '16px 20px', color: '#666', lineHeight: 1.5 }}>
                                                {log.description}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    )
}