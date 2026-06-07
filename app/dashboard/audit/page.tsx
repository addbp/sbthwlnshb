'use client'

// app/dashboard/audit/page.tsx
// Phase 32: Enterprise Audit Log & Version History Time Machine

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── TYPES ───
interface AuditLog {
    id: string;
    created_at: string;
    receptionist_email: string;
    action: string;
    description: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    old_data: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new_data: any;
    table_name: string;
    record_id: string;
}

// ─── UTILITIES ───
const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const getActionColor = (action: string) => {
    if (action.includes('NEW')) return { bg: 'rgba(61,122,74,0.1)', color: '#3D7A4A' };
    if (action.includes('DELETED')) return { bg: 'rgba(200,50,50,0.1)', color: '#C83232' };
    return { bg: 'rgba(197,143,59,0.1)', color: '#C58F3B' }; // Updates
};

export default function AuditLogsPage() {
    const supabase = createClient()

    const [logs, setLogs] = useState<AuditLog[]>([])
    const [loading, setLoading] = useState(true)
    const [restoring, setRestoring] = useState(false)
    const [currentUserEmail, setCurrentUserEmail] = useState('Admin (Table Editor)')

    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

    const fetchLogs = useCallback(async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user?.email) setCurrentUserEmail(user.email)

            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(300) // Keep the dashboard fast

            if (error) throw error
            setLogs(data || [])
        } catch (err) {
            console.error('Failed to fetch logs', err)
        } finally {
            setLoading(false)
        }
    }, [supabase])

    useEffect(() => { fetchLogs() }, [fetchLogs])

    const handleRestore = async (log: AuditLog) => {
        if (!log.old_data || !log.table_name) return;

        const confirmRestore = window.confirm("Are you sure you want to restore this previous version? This will overwrite the current live data.");
        if (!confirmRestore) return;

        setRestoring(true);
        try {
            // Determine the primary key field (bookings uses booking_id, others use id)
            const idField = log.old_data.booking_id ? 'booking_id' : 'id';
            const idValue = log.old_data[idField];

            if (!idValue) {
                alert("Cannot restore: Missing strict primary key in the snapshot data.");
                return;
            }

            // Prepare data: Inject current user tracking to log the restore action itself
            const payload = { ...log.old_data, receptionist_track: `${currentUserEmail} (System Restore)` };

            // Use UPSERT to handle both UPDATES (reversions) and INSERTS (undoing a deletion)
            const { error } = await supabase
                .from(log.table_name)
                .upsert(payload, { onConflict: idField });

            if (error) throw error;

            alert("Version successfully restored to live database!");
            fetchLogs();
            setSelectedLog(null);
        } catch (err: unknown) {
            if (err instanceof Error) alert("Failed to restore: " + err.message);
        } finally {
            setRestoring(false);
        }
    }

    return (
        <div style={{ backgroundColor: '#F9F4EB', minHeight: '100vh', padding: '40px', fontFamily: "'Inter', system-ui, sans-serif" }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

                <div style={{ borderBottom: '1px solid rgba(197,143,59,0.2)', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', color: '#C58F3B', textTransform: 'uppercase', margin: '0 0 8px 0' }}>System Security</p>
                        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '32px', color: '#1A1A1A', margin: 0 }}>Accountability & Version History</h1>
                    </div>
                    <button onClick={fetchLogs} style={{ padding: '10px 20px', backgroundColor: 'transparent', border: `1px solid #C58F3B`, borderRadius: 8, color: '#C58F3B', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        {loading ? 'Syncing...' : 'Refresh Logs'}
                    </button>
                </div>

                <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid rgba(26,26,26,0.08)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                            <thead>
                                <tr style={{ backgroundColor: '#FDFCF8', borderBottom: '1px solid rgba(26,26,26,0.08)' }}>
                                    <th style={{ padding: '16px 20px', color: '#C58F3B', fontWeight: 700, letterSpacing: '0.05em' }}>TIMESTAMP</th>
                                    <th style={{ padding: '16px 20px', color: '#C58F3B', fontWeight: 700, letterSpacing: '0.05em' }}>RECEPTIONIST ACCOUNT</th>
                                    <th style={{ padding: '16px 20px', color: '#C58F3B', fontWeight: 700, letterSpacing: '0.05em' }}>ACTION</th>
                                    <th style={{ padding: '16px 20px', color: '#C58F3B', fontWeight: 700, letterSpacing: '0.05em' }}>DETAILS</th>
                                    <th style={{ padding: '16px 20px', color: '#C58F3B', fontWeight: 700, letterSpacing: '0.05em', textAlign: 'right' }}>VERSION CONTROL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Retrieving secure logs...</td></tr>
                                ) : logs.length === 0 ? (
                                    <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No activities recorded yet.</td></tr>
                                ) : (
                                    logs.map((log) => {
                                        const colors = getActionColor(log.action);
                                        return (
                                            <tr key={log.id} style={{ borderBottom: '1px solid rgba(26,26,26,0.05)' }}>
                                                <td style={{ padding: '16px 20px', color: '#666', whiteSpace: 'nowrap' }}>{formatDate(log.created_at)}</td>
                                                <td style={{ padding: '16px 20px', color: '#1A1A1A', fontWeight: 600 }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#1A1A1A', color: '#C58F3B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>
                                                            {log.receptionist_email.charAt(0).toUpperCase()}
                                                        </div>
                                                        {log.receptionist_email}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '16px 20px' }}>
                                                    <span style={{ backgroundColor: colors.bg, color: colors.color, padding: '4px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800, letterSpacing: '0.05em' }}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '16px 20px', color: '#666' }}>{log.description}</td>
                                                <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                                    {(log.old_data || log.new_data) && (
                                                        <button onClick={() => setSelectedLog(log)} style={{ padding: '6px 12px', backgroundColor: '#1A1A1A', color: '#F9F4EB', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', cursor: 'pointer' }}>
                                                            VIEW SNAPSHOT
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ─── TIME MACHINE SNAPSHOT MODAL ─── */}
                {selectedLog && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <div style={{ backgroundColor: '#FDFCF8', borderRadius: '16px', width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>

                            <div style={{ padding: '24px', borderBottom: '1px solid rgba(197,143,59,0.2)', backgroundColor: '#1A1A1A', color: '#F9F4EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '16px 16px 0 0' }}>
                                <div>
                                    <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 24, margin: '0 0 4px' }}>Version Snapshot Detail</h2>
                                    <p style={{ fontSize: 12, color: '#C58F3B', margin: 0, fontWeight: 600 }}>Captured: {formatDate(selectedLog.created_at)}</p>
                                </div>
                                <button onClick={() => setSelectedLog(null)} style={{ background: 'none', border: 'none', fontSize: 28, cursor: 'pointer', color: '#C58F3B' }}>&times;</button>
                            </div>

                            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', gap: 20 }}>
                                {selectedLog.old_data && (
                                    <div style={{ flex: 1, backgroundColor: 'rgba(200,50,50,0.03)', border: '1px solid rgba(200,50,50,0.2)', borderRadius: 12, padding: 16 }}>
                                        <p style={{ fontSize: 11, fontWeight: 800, color: '#C83232', letterSpacing: '0.1em', margin: '0 0 12px', textTransform: 'uppercase' }}>Old State (Before Edit)</p>
                                        <pre style={{ fontSize: 11, color: '#1A1A1A', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                                            {JSON.stringify(selectedLog.old_data, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                {selectedLog.new_data && (
                                    <div style={{ flex: 1, backgroundColor: 'rgba(61,122,74,0.03)', border: '1px solid rgba(61,122,74,0.2)', borderRadius: 12, padding: 16 }}>
                                        <p style={{ fontSize: 11, fontWeight: 800, color: '#3D7A4A', letterSpacing: '0.1em', margin: '0 0 12px', textTransform: 'uppercase' }}>New State (After Edit)</p>
                                        <pre style={{ fontSize: 11, color: '#1A1A1A', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                                            {JSON.stringify(selectedLog.new_data, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>

                            {selectedLog.old_data && (
                                <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(26,26,26,0.1)', backgroundColor: '#fff', borderRadius: '0 0 16px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <p style={{ fontSize: 12, color: '#666', margin: 0 }}>Need to undo this change? You can restore the exact data from the 'Old State' panel.</p>
                                    <button onClick={() => handleRestore(selectedLog)} disabled={restoring} style={{ padding: '12px 24px', backgroundColor: '#C83232', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', cursor: restoring ? 'not-allowed' : 'pointer', opacity: restoring ? 0.6 : 1 }}>
                                        {restoring ? 'RESTORING...' : 'RESTORE PREVIOUS VERSION'}
                                    </button>
                                </div>
                            )}

                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}