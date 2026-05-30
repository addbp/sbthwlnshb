'use client'
export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── INDESTRUCTIBLE DATE PARSER ───
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

// ─── STRICT DATE FORMATTER ───
function formatDateToDDMMMYY(d: Date | null): string {
    if (!d || isNaN(d.getTime())) return '—';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dd = String(d.getDate()).padStart(2, '0');
    const mmm = months[d.getMonth()];
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}-${mmm}-${yy}`;
}

interface WaiverRecord {
    id: string;
    client_name: string;
    focus_areas: string;
    health_conditions: string;
    signature: string;
    date_signed: string;
    parsedDate: Date | null;
}

interface ClientHistoryRecord {
    date: string;
    parsedDate: Date | null;
    service: string;
    therapist: string;
}

export default function WaiversDashboardPage() {
    const supabase = useRef(createClient()).current
    const [waivers, setWaivers] = useState<WaiverRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 100

    // Modal States
    const [selectedWaiver, setSelectedWaiver] = useState<WaiverRecord | null>(null)
    const [clientHistory, setClientHistory] = useState<ClientHistoryRecord[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)

    // ─── 1. FETCH ALL WAIVERS (UNLIMITED) ───
    const loadWaivers = useCallback(async () => {
        setLoading(true)
        try {
            let from = 0;
            const PAGE = 1000;
            const allWaivers: WaiverRecord[] = [];

            for (; ;) {
                const { data, error } = await supabase
                    .from('waivers')
                    .select('*')
                    .order('date_signed', { ascending: false })
                    .range(from, from + PAGE - 1);

                if (error || !data || data.length === 0) break;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data.forEach((w: any) => {
                    allWaivers.push({
                        id: w.id,
                        client_name: String(w.client_name || 'Unknown Client'),
                        focus_areas: String(w.focus_areas || 'None'),
                        health_conditions: String(w.health_conditions || 'None'),
                        signature: w.signature || '',
                        date_signed: w.date_signed,
                        parsedDate: parseImportDate(w.date_signed)
                    });
                });

                if (data.length < PAGE) break;
                from += PAGE;
            }

            setWaivers(allWaivers)
        } catch (err) {
            console.error("Failed to load waivers:", err)
        } finally {
            setLoading(false)
        }
    }, [supabase])

    useEffect(() => { loadWaivers() }, [loadWaivers])
    useEffect(() => { setCurrentPage(1) }, [search])

    // ─── 2. FETCH SPECIFIC CLIENT HISTORY (TRIGGERED ON CLICK) ───
    const openClientProfile = async (waiver: WaiverRecord) => {
        setSelectedWaiver(waiver)
        setHistoryLoading(true)
        setClientHistory([])

        try {
            const clientNameLower = waiver.client_name.trim().toLowerCase()

            // Fetch matching bookings from both live and import tables
            const [liveRes, importRes] = await Promise.all([
                supabase.from('bookings').select('appointment_date, created_at, service_name, service, therapist_name, therapist').ilike('client_name', `%${clientNameLower}%`),
                supabase.from('bookings_import').select('date, service, therapist').ilike('client_name', `%${clientNameLower}%`)
            ])

            const combinedHistory: ClientHistoryRecord[] = []

            if (liveRes.data) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                liveRes.data.forEach((r: any) => {
                    combinedHistory.push({
                        date: r.appointment_date || r.created_at || '',
                        parsedDate: parseImportDate(r.appointment_date || r.created_at),
                        service: r.service_name || r.service || 'Massage Service',
                        therapist: r.therapist_name || r.therapist || 'Assigned Therapist'
                    })
                })
            }

            if (importRes.data) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                importRes.data.forEach((r: any) => {
                    combinedHistory.push({
                        date: r.date || '',
                        parsedDate: parseImportDate(r.date),
                        service: r.service || 'Massage Service',
                        therapist: r.therapist || 'Assigned Therapist'
                    })
                })
            }

            // Sort newest to oldest
            combinedHistory.sort((a, b) => (b.parsedDate?.getTime() || 0) - (a.parsedDate?.getTime() || 0))

            setClientHistory(combinedHistory)
        } catch (err) {
            console.error("Failed to load history:", err)
        } finally {
            setHistoryLoading(false)
        }
    }

    // Filters & Pagination
    const filtered = waivers.filter(w => w.client_name.toLowerCase().includes(search.toLowerCase()))
    const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage))
    const startIndex = (currentPage - 1) * itemsPerPage
    const paginatedWaivers = filtered.slice(startIndex, startIndex + itemsPerPage)

    const btnStyle = (disabled: boolean): React.CSSProperties => ({
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'uppercase',
        backgroundColor: disabled ? '#f5f5f5' : '#1A1A1A',
        color: disabled ? '#aaa' : '#C58F3B',
        border: 'none',
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
    })

    return (
        <>
            {/* ─── CLIENT MASTER PROFILE MODAL ─── */}
            {selectedWaiver && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 999, backgroundColor: 'rgba(26,26,26,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ width: '100%', maxWidth: 800, backgroundColor: '#FDFCF8', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.3)', fontFamily: "'Inter',system-ui,sans-serif", maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

                        <div style={{ padding: '24px', borderBottom: '1px solid rgba(197,143,59,0.2)', backgroundColor: '#1A1A1A', color: '#FDFCF8', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#C58F3B', textTransform: 'uppercase', margin: '0 0 6px' }}>Master Client Record</p>
                                <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 28, margin: 0, color: '#FDFCF8' }}>{selectedWaiver.client_name}</h2>
                            </div>
                            <button onClick={() => setSelectedWaiver(null)} style={{ background: 'none', border: 'none', color: '#C58F3B', fontSize: 28, cursor: 'pointer', lineHeight: 1 }}>&times;</button>
                        </div>

                        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

                            {/* Waiver Details Section */}
                            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 300px', backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.08)', borderRadius: 12, padding: '20px' }}>
                                    <h3 style={{ fontSize: 12, fontWeight: 700, color: '#C58F3B', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px', borderBottom: '1px solid rgba(197,143,59,0.2)', paddingBottom: 8 }}>Health & Focus</h3>
                                    <div style={{ marginBottom: 12 }}>
                                        <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Declared Health Conditions</span>
                                        <span style={{ fontSize: 14, color: '#1A1A1A', fontWeight: 600 }}>{selectedWaiver.health_conditions}</span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Body Focus Areas</span>
                                        <span style={{ fontSize: 14, color: '#1A1A1A', fontWeight: 600 }}>{selectedWaiver.focus_areas}</span>
                                    </div>
                                </div>

                                <div style={{ flex: '1 1 300px', backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.08)', borderRadius: 12, padding: '20px' }}>
                                    <h3 style={{ fontSize: 12, fontWeight: 700, color: '#C58F3B', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px', borderBottom: '1px solid rgba(197,143,59,0.2)', paddingBottom: 8 }}>Digital Signature</h3>
                                    <div style={{ backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: 8, padding: '10px', textAlign: 'center', height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {selectedWaiver.signature ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={selectedWaiver.signature} alt="Client Signature" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                        ) : (
                                            <span style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>No signature captured</span>
                                        )}
                                    </div>
                                    <p style={{ margin: '8px 0 0', fontSize: 10, textAlign: 'right', color: '#666', fontWeight: 600 }}>SIGNED ON: {formatDateToDDMMMYY(selectedWaiver.parsedDate)}</p>
                                </div>
                            </div>

                            {/* Service History Section */}
                            <div>
                                <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 24, color: '#1A1A1A', margin: '0 0 12px', borderBottom: '1px solid rgba(26,26,26,0.1)', paddingBottom: 8 }}>Service & Therapist History</h3>

                                {historyLoading ? (
                                    <div style={{ padding: '30px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: '#fff', borderRadius: 12, border: '1px solid rgba(26,26,26,0.08)' }}>Locating past records...</div>
                                ) : clientHistory.length > 0 ? (
                                    <div style={{ border: '1px solid rgba(26,26,26,0.08)', borderRadius: 12, overflow: 'hidden' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left', backgroundColor: '#fff' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: '#F8F4EE', color: '#C58F3B', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.1em' }}>
                                                    <th style={{ padding: '12px 16px', borderBottom: '1px solid rgba(26,26,26,0.08)' }}>Date</th>
                                                    <th style={{ padding: '12px 16px', borderBottom: '1px solid rgba(26,26,26,0.08)' }}>Service Availed</th>
                                                    <th style={{ padding: '12px 16px', borderBottom: '1px solid rgba(26,26,26,0.08)' }}>Assigned Therapist</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {clientHistory.map((h, i) => (
                                                    <tr key={i} style={{ borderBottom: i === clientHistory.length - 1 ? 'none' : '1px solid rgba(26,26,26,0.06)' }}>
                                                        <td style={{ padding: '12px 16px', color: '#1A1A1A', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatDateToDDMMMYY(h.parsedDate)}</td>
                                                        <td style={{ padding: '12px 16px', color: '#4A4A4A' }}>{h.service}</td>
                                                        <td style={{ padding: '12px 16px', color: '#666' }}>{h.therapist}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div style={{ padding: '30px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: '#fff', borderRadius: 12, border: '1px solid rgba(26,26,26,0.08)' }}>
                                        No previous bookings found for this client under this exact name.
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* ─── MAIN PAGE UI ─── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Inter',system-ui,sans-serif" }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Compliance & Records</p>
                        <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 32, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Client Waivers</h2>
                    </div>
                    <button onClick={loadWaivers} style={{ padding: '0 16px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        {loading ? 'Refreshing...' : 'Refresh Database'}
                    </button>
                </div>

                {/* Search Bar */}
                <input
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search waiver by client name..."
                    style={{ height: 44, width: '100%', maxWidth: 400, padding: '0 16px', border: '1px solid rgba(26,26,26,0.16)', borderRadius: 8, fontSize: 15, outline: 'none' }}
                />

                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: '#fff', borderRadius: 16, border: '1px solid rgba(26,26,26,0.09)' }}>
                        Retrieving secured waivers...
                    </div>
                ) : (
                    <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
                        <div style={{ overflowX: 'auto', minHeight: 400 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)', backgroundColor: '#F8F4EE' }}>
                                        {['Date Signed', 'Client Name', 'Health Conditions', 'Focus Areas', 'Signature Status'].map(h => (
                                            <th key={h} style={{ padding: '14px 20px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C58F3B', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedWaivers.map((w) => (
                                        <tr key={w.id} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                                            <td style={{ padding: '14px 20px', color: '#666', whiteSpace: 'nowrap' }}>{formatDateToDDMMMYY(w.parsedDate)}</td>
                                            <td style={{ padding: '14px 20px', fontWeight: 700, color: '#1A1A1A' }}>
                                                <button
                                                    onClick={() => openClientProfile(w)}
                                                    style={{ background: 'none', border: 'none', color: '#1A1A1A', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 0, textDecoration: 'underline', textDecorationColor: 'rgba(197,143,59,0.5)', textUnderlineOffset: 4 }}
                                                >
                                                    {w.client_name}
                                                </button>
                                            </td>
                                            <td style={{ padding: '14px 20px', color: '#4A4A4A' }}>
                                                {w.health_conditions.length > 30 ? w.health_conditions.substring(0, 30) + '...' : w.health_conditions}
                                            </td>
                                            <td style={{ padding: '14px 20px', color: '#4A4A4A' }}>
                                                {w.focus_areas.length > 30 ? w.focus_areas.substring(0, 30) + '...' : w.focus_areas}
                                            </td>
                                            <td style={{ padding: '14px 20px' }}>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '4px 8px',
                                                    borderRadius: 6,
                                                    fontSize: 10,
                                                    fontWeight: 700,
                                                    letterSpacing: '0.05em',
                                                    backgroundColor: w.signature ? 'rgba(61,122,74,0.1)' : 'rgba(200,50,50,0.1)',
                                                    color: w.signature ? '#3D7A4A' : '#C83232',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {w.signature ? 'SIGNED' : 'MISSING'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {paginatedWaivers.length === 0 && <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No waivers found in the database.</td></tr>}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        <div style={{ padding: '16px 20px', backgroundColor: '#FDFCF8', borderTop: '1px solid rgba(26,26,26,0.09)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                            <span style={{ fontSize: 13, color: '#666' }}>
                                Showing <strong style={{ color: '#1A1A1A' }}>{filtered.length > 0 ? startIndex + 1 : 0}</strong> to <strong style={{ color: '#1A1A1A' }}>{Math.min(startIndex + itemsPerPage, filtered.length)}</strong> of <strong style={{ color: '#C58F3B' }}>{filtered.length.toLocaleString()}</strong> waivers
                            </span>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <button style={btnStyle(currentPage === 1)} onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>First</button>
                                <button style={btnStyle(currentPage === 1)} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</button>
                                <span style={{ padding: '0 10px', fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>Page {currentPage} of {totalPages}</span>
                                <button style={btnStyle(currentPage === totalPages)} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</button>
                                <button style={btnStyle(currentPage === totalPages)} onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>Last</button>
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </>
    )
}