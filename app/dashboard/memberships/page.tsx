'use client'

// app/dashboard/memberships/page.tsx
// Membership Directory & Tracker (Strict PIN 061026, Auto-Deduct Balances, Auto-fill Packages, Client History Sync)

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback, useRef } from 'react'
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

// Master PIN
const MASTER_PIN = '061026';

// ─── INTERFACES ───
interface Membership {
    id: string;
    created_at: string;
    client_name: string;
    client_mobile: string;
    client_email: string;
    membership_tier: string;
    discount_percentage: number;
    status: string;
    valid_until: string;
    remaining_massages: string;
    package_inclusions: string;
    receptionist_track: string;
}

export default function MembershipsPage() {
    const supabase = useRef(createClient()).current
    const [memberships, setMemberships] = useState<Membership[]>([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [allBookings, setAllBookings] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // ─── SECURITY STATE ───
    const [showPinModal, setShowPinModal] = useState(false)
    const [pinInput, setPinInput] = useState('')
    const [pinError, setPinError] = useState(false)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const [pendingAction, setPendingAction] = useState<Function | null>(null)

    // ─── CRUD & INTERACTIVE MODAL STATE ───
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const [selectedClient, setSelectedClient] = useState<Membership | null>(null)

    const [formData, setFormData] = useState({
        client_name: '',
        client_mobile: '',
        client_email: '',
        membership_tier: 'Basic',
        discount_percentage: 5,
        status: 'Active',
        valid_until: '',
        remaining_massages: '6',
        package_inclusions: '6 Regular Massages + 5% Off Nail Services'
    })

    // ─── DATA FETCHING (UNLIMITED ENGINE) ───
    const fetchMembershipsAndBookings = useCallback(async () => {
        setLoading(true)
        try {
            // 1. Fetch Memberships
            const { data: memData, error: memError } = await supabase
                .from('memberships')
                .select('*')
                .order('created_at', { ascending: false })

            if (memError) throw memError;
            setMemberships(memData || [])

            // 2. Fetch All Booking Records for Accurate Deductions & History
            const fetchUnlimited = async (tableName: string) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const allData: any[] = [];
                let start = 0;
                const step = 1000;
                for (; ;) {
                    const { data, error } = await supabase.from(tableName).select('*').range(start, start + step - 1);
                    if (error || !data || data.length === 0) break;
                    allData.push(...data);
                    if (data.length < step) break;
                    start += step;
                }
                return allData;
            };

            const liveBookings = await fetchUnlimited('bookings');
            const impBookings = await fetchUnlimited('bookings_import');

            const combined = [
                ...liveBookings.map(b => ({
                    client_name: b.client_name || '',
                    service_name: b.service_name || b.service || '',
                    date: b.appointment_date || b.created_at,
                    created_at: b.created_at,
                    therapist: b.therapist_name || b.therapist || 'Unassigned'
                })),
                ...impBookings.map(b => ({
                    client_name: b.client_name || '',
                    service_name: b.service || '',
                    date: b.date || b.created_at,
                    created_at: b.created_at,
                    therapist: b.therapist || 'Unassigned'
                }))
            ];

            combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setAllBookings(combined);

        } catch (err) {
            console.error("Fetch error:", err)
        } finally {
            setLoading(false)
        }
    }, [supabase])

    useEffect(() => { fetchMembershipsAndBookings() }, [fetchMembershipsAndBookings])

    // ─── SECURITY HANDLER ───
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const executeProtectedAction = (action: Function) => {
        setPendingAction(() => action)
        setPinError(false)
        setPinInput('')
        setShowPinModal(true)
    }

    const handlePinSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (pinInput === MASTER_PIN) {
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

    // ─── SMART AUTO-FILL PACKAGE LOGIC ───
    const applyPackageDefaults = (tier: string) => {
        let disc = 0;
        let massages = '';
        let inclusions = '';
        let monthsToAdd = 1;

        if (tier === 'Basic') {
            disc = 5;
            massages = '6';
            inclusions = '6 Regular Massages + 5% Off Nail Services';
            monthsToAdd = 1;
        } else if (tier === 'Gold') {
            disc = 5;
            massages = '20';
            inclusions = '20 Regular Massages (Valid for 3 Months) + 5% Off Nail Services';
            monthsToAdd = 3;
        } else if (tier === 'Platinum') {
            disc = 10;
            massages = 'Unlimited';
            inclusions = 'Unlimited Daily Massage + 10% Off Nails, 1 Free Private Suite & Coffee/Tea + Meals';
            monthsToAdd = 6;
        } else if (tier === 'VIP') {
            disc = 10;
            massages = 'Unlimited';
            inclusions = 'Unlimited Daily Massage + 10% Off Nails & Wet Floor, 4 Wet Floor Sessions, Coffee/Tea + Meals';
            monthsToAdd = 12;
        }

        const d = new Date();
        d.setMonth(d.getMonth() + monthsToAdd);
        const validUntilDate = d.toISOString().split('T')[0];

        return { disc, massages, inclusions, validUntilDate };
    }

    // ─── CRUD ACTIONS ───
    const handleOpenAdd = () => {
        setEditingId(null)
        const defaults = applyPackageDefaults('Basic');
        setFormData({
            client_name: '', client_mobile: '', client_email: '',
            membership_tier: 'Basic', discount_percentage: defaults.disc, status: 'Active',
            valid_until: defaults.validUntilDate, remaining_massages: defaults.massages, package_inclusions: defaults.inclusions
        })
        setShowModal(true)
    }

    const handleOpenEdit = (m: Membership) => {
        setEditingId(m.id)
        setFormData({
            client_name: m.client_name || '',
            client_mobile: m.client_mobile || '',
            client_email: m.client_email || '',
            membership_tier: m.membership_tier || 'Basic',
            discount_percentage: m.discount_percentage || 0,
            status: m.status || 'Active',
            valid_until: m.valid_until || '',
            remaining_massages: m.remaining_massages || '',
            package_inclusions: m.package_inclusions || ''
        })
        setShowModal(true)
    }

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to permanently delete the membership for ${name}?`)) return;
        try {
            await supabase.from('memberships').delete().eq('id', id)
            fetchMembershipsAndBookings()
        } catch (err) {
            alert("Failed to delete membership.")
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.client_name.trim()) return

        setIsSubmitting(true)
        try {
            const payload = { ...formData }

            if (editingId) {
                await supabase.from('memberships').update(payload).eq('id', editingId)
            } else {
                await supabase.from('memberships').insert([payload])
            }

            setShowModal(false)
            fetchMembershipsAndBookings()
        } catch (err: any) {
            alert("Database Error: " + err.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    // ─── HELPERS & SMART CALCULATORS ───
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '—'
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    const getStatusColor = (status: string) => {
        if (status === 'Active') return { bg: 'rgba(61,122,74,0.1)', color: '#3D7A4A' }
        if (status === 'Expired') return { bg: 'rgba(200,50,50,0.1)', color: '#C83232' }
        return { bg: 'rgba(26,26,26,0.05)', color: '#666' }
    }

    const handleTierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const tier = e.target.value;
        const defaults = applyPackageDefaults(tier);

        setFormData({
            ...formData,
            membership_tier: tier,
            discount_percentage: defaults.disc,
            remaining_massages: defaults.massages,
            package_inclusions: defaults.inclusions,
            valid_until: defaults.validUntilDate
        })
    }

    const isServiceIncluded = (serviceName: string, packageInclusions: string) => {
        if (!serviceName || !packageInclusions) return false;
        const s = serviceName.toLowerCase();
        const p = packageInclusions.toLowerCase();

        if (p.includes(s) || s.includes(p)) return true;
        if (p.includes('massage') && (s.includes('massage') || s.includes('swedish') || s.includes('shiatsu') || s.includes('reflexology') || s.includes('combination') || s.includes('hilot'))) return true;
        if (p.includes('nail') && (s.includes('nail') || s.includes('manicure') || s.includes('pedicure') || s.includes('foot'))) return true;

        return false;
    }

    return (
        <>
            <style>{`
        .modal-overlay { position: fixed; inset: 0; z-index: 50; background-color: rgba(10,8,6,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 20px; }
        .m-input { width: 100%; height: 44px; padding: 0 14px; border-radius: 8px; border: 1px solid rgba(26,26,26,0.2); font-size: 14px; outline: none; box-sizing: border-box; font-family: ${BODY}; color: ${BLACK}; }
        .m-input:focus { border-color: ${GOLD}; box-shadow: 0 0 0 3px rgba(197,143,59,0.15); }
        .m-label { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #7A6E65; margin-bottom: 8px; }
        .client-name-link:hover { color: ${GOLD}; cursor: pointer; text-decoration: underline; text-underline-offset: 4px; }
      `}</style>

            {/* ── CLIENT HISTORY MODAL ── */}
            {selectedClient && (
                <div className="modal-overlay" onClick={() => setSelectedClient(null)}>
                    <div style={{ width: '100%', maxWidth: 700, backgroundColor: '#F9F4EB', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.3)', fontFamily: BODY, display: 'flex', flexDirection: 'column', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '24px', borderBottom: '1px solid rgba(26,26,26,0.1)', backgroundColor: WHITE, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: GOLD, margin: '0 0 4px' }}>Client Profile Database</p>
                                <h3 style={{ fontFamily: DSP, fontSize: 28, margin: 0, color: BLACK }}>{selectedClient.client_name}</h3>
                            </div>
                            <button onClick={() => setSelectedClient(null)} style={{ background: 'none', border: 'none', fontSize: 28, cursor: 'pointer', color: '#666' }}>&times;</button>
                        </div>
                        <div style={{ padding: '24px', overflowY: 'auto', backgroundColor: '#F9F4EB' }}>
                            <h4 style={{ fontSize: 13, fontWeight: 700, color: BLACK, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verified Service History</h4>
                            <div style={{ backgroundColor: WHITE, borderRadius: 12, border: '1px solid rgba(26,26,26,0.08)', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                                    <thead style={{ backgroundColor: '#F8F4EE', borderBottom: '1px solid rgba(26,26,26,0.08)' }}>
                                        <tr>
                                            <th style={{ padding: '12px 16px', color: GOLD, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Date Attended</th>
                                            <th style={{ padding: '12px 16px', color: GOLD, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Service Rendered</th>
                                            <th style={{ padding: '12px 16px', color: GOLD, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Therapist</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allBookings
                                            .filter(b => b.client_name.toLowerCase() === selectedClient.client_name.toLowerCase())
                                            .map((b, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid rgba(26,26,26,0.05)' }}>
                                                    <td style={{ padding: '14px 16px', color: '#666', whiteSpace: 'nowrap' }}>
                                                        {formatDate(b.date)}
                                                    </td>
                                                    <td style={{ padding: '14px 16px', color: BLACK, fontWeight: 600 }}>{b.service_name}</td>
                                                    <td style={{ padding: '14px 16px', color: '#666' }}>{b.therapist}</td>
                                                </tr>
                                            ))}
                                        {allBookings.filter(b => b.client_name.toLowerCase() === selectedClient.client_name.toLowerCase()).length === 0 && (
                                            <tr><td colSpan={3} style={{ padding: '30px', textAlign: 'center', color: '#666', fontStyle: 'italic' }}>No historical bookings discovered.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── PIN SECURITY MODAL ── */}
            {showPinModal && (
                <div className="modal-overlay">
                    <div style={{ backgroundColor: '#F9F4EB', padding: 32, borderRadius: 16, width: '100%', maxWidth: 400, textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.3)', fontFamily: BODY }}>
                        <div style={{ width: 50, height: 50, borderRadius: '50%', backgroundColor: 'rgba(197,143,59,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        </div>
                        <h3 style={{ fontFamily: DSP, fontSize: 28, margin: '0 0 8px', color: BLACK }}>Action Locked</h3>
                        <p style={{ fontSize: 13, color: '#666', margin: '0 0 24px' }}>Please enter PIN to verify permissions.</p>

                        <form onSubmit={handlePinSubmit}>
                            <input
                                type="password"
                                maxLength={6}
                                value={pinInput}
                                onChange={e => setPinInput(e.target.value)}
                                placeholder="ENTER PIN"
                                autoFocus
                                style={{ width: '100%', height: 50, textAlign: 'center', fontSize: 20, letterSpacing: '0.3em', border: `1px solid ${pinError ? '#C83232' : 'rgba(26,26,26,0.2)'}`, borderRadius: 8, outline: 'none', marginBottom: 12, backgroundColor: WHITE, color: BLACK, fontWeight: 800 }}
                            />
                            {pinError && <p style={{ color: '#C83232', fontSize: 11, margin: '0 0 12px', fontWeight: 600 }}>INCORRECT PIN</p>}

                            <div style={{ display: 'flex', gap: 12 }}>
                                <button type="button" onClick={() => { setShowPinModal(false); setPendingAction(null); }} style={{ flex: 1, height: 44, backgroundColor: 'transparent', border: '1px solid rgba(26,26,26,0.2)', borderRadius: 8, color: BLACK, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" disabled={!pinInput} style={{ flex: 1, height: 44, backgroundColor: BLACK, color: GOLD, border: 'none', borderRadius: 8, fontWeight: 600, cursor: pinInput ? 'pointer' : 'not-allowed' }}>Authorize</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── ADD/EDIT MODAL ── */}
            {showModal && (
                <div className="modal-overlay">
                    <div style={{ width: '100%', maxWidth: 600, backgroundColor: '#F9F4EB', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.3)', fontFamily: BODY, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ height: 4, backgroundColor: GOLD }} />

                        <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid rgba(26,26,26,0.1)' }}>
                            <h3 style={{ fontFamily: DSP, fontSize: 28, margin: 0, color: BLACK }}>
                                {editingId ? 'Edit Membership' : 'Register New Member'}
                            </h3>
                        </div>

                        <div style={{ padding: '24px', overflowY: 'auto' }}>
                            <form id="membershipForm" onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label className="m-label">Client Full Name *</label>
                                        <input type="text" className="m-input" required value={formData.client_name} onChange={e => setFormData({ ...formData, client_name: e.target.value })} placeholder="e.g. Maria Santos" autoFocus />
                                    </div>
                                    <div>
                                        <label className="m-label">Mobile Number</label>
                                        <input type="text" className="m-input" value={formData.client_mobile} onChange={e => setFormData({ ...formData, client_mobile: e.target.value })} placeholder="09XX XXX XXXX" />
                                    </div>
                                    <div>
                                        <label className="m-label">Email Address</label>
                                        <input type="email" className="m-input" value={formData.client_email} onChange={e => setFormData({ ...formData, client_email: e.target.value })} placeholder="maria@example.com" />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, backgroundColor: WHITE, padding: 16, borderRadius: 12, border: '1px solid rgba(26,26,26,0.1)' }}>
                                    <div>
                                        <label className="m-label">Tier</label>
                                        <select className="m-input" value={formData.membership_tier} onChange={handleTierChange} style={{ backgroundColor: WHITE }}>
                                            <option value="VIP">VIP</option>
                                            <option value="Platinum">Platinum</option>
                                            <option value="Gold">Gold</option>
                                            <option value="Basic">Basic</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="m-label">Discount (%)</label>
                                        <input type="number" className="m-input" value={formData.discount_percentage} onChange={e => setFormData({ ...formData, discount_percentage: Number(e.target.value) })} />
                                    </div>
                                    <div>
                                        <label className="m-label">Status</label>
                                        <select className="m-input" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} style={{ backgroundColor: WHITE }}>
                                            <option value="Active">Active</option>
                                            <option value="Expired">Expired</option>
                                            <option value="Cancelled">Cancelled</option>
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div>
                                        <label className="m-label">Valid Until</label>
                                        <input type="date" className="m-input" value={formData.valid_until} onChange={e => setFormData({ ...formData, valid_until: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="m-label">Remaining Massages</label>
                                        <input type="text" className="m-input" value={formData.remaining_massages} onChange={e => setFormData({ ...formData, remaining_massages: e.target.value })} placeholder="e.g. 6 or Unlimited" />
                                    </div>
                                </div>

                                <div>
                                    <label className="m-label">Package Inclusions / Notes</label>
                                    <textarea className="m-input" value={formData.package_inclusions} onChange={e => setFormData({ ...formData, package_inclusions: e.target.value })} placeholder="List specific inclusions or exceptions here..." style={{ height: 80, resize: 'vertical', paddingTop: 12 }} />
                                </div>
                            </form>
                        </div>

                        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(26,26,26,0.1)', display: 'flex', gap: 12, backgroundColor: '#FDFCF8' }}>
                            <button type="button" onClick={() => setShowModal(false)} disabled={isSubmitting} style={{ flex: 1, height: 44, backgroundColor: 'transparent', border: '1px solid rgba(26,26,26,0.2)', borderRadius: 8, color: BLACK, fontWeight: 600, cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button type="submit" form="membershipForm" disabled={isSubmitting || !formData.client_name.trim()} style={{ flex: 1, height: 44, backgroundColor: BLACK, border: 'none', borderRadius: 8, color: GOLD, fontWeight: 700, cursor: isSubmitting || !formData.client_name.trim() ? 'not-allowed' : 'pointer' }}>
                                {isSubmitting ? 'Saving...' : 'Save Membership'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MAIN PAGE UI ── */}
            <div style={{ backgroundColor: BG, minHeight: '100vh', padding: 'clamp(12px, 3vw, 30px)', fontFamily: BODY, width: '100%', boxSizing: 'border-box' }}>
                <div style={{ maxWidth: '100%', margin: '0 auto' }}>

                    {/* Header */}
                    <div style={{ borderBottom: '1px solid rgba(197,143,59,0.2)', paddingBottom: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD, margin: '0 0 5px' }}>Client Relations</p>
                            <h1 style={{ fontFamily: DSP, fontSize: 32, fontWeight: 300, color: BLACK, margin: 0 }}>Membership Directory</h1>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={fetchMembershipsAndBookings} style={{ padding: '0 16px', height: 38, border: `1px solid rgba(197,143,59,0.45)`, borderRadius: 9, backgroundColor: 'transparent', color: GOLD, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                Refresh Data
                            </button>
                            <button onClick={() => executeProtectedAction(handleOpenAdd)} style={{ padding: '0 16px', height: 38, border: 'none', borderRadius: 9, backgroundColor: BLACK, color: GOLD, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>
                                + Add Membership
                            </button>
                        </div>
                    </div>

                    {/* Stat Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                        <div style={{ backgroundColor: WHITE, border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 8px' }}>Total Members</p>
                            <p style={{ fontSize: 28, fontWeight: 700, color: BLACK, margin: 0 }}>{memberships.length}</p>
                        </div>
                        <div style={{ backgroundColor: WHITE, border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#3D7A4A', margin: '0 0 8px' }}>Active Memberships</p>
                            <p style={{ fontSize: 28, fontWeight: 700, color: BLACK, margin: 0 }}>{memberships.filter(m => m.status === 'Active').length}</p>
                        </div>

                        {/* UPGRADED: Tiers Breakdown Card */}
                        <div style={{ backgroundColor: WHITE, border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: GOLD, margin: '0 0 8px' }}>Memberships by Tier</p>
                            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div><span style={{ fontSize: 24, fontWeight: 700, color: BLACK }}>{memberships.filter(m => m.membership_tier === 'VIP').length}</span> <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>VIP</span></div>
                                <div><span style={{ fontSize: 24, fontWeight: 700, color: BLACK }}>{memberships.filter(m => m.membership_tier === 'Platinum').length}</span> <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>Platinum</span></div>
                                <div><span style={{ fontSize: 24, fontWeight: 700, color: BLACK }}>{memberships.filter(m => m.membership_tier === 'Gold').length}</span> <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>Gold</span></div>
                                <div><span style={{ fontSize: 24, fontWeight: 700, color: BLACK }}>{memberships.filter(m => m.membership_tier === 'Basic').length}</span> <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>Basic</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Data Table */}
                    <div style={{ backgroundColor: WHITE, border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)', backgroundColor: '#F8F4EE' }}>
                                        <th style={{ padding: '14px 20px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: GOLD, whiteSpace: 'nowrap' }}>Client Profile</th>
                                        <th style={{ padding: '14px 20px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: GOLD, whiteSpace: 'nowrap' }}>Tier & Discount</th>
                                        <th style={{ padding: '14px 20px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: GOLD, whiteSpace: 'nowrap' }}>Status</th>
                                        <th style={{ padding: '14px 20px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: GOLD, whiteSpace: 'nowrap' }}>Valid Until</th>
                                        <th style={{ padding: '14px 20px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: GOLD }}>Remaining Balance</th>
                                        <th style={{ padding: '14px 20px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: GOLD, textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#666', fontStyle: 'italic' }}>Fetching membership & booking records...</td></tr>
                                    ) : memberships.length === 0 ? (
                                        <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No memberships recorded yet.</td></tr>
                                    ) : (
                                        memberships.map((m) => {
                                            const statStyle = getStatusColor(m.status);
                                            return (
                                                <tr key={m.id} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                                                    <td style={{ padding: '16px 20px' }}>
                                                        <div
                                                            className="client-name-link"
                                                            onClick={() => setSelectedClient(m)}
                                                            style={{ fontWeight: 700, color: '#1A1A1A', fontSize: 14, marginBottom: 2, display: 'inline-block' }}
                                                            title="View Client History"
                                                        >
                                                            {m.client_name}
                                                        </div>
                                                        <div style={{ fontSize: 11, color: '#666' }}>{m.client_mobile || m.client_email || 'No contact info'}</div>
                                                    </td>
                                                    <td style={{ padding: '16px 20px' }}>
                                                        <div style={{ fontWeight: 700, color: m.membership_tier === 'VIP' ? GOLD : BLACK }}>{m.membership_tier}</div>
                                                        <div style={{ fontSize: 11, color: '#666' }}>{m.discount_percentage}% OFF</div>
                                                    </td>
                                                    <td style={{ padding: '16px 20px' }}>
                                                        <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 99, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: statStyle.bg, color: statStyle.color }}>
                                                            {m.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '16px 20px', color: BLACK, fontWeight: 600 }}>
                                                        {formatDate(m.valid_until)}
                                                    </td>

                                                    {/* UPGRADED: Dynamic Remaining Balance Subtraction Logic handling Unlimited Tiers */}
                                                    <td style={{ padding: '16px 20px', color: BLACK, fontSize: 12 }}>
                                                        {(() => {
                                                            const parsedBase = parseInt(m.remaining_massages);
                                                            const memCreatedDate = new Date(m.created_at);
                                                            const consumed = allBookings.filter(b =>
                                                                b.client_name.toLowerCase() === m.client_name.toLowerCase() &&
                                                                new Date(b.created_at) >= memCreatedDate &&
                                                                isServiceIncluded(b.service_name, m.package_inclusions)
                                                            ).length;

                                                            if (!isNaN(parsedBase) && parsedBase > 0) {
                                                                const dynamicBalance = Math.max(0, parsedBase - consumed);
                                                                return (
                                                                    <div>
                                                                        <div style={{ fontWeight: 800, fontSize: 16, color: dynamicBalance > 0 ? '#3D7A4A' : '#C83232' }}>
                                                                            {dynamicBalance} <span style={{ fontSize: 11, fontWeight: 600, color: '#666' }}>left</span>
                                                                        </div>
                                                                        <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>Base: {parsedBase} | Consumed: {consumed}</div>
                                                                    </div>
                                                                )
                                                            } else if (m.remaining_massages?.toLowerCase() === 'unlimited') {
                                                                return (
                                                                    <div>
                                                                        <div style={{ fontWeight: 800, fontSize: 16, color: '#3D7A4A' }}>
                                                                            Unlimited
                                                                        </div>
                                                                        <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>Consumed: {consumed}</div>
                                                                    </div>
                                                                )
                                                            }
                                                            return m.remaining_massages || '—';
                                                        })()}
                                                        <div style={{ fontSize: 10, color: GOLD, marginTop: 6, maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.package_inclusions}>
                                                            {m.package_inclusions}
                                                        </div>
                                                    </td>

                                                    <td style={{ padding: '16px 20px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                                                        <button onClick={() => executeProtectedAction(() => handleOpenEdit(m))} style={{ background: 'none', border: 'none', color: BLACK, fontSize: 11, fontWeight: 700, cursor: 'pointer', marginRight: 16, textTransform: 'uppercase', textDecoration: 'underline', textDecorationColor: 'rgba(197,143,59,0.5)', textUnderlineOffset: 4 }}>Edit</button>
                                                        <button onClick={() => executeProtectedAction(() => handleDelete(m.id, m.client_name))} style={{ background: 'none', border: 'none', color: '#C83232', fontSize: 11, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>Delete</button>
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
            </div>
        </>
    )
}