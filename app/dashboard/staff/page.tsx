'use client'
export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────
// TYPES & HELPERS
// ─────────────────────────────────────────────────────────────
interface StaffMember {
    id: string | number;
    name: string;
    role: string;
    status: string;
    off_days: string[]; // NEW: Array of days off
    dynamicStatus?: string;
}

interface BookingRecord {
    therapist_name: string;
    appointment_date: string;
    appointment_time: string;
    status: string;
    client_name?: string;
    service_name?: string;
}

const TIME_SLOTS = [
    '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
    '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
    '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM',
    '8:00 PM', '8:30 PM', '9:00 PM', '9:30 PM', '10:00 PM', '10:30 PM',
    '11:00 PM', '11:30 PM', '12:00 AM'
];

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Checks if an appointment is happening RIGHT NOW (65 min window)
function isTimeInSession(dateStr: string, timeStr: string): boolean {
    if (!dateStr || !timeStr) return false;

    const today = new Date();
    const dYear = today.getFullYear();
    const dMonth = String(today.getMonth() + 1).padStart(2, '0');
    const dDay = String(today.getDate()).padStart(2, '0');
    const todayStr = `${dYear}-${dMonth}-${dDay}`;

    if (dateStr !== todayStr) return false;

    const match = timeStr.match(/(\d+):(\d+)\s(AM|PM)/i);
    if (!match) return false;

    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const ampm = match[3].toUpperCase();

    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;

    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m, 0);
    const end = new Date(start.getTime() + 65 * 60000);

    return today >= start && today <= end;
}

export default function StaffPage() {
    const supabase = useRef(createClient()).current
    const [staffList, setStaffList] = useState<StaffMember[]>([])
    const [liveBookings, setLiveBookings] = useState<BookingRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<string>('All')
    const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table')

    // ─── SECURITY STATE ───
    const [dbPin, setDbPin] = useState('123456')
    const [isUnlocked, setIsUnlocked] = useState(false)
    const [showPinModal, setShowPinModal] = useState(false)
    const [pinInput, setPinInput] = useState('')
    const [pinError, setPinError] = useState(false)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const [pendingAction, setPendingAction] = useState<Function | null>(null)

    // ─── CRUD MODAL STATE ───
    const [showStaffModal, setShowStaffModal] = useState(false)
    const [editingId, setEditingId] = useState<string | number | null>(null)
    const [formData, setFormData] = useState({ name: '', role: 'Massage Therapist', status: 'Available', off_days: [] as string[] })
    const [isSubmitting, setIsSubmitting] = useState(false)

    // ─── DATA FETCHING ───
    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            // 1. Fetch PIN
            const { data: pinData } = await supabase.from('admin_settings').select('pin').single()
            if (pinData && pinData.pin) setDbPin(pinData.pin)

            // 2. Fetch Staff
            const { data: staffData } = await supabase.from('staff').select('*').order('name', { ascending: true })

            // 3. Fetch Live Bookings
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

            const { data: bookingsData } = await supabase
                .from('bookings')
                .select('therapist_name, appointment_date, appointment_time, status, client_name, service_name, service')
                .eq('appointment_date', todayStr)
                .neq('status', 'Completed')
                .neq('status', 'Cancelled')

            if (bookingsData) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const normalizedBookings = bookingsData.map((b: any) => ({
                    ...b,
                    service_name: b.service_name || b.service || 'Appointment'
                }))
                setLiveBookings(normalizedBookings)
            }

            if (staffData) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const formatted = staffData.map((t: any) => ({
                    id: t.id,
                    name: t.name || t.full_name || 'Unknown',
                    role: t.role || t.specialty || 'Massage Therapist',
                    status: t.status || 'Available',
                    off_days: t.off_days ? t.off_days.split(',').filter(Boolean) : []
                }))
                setStaffList(formatted)
            }
        } catch (err) {
            console.error("Fetch error:", err)
        } finally {
            setLoading(false)
        }
    }, [supabase])

    useEffect(() => { loadData() }, [loadData])

    // ─── DYNAMIC STATUS CALCULATOR ───
    const getDynamicStatus = (s: StaffMember) => {
        // 1. Hard Check: Is today their scheduled day off?
        const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        if (s.off_days.includes(todayName)) return 'Off Duty';

        // 2. Manual Check
        if (s.status === 'Off Duty') return 'Off Duty';

        // 3. Busy Check
        const isBusy = liveBookings.some(b =>
            b.therapist_name?.toLowerCase() === s.name.toLowerCase() &&
            (b.status === 'Ongoing' || isTimeInSession(b.appointment_date, b.appointment_time))
        );

        return isBusy ? 'In Session' : 'Available';
    }

    const dynamicStaff = staffList.map(s => ({ ...s, dynamicStatus: getDynamicStatus(s) }))

    // ─── SECURITY HANDLER ───
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const executeProtectedAction = (action: Function) => {
        if (isUnlocked) {
            action()
        } else {
            setPendingAction(() => action)
            setShowPinModal(true)
        }
    }

    const handlePinSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (pinInput === dbPin) {
            setIsUnlocked(true)
            setShowPinModal(false)
            setPinInput('')
            if (pendingAction) {
                pendingAction()
                setPendingAction(null)
            }
        } else {
            setPinError(true)
            setPinInput('')
        }
    }

    // ─── CRUD ACTIONS ───
    const handleOpenAdd = () => {
        setEditingId(null)
        setFormData({ name: '', role: 'Massage Therapist', status: 'Available', off_days: [] })
        setShowStaffModal(true)
    }

    const handleOpenEdit = (s: StaffMember) => {
        setEditingId(s.id)
        setFormData({ name: s.name, role: s.role, status: s.status, off_days: s.off_days })
        setShowStaffModal(true)
    }

    const toggleDayOff = (day: string) => {
        setFormData(prev => ({
            ...prev,
            off_days: prev.off_days.includes(day)
                ? prev.off_days.filter(d => d !== day)
                : [...prev.off_days, day]
        }))
    }

    const handleDelete = async (id: string | number, name: string) => {
        if (!window.confirm(`Are you sure you want to permanently delete ${name}?`)) return;
        try {
            await supabase.from('staff').delete().eq('id', id)
            loadData()
        } catch (err) {
            alert("Failed to delete staff.")
        }
    }

    const handleSaveStaff = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name.trim()) return

        setIsSubmitting(true)
        try {
            const dbPayload = {
                name: formData.name.trim(),
                role: formData.role,
                status: formData.status,
                off_days: formData.off_days.join(',')
            }

            if (editingId) {
                await supabase.from('staff').update(dbPayload).eq('id', editingId)
            } else {
                await supabase.from('staff').insert([dbPayload])
            }
            setShowStaffModal(false)
            loadData()
        } catch (err) {
            alert("Database Error: Make sure your 'staff' table is configured properly with the off_days column.")
        } finally {
            setIsSubmitting(false)
        }
    }

    // ─── KPIs & FILTERS ───
    const counts = {
        total: dynamicStaff.length,
        available: dynamicStaff.filter(s => s.dynamicStatus === 'Available').length,
        inSession: dynamicStaff.filter(s => s.dynamicStatus === 'In Session').length,
        offDuty: dynamicStaff.filter(s => s.dynamicStatus === 'Off Duty').length,
    }

    const displayedStaff = filter === 'All' ? dynamicStaff : dynamicStaff.filter(s => s.dynamicStatus === filter)

    return (
        <>
            <style>{`
                .modal-overlay { position: fixed; inset: 0; z-index: 50; background-color: rgba(10,8,6,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 20px; }
                .cal-scroll::-webkit-scrollbar { height: 8px; }
                .cal-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.02); border-radius: 4px; }
                .cal-scroll::-webkit-scrollbar-thumb { background: rgba(197,143,59,0.3); border-radius: 4px; }
                .cal-scroll::-webkit-scrollbar-thumb:hover { background: rgba(197,143,59,0.6); }
            `}</style>

            {/* ── PIN SECURITY MODAL ── */}
            {showPinModal && (
                <div className="modal-overlay">
                    <div style={{ backgroundColor: '#F9F4EB', padding: 32, borderRadius: 16, width: '100%', maxWidth: 400, textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.3)', fontFamily: "'Inter',system-ui,sans-serif" }}>
                        <div style={{ width: 50, height: 50, borderRadius: '50%', backgroundColor: 'rgba(197,143,59,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C58F3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        </div>
                        <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 28, margin: '0 0 8px', color: '#1A1A1A' }}>Security Lock</h3>
                        <p style={{ fontSize: 13, color: '#666', margin: '0 0 24px' }}>Please enter your PIN to modify records.</p>

                        <form onSubmit={handlePinSubmit}>
                            <input
                                type="password"
                                maxLength={6}
                                value={pinInput}
                                onChange={e => setPinInput(e.target.value)}
                                placeholder="ENTER PIN"
                                autoFocus
                                style={{ width: '100%', height: 50, textAlign: 'center', fontSize: 20, letterSpacing: '0.3em', border: `1px solid ${pinError ? '#C83232' : 'rgba(26,26,26,0.2)'}`, borderRadius: 8, outline: 'none', marginBottom: 12, backgroundColor: '#fff' }}
                            />
                            {pinError && <p style={{ color: '#C83232', fontSize: 11, margin: '0 0 12px', fontWeight: 600 }}>INCORRECT PIN</p>}

                            <div style={{ display: 'flex', gap: 12 }}>
                                <button type="button" onClick={() => setShowPinModal(false)} style={{ flex: 1, height: 44, backgroundColor: 'transparent', border: '1px solid rgba(26,26,26,0.2)', borderRadius: 8, color: '#1A1A1A', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" disabled={!pinInput} style={{ flex: 1, height: 44, backgroundColor: '#1A1A1A', color: '#C58F3B', border: 'none', borderRadius: 8, fontWeight: 600, cursor: pinInput ? 'pointer' : 'not-allowed' }}>Unlock</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── ADD/EDIT STAFF MODAL ── */}
            {showStaffModal && (
                <div className="modal-overlay">
                    <div style={{ width: '100%', maxWidth: 450, backgroundColor: '#F9F4EB', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.3)', fontFamily: "'Inter',system-ui,sans-serif" }}>
                        <div style={{ height: 4, backgroundColor: '#C58F3B' }} />
                        <form onSubmit={handleSaveStaff} style={{ padding: '24px' }}>
                            <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 24, margin: '0 0 20px', color: '#1A1A1A' }}>
                                {editingId ? 'Edit Profile' : 'Add New Therapist'}
                            </h3>

                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7A6E65', marginBottom: 8 }}>Full Name</label>
                                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Maria Santos" autoFocus
                                    style={{ width: '100%', height: 44, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(26,26,26,0.2)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
                            </div>

                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7A6E65', marginBottom: 8 }}>Role</label>
                                <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    style={{ width: '100%', height: 44, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(26,26,26,0.2)', fontSize: 15, outline: 'none', backgroundColor: '#fff', cursor: 'pointer', boxSizing: 'border-box' }}>
                                    <option value="Massage Therapist">Massage Therapist</option>
                                    <option value="Nail Technician">Nail Technician</option>
                                    <option value="Maintenance">Maintenance</option>
                                    <option value="Receptionist">Receptionist</option>
                                    <option value="Manager">Manager</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7A6E65', marginBottom: 8 }}>Base Status</label>
                                <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    style={{ width: '100%', height: 44, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(26,26,26,0.2)', fontSize: 15, outline: 'none', backgroundColor: '#fff', cursor: 'pointer', boxSizing: 'border-box' }}>
                                    <option value="Available">Available</option>
                                    <option value="Off Duty">Off Duty</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: 24, padding: '16px', backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.08)', borderRadius: 12 }}>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1A1A1A', marginBottom: 12 }}>Scheduled Days Off</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {DAYS_OF_WEEK.map(day => (
                                        <div
                                            key={day}
                                            onClick={() => toggleDayOff(day)}
                                            style={{
                                                padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', userSelect: 'none', border: '1px solid', transition: 'all 0.2s ease',
                                                backgroundColor: formData.off_days.includes(day) ? '#1A1A1A' : '#f9f9f9',
                                                color: formData.off_days.includes(day) ? '#C58F3B' : '#666',
                                                borderColor: formData.off_days.includes(day) ? '#1A1A1A' : 'rgba(26,26,26,0.1)'
                                            }}>
                                            {day.slice(0, 3)}
                                        </div>
                                    ))}
                                </div>
                                <p style={{ fontSize: 11, color: '#888', fontStyle: 'italic', marginTop: 12, marginBottom: 0 }}>System will automatically lock schedule on selected days.</p>
                            </div>

                            <div style={{ display: 'flex', gap: 12 }}>
                                <button type="button" onClick={() => setShowStaffModal(false)} disabled={isSubmitting}
                                    style={{ flex: 1, height: 44, backgroundColor: 'transparent', border: '1px solid rgba(26,26,26,0.2)', borderRadius: 8, color: '#1A1A1A', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" disabled={isSubmitting || !formData.name.trim()}
                                    style={{ flex: 1, height: 44, backgroundColor: '#1A1A1A', border: 'none', borderRadius: 8, color: '#C58F3B', fontWeight: 700, cursor: isSubmitting || !formData.name.trim() ? 'not-allowed' : 'pointer' }}>
                                    {isSubmitting ? 'Saving...' : 'Save Profile'}
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
                        <button onClick={loadData} style={{ padding: '0 16px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M10.5 6a4.5 4.5 0 1 1-1.35-3.18M10.5 2.25V5.5H7.25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            Refresh
                        </button>
                        <button onClick={() => executeProtectedAction(handleOpenAdd)} style={{ padding: '0 16px', height: 38, border: 'none', borderRadius: 9, backgroundColor: '#1A1A1A', color: '#C58F3B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>
                            + Add New Therapist
                        </button>
                    </div>
                </div>

                {/* 4 Stat Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(200px,100%),1fr))', gap: 12 }}>
                    <div onClick={() => setFilter('All')} style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '18px', cursor: 'pointer', boxShadow: filter === 'All' ? '0 0 0 2px #1A1A1A' : '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 8px' }}>Total Staff</p>
                        <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px' }}>{counts.total}</p>
                        <p style={{ fontSize: 11, color: '#9A8E85', margin: 0 }}>Registered</p>
                    </div>

                    <div onClick={() => setFilter('Available')} style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '18px', cursor: 'pointer', position: 'relative', overflow: 'hidden', boxShadow: filter === 'Available' ? '0 0 0 2px #3D7A4A' : '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: '#3D7A4A' }} />
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#3D7A4A', margin: '0 0 8px' }}>Available</p>
                        <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px' }}>{counts.available}</p>
                        <p style={{ fontSize: 11, color: '#9A8E85', margin: 0 }}>Tap to filter</p>
                    </div>

                    <div onClick={() => setFilter('In Session')} style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '18px', cursor: 'pointer', position: 'relative', overflow: 'hidden', boxShadow: filter === 'In Session' ? '0 0 0 2px #C58F3B' : '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: '#C58F3B' }} />
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 8px' }}>In Session</p>
                        <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px' }}>{counts.inSession}</p>
                        <p style={{ fontSize: 11, color: '#9A8E85', margin: 0 }}>Tap to filter</p>
                    </div>

                    <div onClick={() => setFilter('Off Duty')} style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '18px', cursor: 'pointer', position: 'relative', overflow: 'hidden', boxShadow: filter === 'Off Duty' ? '0 0 0 2px #888' : '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: '#888' }} />
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 8px' }}>Off Duty</p>
                        <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px' }}>{counts.offDuty}</p>
                        <p style={{ fontSize: 11, color: '#9A8E85', margin: 0 }}>Tap to filter</p>
                    </div>
                </div>

                {/* ─── VIEW TOGGLE (TABLE vs CALENDAR) ─── */}
                <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid rgba(26,26,26,0.1)', paddingBottom: 12 }}>
                    <button
                        onClick={() => setViewMode('table')}
                        style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', border: 'none', cursor: 'pointer', backgroundColor: viewMode === 'table' ? '#1A1A1A' : 'transparent', color: viewMode === 'table' ? '#C58F3B' : '#666', transition: 'all 200ms ease' }}
                    >
                        List View
                    </button>
                    <button
                        onClick={() => setViewMode('calendar')}
                        style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', border: 'none', cursor: 'pointer', backgroundColor: viewMode === 'calendar' ? '#1A1A1A' : 'transparent', color: viewMode === 'calendar' ? '#C58F3B' : '#666', transition: 'all 200ms ease' }}
                    >
                        Daily Schedule
                    </button>
                </div>

                {/* Staff List / Empty State / Calendar */}
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: '#fff', borderRadius: 16, border: '1px solid rgba(26,26,26,0.09)' }}>Aggregating staff data and live bookings...</div>
                ) : staffList.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: '#F8F4EE', border: '1px solid rgba(197,143,59,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#C58F3B' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                        </div>
                        <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 24, color: '#1A1A1A', margin: '0 0 8px' }}>No staff yet</h3>
                        <p style={{ color: '#7A6E65', fontSize: 14, margin: '0 0 24px' }}>Add your first therapist to get started.</p>
                        <button onClick={() => executeProtectedAction(handleOpenAdd)} style={{ padding: '0 24px', height: 44, border: 'none', borderRadius: 8, backgroundColor: '#1A1A1A', color: '#C58F3B', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>
                            + Add First Therapist
                        </button>
                    </div>
                ) : viewMode === 'calendar' ? (

                    /* ─── NEW CALENDAR MATRIX VIEW ─── */
                    <div className="cal-scroll" style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, overflowX: 'auto', boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(197,143,59,0.2)' }}>
                            <h3 style={{ margin: 0, fontSize: 16, color: '#1A1A1A', fontFamily: "'Cormorant Garamond',Georgia,serif" }}>Today's Therapist Schedule</h3>
                            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666' }}>Scroll right to view all appointments. Automated off-days block scheduling.</p>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 1200 }}>
                            <thead>
                                <tr style={{ backgroundColor: '#F8F4EE' }}>
                                    <th style={{ padding: '14px 20px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C58F3B', position: 'sticky', left: 0, backgroundColor: '#F8F4EE', zIndex: 10, borderRight: '1px solid rgba(26,26,26,0.09)', minWidth: 200 }}>
                                        Therapist
                                    </th>
                                    {TIME_SLOTS.map(t => (
                                        <th key={t} style={{ padding: '14px 10px', fontSize: 10, fontWeight: 700, color: '#666', borderRight: '1px solid rgba(26,26,26,0.05)', minWidth: 140, textAlign: 'center' }}>
                                            {t}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {displayedStaff.map((s, i) => (
                                    <tr key={s.id || i} style={{ borderTop: '1px solid rgba(26,26,26,0.06)' }}>
                                        <td style={{ padding: '12px 20px', position: 'sticky', left: 0, backgroundColor: '#fff', zIndex: 9, borderRight: '1px solid rgba(26,26,26,0.09)', boxShadow: '2px 0 5px rgba(0,0,0,0.02)' }}>
                                            <div style={{ fontWeight: 700, color: '#1A1A1A', fontSize: 13, marginBottom: 4 }}>{s.name}</div>
                                            <div style={{ fontSize: 10, color: s.dynamicStatus === 'Off Duty' ? '#C83232' : '#888', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: s.dynamicStatus === 'Off Duty' ? 800 : 400 }}>
                                                {s.dynamicStatus}
                                            </div>
                                        </td>

                                        {/* CALENDAR BLOCKOUT LOGIC */}
                                        {s.dynamicStatus === 'Off Duty' ? (
                                            <td colSpan={TIME_SLOTS.length} style={{ padding: 0, backgroundColor: 'rgba(26,26,26,0.03)', textAlign: 'center' }}>
                                                <div style={{ padding: '10px', margin: '6px', borderRadius: 8, border: '1px dashed rgba(26,26,26,0.2)', color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>
                                                    OFF DUTY / UNAVAILABLE TODAY
                                                </div>
                                            </td>
                                        ) : (
                                            TIME_SLOTS.map(t => {
                                                const booking = liveBookings.find(b => b.therapist_name?.toLowerCase() === s.name.toLowerCase() && b.appointment_time === t);
                                                return (
                                                    <td key={t} style={{ padding: '6px', borderRight: '1px solid rgba(26,26,26,0.05)', backgroundColor: booking ? 'rgba(197,143,59,0.05)' : 'transparent', verticalAlign: 'top' }}>
                                                        {booking ? (
                                                            <div style={{ padding: '8px', backgroundColor: '#fff', border: '1px solid rgba(197,143,59,0.3)', borderRadius: 6, borderLeft: '4px solid #C58F3B', height: '100%' }}>
                                                                <div style={{ fontSize: 11, fontWeight: 700, color: '#1A1A1A', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {booking.client_name || 'Walk-in Client'}
                                                                </div>
                                                                <div style={{ fontSize: 10, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {booking.service_name}
                                                                </div>
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                )
                                            })
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                ) : (

                    /* ─── EXISTING DATA TABLE VIEW ─── */
                    <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)', backgroundColor: '#F8F4EE' }}>
                                        {['Name', 'Role', 'Status', 'Days Off', 'Actions'].map(h => (
                                            <th key={h} style={{ padding: '14px 20px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C58F3B', whiteSpace: 'nowrap' }}>{h}</th>
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
                                                    display: 'inline-block', padding: '4px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                                                    backgroundColor: s.dynamicStatus === 'Available' ? 'rgba(61,122,74,0.1)' : s.dynamicStatus === 'In Session' ? 'rgba(197,143,59,0.1)' : 'rgba(26,26,26,0.05)',
                                                    color: s.dynamicStatus === 'Available' ? '#3D7A4A' : s.dynamicStatus === 'In Session' ? '#C58F3B' : '#666'
                                                }}>
                                                    {s.dynamicStatus}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 20px' }}>
                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 150 }}>
                                                    {s.off_days && s.off_days.length > 0 ? s.off_days.map(d => (
                                                        <span key={d} style={{ fontSize: 9, padding: '2px 6px', backgroundColor: '#f5f5f5', borderRadius: 4, border: '1px solid #e0e0e0', color: '#666', fontWeight: 600 }}>{d.slice(0, 3)}</span>
                                                    )) : <span style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>None</span>}
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
                                                <button onClick={() => executeProtectedAction(() => handleOpenEdit(s))} style={{ background: 'none', border: 'none', color: '#1A1A1A', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginRight: 16, textTransform: 'uppercase', textDecoration: 'underline', textDecorationColor: 'rgba(197,143,59,0.5)', textUnderlineOffset: 4 }}>Edit</button>
                                                <button onClick={() => executeProtectedAction(() => handleDelete(s.id, s.name))} style={{ background: 'none', border: 'none', color: '#C83232', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>Delete</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {displayedStaff.length === 0 && (
                                        <tr><td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#666' }}>No staff match this filter.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}