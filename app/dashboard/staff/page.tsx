'use client'
export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Therapist {
    id: string | number;
    name: string;
    role: string;
    status: string;
}

export default function StaffPage() {
    const supabase = useRef(createClient()).current
    const [staff, setStaff] = useState<Therapist[]>([])
    const [loading, setLoading] = useState(true)

    // Modal State
    const [showModal, setShowModal] = useState(false)
    const [newName, setNewName] = useState('')
    const [newRole, setNewRole] = useState('Massage Therapist')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Fetch Staff from Supabase
    const loadStaff = useCallback(async () => {
        setLoading(true)
        // We check the 'therapists' table. (If your table is named 'staff', change it below)
        const { data, error } = await supabase
            .from('therapists')
            .select('*')
            .order('name', { ascending: true })

        if (!error && data) {
            // Map whatever columns Supabase returns into our standard format
            const formatted = data.map((t: any) => ({
                id: t.id,
                name: t.name || t.full_name || 'Unknown',
                role: t.role || t.specialty || 'Therapist',
                status: t.status || t.is_active === false ? 'Offline' : 'Active'
            }))
            setStaff(formatted)
        }
        setLoading(false)
    }, [supabase])

    useEffect(() => { loadStaff() }, [loadStaff])

    // Handle Adding New Therapist
    const handleAddStaff = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newName.trim()) return

        setIsSubmitting(true)

        // Insert into Supabase
        const { error } = await supabase
            .from('therapists')
            .insert([{
                name: newName.trim(),
                role: newRole
                // Note: Supabase will auto-generate the ID and created_at
            }])

        if (error) {
            alert("Error adding staff. Check if your table is named 'therapists' and has 'name' and 'role' columns. Error: " + error.message)
        } else {
            setNewName('')
            setShowModal(false)
            loadStaff() // Refresh the list instantly!
        }
        setIsSubmitting(false)
    }

    const activeCount = staff.filter(s => s.status === 'Active').length

    return (
        <>
            {/* ── ADD THERAPIST MODAL ── */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(10,8,6,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ width: '100%', maxWidth: 400, backgroundColor: '#F9F4EB', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.3)', fontFamily: "'Inter',system-ui,sans-serif" }}>
                        <div style={{ height: 4, backgroundColor: '#C58F3B' }} />
                        <form onSubmit={handleAddStaff} style={{ padding: '24px' }}>
                            <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 24, margin: '0 0 20px', color: '#1A1A1A' }}>Add New Staff</h3>

                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7A6E65', marginBottom: 8 }}>Full Name</label>
                                <input type="text" required value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Maria Santos" autoFocus
                                    style={{ width: '100%', height: 44, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(26,26,26,0.2)', fontSize: 15, outline: 'none' }} />
                            </div>

                            <div style={{ marginBottom: 24 }}>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7A6E65', marginBottom: 8 }}>Role / Specialty</label>
                                <select value={newRole} onChange={e => setNewRole(e.target.value)}
                                    style={{ width: '100%', height: 44, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(26,26,26,0.2)', fontSize: 15, outline: 'none', backgroundColor: '#fff', cursor: 'pointer' }}>
                                    <option value="Massage Therapist">Massage Therapist</option>
                                    <option value="Nail Technician">Nail Technician</option>
                                    <option value="Esthetician">Esthetician</option>
                                    <option value="Receptionist">Receptionist</option>
                                    <option value="Manager">Manager</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: 12 }}>
                                <button type="button" onClick={() => setShowModal(false)} disabled={isSubmitting}
                                    style={{ flex: 1, height: 44, backgroundColor: 'transparent', border: '1px solid rgba(26,26,26,0.2)', borderRadius: 8, color: '#1A1A1A', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" disabled={isSubmitting || !newName.trim()}
                                    style={{ flex: 1, height: 44, backgroundColor: '#1A1A1A', border: 'none', borderRadius: 8, color: '#C58F3B', fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
                                    {isSubmitting ? 'Saving...' : 'Save Staff'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── MAIN PAGE UI ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Inter',system-ui,sans-serif" }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Team</p>
                        <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 32, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Staff Management</h2>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={loadStaff} style={{ padding: '0 16px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>
                            Refresh
                        </button>
                        <button onClick={() => setShowModal(true)} style={{ padding: '0 16px', height: 38, border: 'none', borderRadius: 9, backgroundColor: '#1A1A1A', color: '#C58F3B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>
                            + Add New Therapist
                        </button>
                    </div>
                </div>

                {/* KPI Strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(200px,100%),1fr))', gap: 12 }}>
                    <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 8px' }}>Total Staff</p>
                        <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px' }}>{staff.length}</p>
                        <p style={{ fontSize: 11, color: '#9A8E85', margin: 0 }}>Registered in system</p>
                    </div>
                    <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 8px' }}>Active Duty</p>
                        <p style={{ fontSize: 24, fontWeight: 700, color: '#3D7A4A', margin: '0 0 4px' }}>{activeCount}</p>
                        <p style={{ fontSize: 11, color: '#9A8E85', margin: 0 }}>Currently available</p>
                    </div>
                </div>

                {/* Staff List */}
                {loading ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: 'rgba(197,143,59,0.07)', borderRadius: 12 }}>
                        Loading staff directory...
                    </div>
                ) : staff.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16 }}>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: 'rgba(197,143,59,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C58F3B" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                        </div>
                        <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#1A1A1A' }}>No staff yet</h3>
                        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#666' }}>Add your first therapist to get started.</p>
                        <button onClick={() => setShowModal(true)} style={{ padding: '0 20px', height: 40, border: 'none', borderRadius: 8, backgroundColor: '#1A1A1A', color: '#C58F3B', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>
                            + Add First Therapist
                        </button>
                    </div>
                ) : (
                    <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)', backgroundColor: '#F8F4EE' }}>
                                    {['Name', 'Role', 'Status'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C58F3B' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {staff.map((s, i) => (
                                    <tr key={s.id || i} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                                        <td style={{ padding: '14px 16px', fontWeight: 600, color: '#1A1A1A' }}>{s.name}</td>
                                        <td style={{ padding: '14px 16px', color: '#666' }}>{s.role}</td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', backgroundColor: s.status === 'Active' ? 'rgba(61,122,74,0.1)' : 'rgba(26,26,26,0.1)', color: s.status === 'Active' ? '#3D7A4A' : '#666' }}>
                                                {s.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    )
}