'use client'

// app/dashboard/staff/page.tsx
// Staff Management — live Supabase therapists table
// · Fixed: select('*') for unbreakable database mapping
// · Fixed: Shift defaults to 11 AM - 1 AM and is fully editable on the cards
// · Fixed: Session Cookie bug via createBrowserClient

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { type SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type StaffStatus = 'Available' | 'In Session' | 'Off Duty'

interface Therapist {
    id: string
    name: string
    status: StaffStatus
    shift: string
}

// ─────────────────────────────────────────────────────────────
// STATUS CONFIG
// ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<StaffStatus, {
    color: string   // dot + text
    bg: string   // chip background
    border: string
    label: string
}> = {
    'Available': { color: '#3D7A4A', bg: 'rgba(61,122,74,0.13)', border: 'rgba(61,122,74,0.30)', label: 'Available' },
    'In Session': { color: '#C58F3B', bg: 'rgba(197,143,59,0.14)', border: 'rgba(197,143,59,0.38)', label: 'In Session' },
    'Off Duty': { color: '#7A6A50', bg: 'rgba(122,106,80,0.11)', border: 'rgba(122,106,80,0.28)', label: 'Off Duty' },
}

const ALL_STATUSES: StaffStatus[] = ['Available', 'In Session', 'Off Duty']

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const FONT_BODY = "'Inter', system-ui, sans-serif"
const FONT_DISPLAY = "'Cormorant Garamond', Georgia, serif"

const GOLD = '#C58F3B'
const BLACK = '#1A1A1A'
const WHITE = '#FFFFFF'
const BEIGE = '#F9F4EB'

function initials(name: string) {
    return name
        .split(' ')
        .map(w => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || '?'
}

const AVATAR_PALETTE = [
    '#3D7A4A', '#2A6A8A', '#A07530', '#6A3D7A', '#7A3D40',
    '#3D5A7A', '#6E7A3D', '#7A4E3D', '#3D7A6A', '#4E3D7A',
]
function avatarColor(name: string) {
    const code = (name.charCodeAt(0) ?? 65) - 65
    return AVATAR_PALETTE[Math.abs(code) % AVATAR_PALETTE.length]
}

// ─────────────────────────────────────────────────────────────
// STATUS DOT
// ─────────────────────────────────────────────────────────────
function StatusDot({ status }: { status: StaffStatus }) {
    const cfg = STATUS_CFG[status] || STATUS_CFG['Available']
    return (
        <span style={{
            display: 'inline-block',
            width: 8, height: 8,
            borderRadius: '50%',
            backgroundColor: cfg.color,
            flexShrink: 0,
            boxShadow: `0 0 0 2px ${cfg.bg}`,
        }} />
    )
}

// ─────────────────────────────────────────────────────────────
// SKELETON  (shown while fetching)
// ─────────────────────────────────────────────────────────────
function CardSkeleton() {
    return (
        <>
            <style>{`@keyframes sk{from{background-position:-200% center}to{background-position:200% center}}`}</style>
            <div style={{
                backgroundColor: WHITE, border: '1px solid rgba(26,26,26,0.09)',
                borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16,
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
            }}>
                {[80, 120, 60, 100].map((w, i) => (
                    <div key={i} style={{
                        height: i === 0 ? 40 : 12, width: `${w}%`, borderRadius: 8,
                        background: 'linear-gradient(90deg,#EDE8E0 0%,#E0D8CE 50%,#EDE8E0 100%)',
                        backgroundSize: '200% 100%', animation: 'sk 1.6s linear infinite',
                    }} />
                ))}
            </div>
        </>
    )
}

// ─────────────────────────────────────────────────────────────
// ADD THERAPIST MODAL
// ─────────────────────────────────────────────────────────────
interface AddModalProps {
    onClose: () => void
    onSaved: (t: Therapist) => void
}

function AddTherapistModal({ onClose, onSaved }: AddModalProps) {
    const supabase = useRef(createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    )).current

    const [name, setName] = useState('')
    const [shift, setShift] = useState('11:00 AM - 1:00 AM') // Default set exactly to client request
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        document.addEventListener('keydown', h)
        return () => document.removeEventListener('keydown', h)
    }, [onClose])

    async function handleSave() {
        if (!name.trim()) { setError('Name is required.'); return }
        setLoading(true); setError(null)

        try {
            const { data, error: dbErr } = await supabase
                .from('therapists')
                .insert({ name: name.trim(), shift: shift.trim(), status: 'Available' })
                .select('*')
                .single()

            if (dbErr) throw new Error(dbErr.message)

            const newTherapist: Therapist = {
                id: String(data.id),
                name: String(data.name || data.therapist_name || 'Staff'),
                status: (data.status as StaffStatus) || 'Available',
                shift: String(data.shift || '11:00 AM - 1:00 AM')
            }

            onSaved(newTherapist)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save.')
        } finally {
            setLoading(false)
        }
    }

    const INPUT_S: React.CSSProperties = {
        display: 'block', width: '100%', height: 48,
        padding: '0 14px',
        backgroundColor: BEIGE, backgroundImage: 'none',
        border: '1px solid rgba(26,26,26,0.14)', borderRadius: 10,
        fontSize: 14, color: BLACK, fontFamily: FONT_BODY,
        appearance: 'none', WebkitAppearance: 'none',
        boxSizing: 'border-box', outline: 'none',
        transition: 'border-color 180ms ease, box-shadow 180ms ease',
    }

    return (
        <>
            <style>{`
        .add-input:focus { border-color:${GOLD} !important; box-shadow:0 0 0 3px rgba(197,143,59,0.18) !important; }
        .add-input:hover:not(:focus) { border-color:rgba(197,143,59,0.40) !important; }
        @keyframes modalIn { from{opacity:0;transform:translateY(18px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
        .add-modal { animation: modalIn 280ms cubic-bezier(0.22,1,0.36,1) both; }
      `}</style>

            <div
                onClick={e => { if (e.target === e.currentTarget) onClose() }}
                style={{
                    position: 'fixed', inset: 0, zIndex: 60,
                    backgroundColor: 'rgba(10,8,6,0.50)',
                    backdropFilter: 'blur(5px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px 16px',
                }}
                role="dialog" aria-modal="true" aria-label="Add new therapist"
            >
                <div className="add-modal" style={{
                    width: '100%', maxWidth: 420,
                    backgroundColor: BEIGE, backgroundImage: 'none',
                    borderRadius: 20, overflow: 'hidden',
                    boxShadow: '0 24px 60px rgba(0,0,0,0.28)',
                }}>
                    <div style={{ height: 3, backgroundColor: GOLD }} />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 24px 16px' }}>
                        <div>
                            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: GOLD, margin: '0 0 4px', fontFamily: FONT_BODY }}>
                                Add Therapist
                            </p>
                            <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 400, color: BLACK, margin: 0 }}>
                                New Staff Member
                            </h2>
                        </div>
                        <button onClick={onClose} style={{
                            width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(26,26,26,0.14)',
                            backgroundColor: 'transparent', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'rgba(26,26,26,0.40)', transition: 'all 150ms ease',
                        }}
                            onMouseEnter={e => { const el = e.currentTarget; el.style.backgroundColor = 'rgba(26,26,26,0.08)'; el.style.color = BLACK }}
                            onMouseLeave={e => { const el = e.currentTarget; el.style.backgroundColor = 'transparent'; el.style.color = 'rgba(26,26,26,0.40)' }}
                        >
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                                <path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                            </svg>
                        </button>
                    </div>

                    <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                        <div>
                            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#7A6E65', marginBottom: 7, fontFamily: FONT_BODY }}>
                                Full Name *
                            </label>
                            <input
                                className="add-input"
                                style={INPUT_S}
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Maria Santos"
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#7A6E65', marginBottom: 7, fontFamily: FONT_BODY }}>
                                Shift (Editable)
                            </label>
                            <input
                                className="add-input"
                                style={INPUT_S}
                                value={shift}
                                onChange={e => setShift(e.target.value)}
                                placeholder="11:00 AM - 1:00 AM"
                                onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                            />
                        </div>

                        {error && (
                            <div style={{ padding: '10px 14px', backgroundColor: 'rgba(139,58,58,0.10)', border: '1px solid rgba(139,58,58,0.28)', borderRadius: 8, fontSize: 13, color: '#8B3A3A', fontFamily: FONT_BODY }}>
                                {error}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                            <button
                                onClick={handleSave}
                                disabled={loading || !name.trim()}
                                style={{
                                    flex: 1, height: 48,
                                    backgroundColor: loading || !name.trim() ? '#3A3530' : BLACK,
                                    color: loading || !name.trim() ? 'rgba(243,233,224,0.38)' : GOLD,
                                    border: '1px solid rgba(197,143,59,0.35)', borderRadius: 10,
                                    fontSize: 12, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase',
                                    cursor: loading || !name.trim() ? 'not-allowed' : 'pointer',
                                    fontFamily: FONT_BODY, transition: 'background-color 180ms ease',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                }}
                            >
                                {loading ? (
                                    <>
                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 700ms linear infinite' }}>
                                            <circle cx="7" cy="7" r="5" stroke="rgba(197,143,59,0.28)" strokeWidth="2" />
                                            <path d="M7 2a5 5 0 0 1 5 5" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                        Saving…
                                    </>
                                ) : 'Save Therapist'}
                            </button>
                            <button
                                onClick={onClose}
                                style={{
                                    padding: '0 18px', height: 48,
                                    backgroundColor: 'transparent', color: 'rgba(26,26,26,0.45)',
                                    border: '1px solid rgba(26,26,26,0.15)', borderRadius: 10,
                                    fontSize: 12, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase',
                                    cursor: 'pointer', fontFamily: FONT_BODY,
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </>
    )
}

// ─────────────────────────────────────────────────────────────
// THERAPIST CARD
// ─────────────────────────────────────────────────────────────
interface CardProps {
    therapist: Therapist
    onStatusChange: (id: string, newStatus: StaffStatus) => Promise<void>
    onShiftChange: (id: string, newShift: string) => Promise<void>
}

function TherapistCard({ therapist, onStatusChange, onShiftChange }: CardProps) {
    const [saving, setSaving] = useState(false)
    const [localStatus, setLocalStatus] = useState<StaffStatus>(therapist.status)
    const [dropOpen, setDropOpen] = useState(false)
    const dropRef = useRef<HTMLDivElement>(null)
    const cfg = STATUS_CFG[localStatus] || STATUS_CFG['Available']

    const [isEditingShift, setIsEditingShift] = useState(false)
    const [localShift, setLocalShift] = useState(therapist.shift)

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false)
        }
        if (dropOpen) document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [dropOpen])

    async function handleStatusSelect(s: StaffStatus) {
        setDropOpen(false)
        if (s === localStatus) return
        setLocalStatus(s)
        setSaving(true)
        try {
            await onStatusChange(therapist.id, s)
        } catch {
            setLocalStatus(therapist.status)
        } finally {
            setSaving(false)
        }
    }

    async function handleSaveShift() {
        setIsEditingShift(false)
        if (localShift === therapist.shift) return
        setSaving(true)
        try {
            await onShiftChange(therapist.id, localShift)
        } catch {
            setLocalShift(therapist.shift)
        } finally {
            setSaving(false)
        }
    }

    const ac = avatarColor(therapist.name)

    return (
        <div style={{
            backgroundColor: WHITE, backgroundImage: 'none',
            border: '1px solid rgba(26,26,26,0.09)', borderRadius: 18,
            padding: '24px 22px',
            display: 'flex', flexDirection: 'column', gap: 18,
            boxShadow: '0 3px 14px rgba(0,0,0,0.06)',
            transition: 'box-shadow 220ms ease, border-color 220ms ease, transform 220ms ease',
            position: 'relative',
        }}
            onMouseEnter={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.boxShadow = '0 8px 28px rgba(0,0,0,0.10)'
                el.style.borderColor = 'rgba(197,143,59,0.28)'
                el.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.boxShadow = '0 3px 14px rgba(0,0,0,0.06)'
                el.style.borderColor = 'rgba(26,26,26,0.09)'
                el.style.transform = ''
            }}
        >
            {saving && (
                <div style={{
                    position: 'absolute', top: 14, right: 14,
                    width: 8, height: 8, borderRadius: '50%',
                    backgroundColor: GOLD, opacity: 0.7,
                    animation: 'pulse 900ms ease infinite',
                }} />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    backgroundColor: ac, color: WHITE,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 400, letterSpacing: '0.04em',
                    flexShrink: 0,
                    boxShadow: `0 0 0 3px ${ac}28`,
                }}>
                    {initials(therapist.name)}
                </div>
                <div style={{ overflow: 'hidden', flex: 1 }}>
                    <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 21, fontWeight: 400, color: BLACK, margin: '0 0 3px', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {therapist.name}
                    </h3>

                    {isEditingShift ? (
                        <input
                            autoFocus
                            value={localShift}
                            onChange={(e) => setLocalShift(e.target.value)}
                            onBlur={handleSaveShift}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveShift() }}
                            style={{ width: '100%', padding: '2px 6px', fontSize: 11, border: '1px solid #C58F3B', borderRadius: 4, outline: 'none', color: '#1A1A1A' }}
                        />
                    ) : (
                        <p
                            onClick={() => setIsEditingShift(true)}
                            title="Click to edit shift"
                            style={{ fontSize: 11, color: 'rgba(26,26,26,0.50)', margin: 0, letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: FONT_BODY, cursor: 'pointer', borderBottom: '1px dashed rgba(26,26,26,0.2)', display: 'inline-block' }}>
                            {therapist.shift || 'Shift not set'}
                        </p>
                    )}
                </div>
            </div>

            <div style={{ height: 1, backgroundColor: 'rgba(26,26,26,0.07)' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.35)', margin: 0, fontFamily: FONT_BODY }}>
                    Current Status
                </p>

                <div ref={dropRef} style={{ position: 'relative' }}>
                    <button
                        onClick={() => setDropOpen(v => !v)}
                        style={{
                            width: '100%', height: 42,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '0 14px',
                            backgroundColor: cfg.bg, backgroundImage: 'none',
                            border: `1.5px solid ${cfg.border}`, borderRadius: 10,
                            cursor: 'pointer', fontFamily: FONT_BODY,
                            transition: 'border-color 160ms ease, box-shadow 160ms ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 0 0 3px ${cfg.bg}`)}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                        aria-haspopup="listbox"
                        aria-expanded={dropOpen}
                    >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <StatusDot status={localStatus} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>
                                {cfg.label}
                            </span>
                        </span>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                            style={{ color: cfg.color, flexShrink: 0, transition: 'transform 200ms ease', transform: dropOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>

                    {dropOpen && (
                        <div
                            role="listbox"
                            style={{
                                position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                                backgroundColor: WHITE, backgroundImage: 'none',
                                border: '1px solid rgba(26,26,26,0.12)', borderRadius: 10,
                                boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
                                overflow: 'hidden', zIndex: 20,
                                animation: 'dropIn 180ms cubic-bezier(0.22,1,0.36,1)',
                            }}
                        >
                            <style>{`@keyframes dropIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
                            {ALL_STATUSES.map(s => {
                                const sc = STATUS_CFG[s]
                                const sel = s === localStatus
                                return (
                                    <button
                                        key={s}
                                        role="option"
                                        aria-selected={sel}
                                        onClick={() => handleStatusSelect(s)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            width: '100%', height: 42, padding: '0 14px',
                                            backgroundColor: sel ? sc.bg : 'transparent',
                                            border: 'none', cursor: 'pointer',
                                            borderBottom: '1px solid rgba(26,26,26,0.05)',
                                            fontFamily: FONT_BODY, fontSize: 13, fontWeight: sel ? 600 : 400,
                                            color: sel ? sc.color : '#3A3530',
                                            transition: 'background-color 140ms ease',
                                            textAlign: 'left',
                                        }}
                                        onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(26,26,26,0.04)' }}
                                        onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
                                    >
                                        <StatusDot status={s} />
                                        {sc.label}
                                        {sel && (
                                            <span style={{ marginLeft: 'auto', color: sc.color }}>
                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                                    <path d="M1.5 6l3 3 6-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default function StaffPage() {
    const supabase = useRef(createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    )).current

    const [therapists, setTherapists] = useState<Therapist[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showAdd, setShowAdd] = useState(false)
    const [filter, setFilter] = useState<StaffStatus | 'All'>('All')

    const loadTherapists = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const { data, error: dbErr } = await supabase
                .from('therapists')
                .select('*') // CRITICAL: Use select(*) so it never crashes if columns mismatch
                .order('name', { ascending: true })

            if (dbErr) throw new Error(dbErr.message)

            // Map the rows safely
            const mapped = (data || []).map(t => ({
                id: String(t.id),
                name: String(t.name || t.therapist_name || 'Staff'),
                status: (t.status as StaffStatus) || 'Available',
                shift: String(t.shift || '11:00 AM - 1:00 AM')
            }))

            setTherapists(mapped)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load staff.')
        } finally {
            setLoading(false)
        }
    }, [supabase])

    useEffect(() => { loadTherapists() }, [loadTherapists])

    const handleStatusChange = useCallback(async (id: string, newStatus: StaffStatus) => {
        const { error: dbErr } = await supabase
            .from('therapists')
            .update({ status: newStatus })
            .eq('id', id)

        if (dbErr) throw new Error(dbErr.message)
        setTherapists(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
    }, [supabase])

    const handleShiftChange = useCallback(async (id: string, newShift: string) => {
        const { error: dbErr } = await supabase
            .from('therapists')
            .update({ shift: newShift })
            .eq('id', id)

        if (dbErr) throw new Error(dbErr.message)
        setTherapists(prev => prev.map(t => t.id === id ? { ...t, shift: newShift } : t))
    }, [supabase])

    function handleNewTherapist(t: Therapist) {
        setTherapists(prev => [...prev, t].sort((a, b) => a.name.localeCompare(b.name)))
        setShowAdd(false)
    }

    const counts: Record<StaffStatus, number> = {
        'Available': therapists.filter(t => t.status === 'Available').length,
        'In Session': therapists.filter(t => t.status === 'In Session').length,
        'Off Duty': therapists.filter(t => t.status === 'Off Duty').length,
    }

    const visible = filter === 'All'
        ? therapists
        : therapists.filter(t => t.status === filter)

    return (
        <>
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

            {showAdd && (
                <AddTherapistModal
                    onClose={() => setShowAdd(false)}
                    onSaved={handleNewTherapist}
                />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 32, fontFamily: FONT_BODY }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD, margin: '0 0 5px' }}>
                            Team
                        </p>
                        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(1.8rem,3vw,2.5rem)', fontWeight: 300, color: BLACK, margin: 0, lineHeight: 1.1 }}>
                            Staff Management
                        </h2>
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                            onClick={loadTherapists}
                            disabled={loading}
                            style={{
                                padding: '0 16px', height: 42,
                                border: '1px solid rgba(197,143,59,0.40)', borderRadius: 10,
                                backgroundColor: 'transparent', color: GOLD,
                                fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
                                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: FONT_BODY,
                                display: 'flex', alignItems: 'center', gap: 7,
                                transition: 'background-color 160ms ease',
                            }}
                            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(197,143,59,0.09)' }}
                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'}
                        >
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
                                style={{ animation: loading ? 'spin 700ms linear infinite' : 'none', flexShrink: 0 }}>
                                <path d="M10.5 6a4.5 4.5 0 1 1-1.35-3.18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                <path d="M10.5 2.25V5.5H7.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Refresh
                        </button>

                        <button
                            onClick={() => setShowAdd(true)}
                            style={{
                                padding: '0 20px', height: 42,
                                backgroundColor: BLACK, backgroundImage: 'none',
                                color: GOLD,
                                border: '1px solid rgba(197,143,59,0.40)', borderRadius: 10,
                                fontSize: 12, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase',
                                cursor: 'pointer', fontFamily: FONT_BODY,
                                display: 'flex', alignItems: 'center', gap: 8,
                                transition: 'background-color 160ms ease',
                            }}
                            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2A2A2A'}
                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = BLACK}
                        >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                            Add New Therapist
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(160px,100%),1fr))', gap: 12 }}>
                    <div style={{ backgroundColor: WHITE, backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 2, backgroundColor: GOLD, opacity: 0.40, borderRadius: '0 0 2px 2px' }} />
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 6px' }}>Total Staff</p>
                        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 300, color: BLACK, margin: '0 0 2px', lineHeight: 1 }}>{therapists.length}</p>
                        <p style={{ fontSize: 11, color: '#9A8E85', margin: 0 }}>Registered</p>
                    </div>

                    {ALL_STATUSES.map(s => {
                        const sc = STATUS_CFG[s]
                        return (
                            <div key={s} style={{ backgroundColor: WHITE, backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'border-color 160ms ease' }}
                                onClick={() => setFilter(f => f === s ? 'All' : s)}
                                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = sc.border}
                                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(26,26,26,0.09)'}
                            >
                                <div style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 2, backgroundColor: sc.color, opacity: 0.55, borderRadius: '0 0 2px 2px' }} />
                                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: sc.color, margin: '0 0 6px' }}>
                                    {s}
                                </p>
                                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 300, color: BLACK, margin: '0 0 2px', lineHeight: 1 }}>{counts[s]}</p>
                                <p style={{ fontSize: 11, color: '#9A8E85', margin: 0 }}>
                                    {filter === s ? 'Filtered ×' : 'Tap to filter'}
                                </p>
                            </div>
                        )
                    })}
                </div>

                {filter !== 'All' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'rgba(26,26,26,0.45)', fontFamily: FONT_BODY }}>Showing:</span>
                        <button
                            onClick={() => setFilter('All')}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '4px 14px', borderRadius: 99,
                                backgroundColor: STATUS_CFG[filter].bg,
                                border: `1px solid ${STATUS_CFG[filter].border}`,
                                color: STATUS_CFG[filter].color,
                                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT_BODY,
                            }}
                        >
                            <StatusDot status={filter} />
                            {filter}
                            <span style={{ fontSize: 14, lineHeight: 1 }}>×</span>
                        </button>
                    </div>
                )}

                {error && (
                    <div style={{ padding: '14px 18px', backgroundColor: 'rgba(139,58,58,0.10)', border: '1px solid rgba(139,58,58,0.28)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M9 6v4M9 12h.01" stroke="#8B3A3A" strokeWidth="1.6" strokeLinecap="round" />
                            <path d="M7.61 2.5L1 14.5a1.5 1.5 0 0 0 1.29 2.25h13.42A1.5 1.5 0 0 0 17 14.5L10.39 2.5a1.5 1.5 0 0 0-2.78 0z" stroke="#8B3A3A" strokeWidth="1.4" />
                        </svg>
                        <span style={{ fontSize: 13, color: '#8B3A3A', fontFamily: FONT_BODY, flex: 1 }}>{error}</span>
                        <button onClick={loadTherapists} style={{ padding: '4px 14px', borderRadius: 7, backgroundColor: 'rgba(139,58,58,0.14)', border: '1px solid rgba(139,58,58,0.28)', color: '#8B3A3A', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT_BODY }}>
                            Retry
                        </button>
                    </div>
                )}

                {loading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(280px,100%),1fr))', gap: 16 }}>
                        {[1, 2, 3, 4, 5, 6].map(i => <CardSkeleton key={i} />)}
                    </div>
                ) : visible.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center', gap: 16 }}>
                        <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: 'rgba(197,143,59,0.10)', border: '1px solid rgba(197,143,59,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                                <circle cx="13" cy="9" r="4.5" stroke={GOLD} strokeWidth="1.6" />
                                <path d="M4 24v-1a9 9 0 0 1 18 0v1" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" />
                            </svg>
                        </div>
                        <div>
                            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 400, color: BLACK, margin: '0 0 6px' }}>
                                {filter === 'All' ? 'No staff yet' : `No ${filter} staff`}
                            </p>
                            <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.45)', margin: 0 }}>
                                {filter === 'All' ? 'Add your first therapist to get started.' : `All therapists have a different status right now.`}
                            </p>
                        </div>
                        {filter === 'All' && (
                            <button onClick={() => setShowAdd(true)} style={{ padding: '0 22px', height: 42, backgroundColor: BLACK, color: GOLD, border: '1px solid rgba(197,143,59,0.40)', borderRadius: 10, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: FONT_BODY }}>
                                + Add First Therapist
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(280px,100%),1fr))', gap: 16 }}>
                        {visible.map(t => (
                            <TherapistCard
                                key={t.id}
                                therapist={t}
                                onStatusChange={handleStatusChange}
                                onShiftChange={handleShiftChange}
                            />
                        ))}
                    </div>
                )}

            </div>
        </>
    )
}