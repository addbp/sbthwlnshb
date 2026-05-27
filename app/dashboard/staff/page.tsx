'use client'
export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface StaffMember {
    id: string | number;
    name: string;
    role: string;
    status: string; // 'Available', 'In Session', 'Off Duty'
}

export default function StaffPage() {
    const supabase = useRef(createClient()).current
    const [staffList, setStaffList] = useState<StaffMember[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<string>('All')

    // Modal State
    const [showModal, setShowModal] = useState(false)
    const [newName, setNewName] = useState('')
    const [newRole, setNewRole] = useState('Massage Therapist')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Fetch Staff from Supabase using the "staff" table
    const loadStaff = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('staff')
            .select('*')
            .order('created_at', { ascending: false })

        if (!error && data) {
            const formatted = data.map((t: any) => ({
                id: t.id,
                name: t.name || t.full_name || 'Unknown',
                role: t.role || t.specialty || 'Therapist',
                status: t.status || 'Available'
            }))
            setStaffList(formatted)
        } else if (error) {
            console.error("Staff fetch error:", error)
        }
        setLoading(false)
    }, [supabase])

    useEffect(() => { loadStaff() }, [loadStaff])

    // Handle Adding New Staff
    const handleAddStaff = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newName.trim()) return

        setIsSubmitting(true)
        const { error } = await supabase
            .from('staff')
            .insert([{
                name: newName.trim(),
                role: newRole,
                status: 'Available'
            }])

        if (!error) {
            setNewName('')
            setNewRole('Massage Therapist')
            setShowModal(false)
            loadStaff()
        } else {
            alert("Database Error: Make sure your 'staff' table exists and has 'name', 'role', and 'status' columns.")
        }
        setIsSubmitting(false)
    }

    const counts = {
        total: staffList.length,
        available: staffList.filter(s => s.status === 'Available').length,
        inSession: staffList.filter(s => s.status === 'In Session').length,
        offDuty: staffList.filter(s => s.status === 'Off Duty').length,
    }

    const displayedStaff = filter === 'All' ? staffList : staffList.filter(s => s.status === filter)

    return (
        <>
            {/* ── ADD STAFF MODAL ── */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(10,8,6,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ width: '100%', maxWidth: 400, backgroundColor: '#F9F4EB', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.3)', fontFamily: "'Inter',system-ui,sans-serif" }}>
                        <div style={{ height: 4, backgroundColor: '#C58F3B' }} />
                        <form onSubmit={handleAddStaff} style={{ padding: '24px' }}>
                            <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 24, margin: '0 0 20px', color: '#1A1A1A' }}>Add New Therapist</h3>

                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7A6E65', marginBottom: 8 }}>Full Name</label>
                                <input type="text" required value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Maria Santos" autoFocus
                                    style={{ width: '100%', height: 44, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(26,26,26,0.2)', fontSize: 15, outline: 'none' }} />
                            </div>

                            <div style={{ marginBottom: 24 }}>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7A6E65', marginBottom: 8 }}>Role</label>
                                <select value={newRole} onChange={e => setNewRole(e.target.value)}
                                    style={{ width: '100%', height: 44, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(26,26,26,0.2)', fontSize: 15, outline: 'none', backgroundColor: '#fff', cursor: 'pointer' }}>
                                    <option value="Massage Therapist">Massage Therapist</option>
                                    <option value="Nail Technician">Nail Technician</option>
                                    <option value="Maintenance">Maintenance</option>
                                    <option value="Receptionist">Receptionist</option>
                                    <option value="Manager">Manager</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: 12 }}>
                                <button type="button" onClick={() => setShowModal(false)} disabled={isSubmitting}
                                    style={{ flex: 1, height: 44, backgroundColor: 'transparent', border: '1px solid rgba(26,26,26,0.2)', borderRadius: 8, color: '#1A1A1A', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" disabled={isSubmitting || !newName.trim()}
                                    style={{ flex: 1, height: 44, backgroundColor: '#1A1A1A', border: 'none', borderRadius: 8, color: '#C58F3B', fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
                                    {isSubmitting ? 'Saving...' : 'Save Therapist'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── MAIN PAGE UI ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Inter',system-ui,sans-serif" }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Team</p>
                        <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 32, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Staff Management</h2>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={loadStaff} style={{ padding: '0 16px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M10.5 6a4.5 4.5 0 1 1-1.35-3.18M10.5 2.25V5.5H7.25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            Refresh
                        </button>
                        <button onClick={() => setShowModal(true)} style={{ padding: '0 16px', height: 38, border: 'none', borderRadius: 9, backgroundColor: '#1A1A1A', color: '#C58F3B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>
                            + Add New Therapist
                        </button>
                    </div>
                </div>

                {/* 4 Stat Cards (Original UI Restored) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(200px,100%),1fr))', gap: 12 }}>

                    {/* Total Staff */}
                    <div onClick={() => setFilter('All')} style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '18px', cursor: 'pointer', boxShadow: filter === 'All' ? '0 0 0 2px #1A1A1A' : '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 8px' }}>Total Staff</p>
                        <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px' }}>{counts.total}</p>
                        <p style={{ fontSize: 11, color: '#9A8E85', margin: 0 }}>Registered</p>
                    </div>

                    {/* Available */}
                    <div onClick={() => setFilter('Available')} style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '18px', cursor: 'pointer', position: 'relative', overflow: 'hidden', boxShadow: filter === 'Available' ? '0 0 0 2px #3D7A4A' : '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: '#3D7A4A' }} />
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#3D7A4A', margin: '0 0 8px' }}>Available</p>
                        <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px' }}>{counts.available}</p>
                        <p style={{ fontSize: 11, color: '#9A8E85', margin: 0 }}>Tap to filter</p>
                    </div>

                    {/* In Session */}
                    <div onClick={() => setFilter('In Session')} style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '18px', cursor: 'pointer', position: 'relative', overflow: 'hidden', boxShadow: filter === 'In Session' ? '0 0 0 2px #C58F3B' : '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: '#C58F3B' }} />
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 8px' }}>In Session</p>
                        <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px' }}>{counts.inSession}</p>
                        <p style={{ fontSize: 11, color: '#9A8E85', margin: 0 }}>Tap to filter</p>
                    </div>

                    {/* Off Duty */}
                    <div onClick={() => setFilter('Off Duty')} style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '18px', cursor: 'pointer', position: 'relative', overflow: 'hidden', boxShadow: filter === 'Off Duty' ? '0 0 0 2px #888' : '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: '#888' }} />
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 8px' }}>Off Duty</p>
                        <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px' }}>{counts.offDuty}</p>
                        <p style={{ fontSize: 11, color: '#9A8E85', margin: 0 }}>Tap to filter</p>
                    </div>
                </div>

                {/* Staff List / Empty State */}
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontStyle: 'italic' }}>Loading team data...</div>
                ) : staffList.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: '#F8F4EE', border: '1px solid rgba(197,143,59,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#C58F3B' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                        </div>
                        <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 24, color: '#1A1A1A', margin: '0 0 8px' }}>No staff yet</h3>
                        <p style={{ color: '#7A6E65', fontSize: 14, margin: '0 0 24px' }}>Add your first therapist to get started.</p>
                        <button onClick={() => setShowModal(true)} style={{ padding: '0 24px', height: 44, border: 'none', borderRadius: 8, backgroundColor: '#1A1A1A', color: '#C58F3B', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>
                            + Add First Therapist
                        </button>
                    </div>
                ) : (
                    <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)', backgroundColor: '#F8F4EE' }}>
                                    {['Name', 'Role', 'Status'].map(h => (
                                        <th key={h} style={{ padding: '14px 20px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C58F3B' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {displayedStaff.map((s, i) => (
                                    <tr key={s.id || i} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                                        <td style={{ padding: '16px 20px', fontWeight: 600, color: '#1A1A1A' }}>{s.name}</td>
                                        <td style={{ padding: '16px 20px', color: '#666' }}>{s.role}</td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <span style={{
                                                padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                                                backgroundColor: s.status === 'Available' ? 'rgba(61,122,74,0.1)' : s.status === 'In Session' ? 'rgba(197,143,59,0.1)' : 'rgba(26,26,26,0.1)',
                                                color: s.status === 'Available' ? '#3D7A4A' : s.status === 'In Session' ? '#C58F3B' : '#666'
                                            }}>
                                                {s.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {displayedStaff.length === 0 && (
                                    <tr><td colSpan={3} style={{ padding: '30px', textAlign: 'center', color: '#666' }}>No staff match this filter.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    )
}