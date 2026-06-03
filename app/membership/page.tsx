'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────
const BG = '#F9F4EB'
const BLACK = '#1A1A1A'
const GOLD = '#C58F3B'
const WHITE = '#FFFFFF'
const BODY = "'Inter', system-ui, sans-serif"
const DSP = "'Cormorant Garamond', Georgia, serif"

const INPUT: React.CSSProperties = {
    display: 'block', width: '100%', height: 54,
    padding: '0 15px', backgroundColor: WHITE,
    border: '1px solid rgba(26,26,26,0.14)',
    borderRadius: 10, fontSize: 16, color: BLACK,
    fontFamily: BODY, outline: 'none',
    transition: 'all 180ms ease',
}

const LABEL: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700,
    letterSpacing: '0.13em', textTransform: 'uppercase',
    color: 'rgba(26,26,26,0.50)', marginBottom: 7, fontFamily: BODY,
}

// ─── DATE CALCULATOR ───
function calculateExpiryDate(monthsToAdd: number): string {
    const d = new Date();
    d.setMonth(d.getMonth() + monthsToAdd);
    return d.toISOString().split('T')[0];
}

function formatDateDisplay(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function MembershipPortal() {
    const supabaseRef = useRef<SupabaseClient | null>(null)
    if (!supabaseRef.current) {
        supabaseRef.current = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
    }
    const supabase = supabaseRef.current

    // ─── LIVE DATABASE DISCOUNTS ───
    const [dbDiscounts, setDbDiscounts] = useState<Record<string, number>>({})

    useEffect(() => {
        async function fetchOfficialDiscounts() {
            const { data } = await supabase.from('discounts').select('name, discount_percentage')
            if (data) {
                const mapping: Record<string, number> = {}
                data.forEach(d => {
                    if (d.name) mapping[d.name.toUpperCase()] = Number(d.discount_percentage)
                })
                setDbDiscounts(mapping)
            }
        }
        fetchOfficialDiscounts()
    }, [supabase])

    // ─────────────────────────────────────────────────────────────
    // DYNAMIC PACKAGES (Fallback to promo image values if DB is loading)
    // ─────────────────────────────────────────────────────────────
    const TIERS = [
        {
            id: 'BASIC', name: 'BASIC', price: '₱3,000/ month', months: 1, massages: '6',
            discount: dbDiscounts['BASIC'] !== undefined ? dbDiscounts['BASIC'] : 5,
            desc: '6 Regular Massages + 5% Off Nail Services',
            savings: 'Value: ₱3,600 | You Save: ₱600'
        },
        {
            id: 'GOLD', name: 'GOLD', price: '₱10,000 / 3 months', months: 3, massages: '20',
            discount: dbDiscounts['GOLD'] !== undefined ? dbDiscounts['GOLD'] : 5,
            desc: '20 Regular Massages (Valid for 3 Months) + 5% Off Nail Services',
            savings: 'Value: ₱12,000 | You Save: ₱2,000'
        },
        {
            id: 'PLATINUM', name: 'PLATINUM', price: '₱18,000/ 6 MONTHS', months: 6, massages: 'Unlimited',
            discount: dbDiscounts['PLATINUM'] !== undefined ? dbDiscounts['PLATINUM'] : 10,
            desc: 'Unlimited Daily Massage + 10% Off Nails, 1 Free Private Suite & Coffee/Tea + Meals',
            savings: 'Value: ₱36,000 | You Save: ₱25,500'
        },
        {
            id: 'VIP', name: 'VIP', price: '₱36,000/ 12 months', months: 12, massages: 'Unlimited',
            discount: dbDiscounts['VIP'] !== undefined ? dbDiscounts['VIP'] : 10,
            desc: 'Unlimited Daily Massage + 10% Off Nails & Wet Floor, 4 Wet Floor Sessions, Coffee/Tea + Meals',
            savings: 'Total Value: ₱127,000 | You Save: ₱91,000'
        }
    ]

    const [selectedTier, setSelectedTier] = useState<string>('')
    const [name, setName] = useState('')
    const [mobile, setMobile] = useState('')
    const [email, setEmail] = useState('')
    const [address, setAddress] = useState('')

    const [showModal, setShowModal] = useState(false)
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const isValid = selectedTier !== '' && name.length > 2 && mobile.length > 7 && email.includes('@') && address.length > 5
    const activePackage = TIERS.find(t => t.id === selectedTier)

    function handleFormSubmit(e: FormEvent) {
        e.preventDefault()
        if (!isValid) return
        setShowModal(true)
    }

    async function executeTransaction() {
        setLoading(true)
        setError(null)

        const transactionId = crypto.randomUUID()
        const validUntilDate = calculateExpiryDate(activePackage?.months || 1)

        try {
            const { error: dbErr } = await supabase.from('memberships').insert({
                id: transactionId,
                client_name: name.trim(),
                client_mobile: mobile.trim(),
                client_email: email.trim(),
                client_address: address.trim(),
                membership_tier: selectedTier,
                discount_percentage: activePackage?.discount || 0, // DYNAMICALLY PULLED FROM DISCOUNTS TABLE!
                package_inclusions: activePackage?.desc,
                remaining_massages: activePackage?.massages,
                valid_until: validUntilDate,
                status: 'Active'
            })

            if (dbErr) throw new Error(dbErr.message)

            setShowModal(false)
            setSubmitted(true)

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transaction failed. Check database connection.')
            setShowModal(false)
        } finally {
            setLoading(false)
        }
    }

    if (submitted) return (
        <div style={{ backgroundColor: BG, minHeight: '100dvh', padding: '100px 20px', textAlign: 'center', fontFamily: BODY }}>
            <div style={{ fontSize: 44, color: GOLD, margin: '0 auto 22px', width: 70, height: 70, borderRadius: '50%', backgroundColor: 'rgba(197,143,59,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>
            <h2 style={{ fontFamily: DSP, fontSize: 40, color: BLACK, margin: '0 0 14px' }}>Membership Activated</h2>
            <p style={{ color: 'rgba(26,26,26,0.7)', fontSize: 16, maxWidth: 450, margin: '0 auto 24px', lineHeight: 1.6 }}>
                Congratulations, <strong style={{ color: BLACK }}>{name}</strong>! You are officially a <strong style={{ color: GOLD }}>{selectedTier}</strong> member.
            </p>
            <div style={{ backgroundColor: WHITE, border: '1px solid rgba(197,143,59,0.3)', borderRadius: 16, padding: '24px', maxWidth: 450, margin: '0 auto 32px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <p style={{ fontSize: 14, color: BLACK, fontWeight: 600, margin: 0 }}>
                    Your <strong style={{ color: GOLD }}>{activePackage?.discount}% OFF</strong> discount is now officially linked to your profile in the database.
                </p>
            </div>
            <button onClick={() => window.location.reload()} style={{ height: 50, padding: '0 32px', backgroundColor: '#1A1A1A', color: GOLD, border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Register Another Member
            </button>
        </div>
    )

    return (
        <>
            {showModal && activePackage && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 999, backgroundColor: 'rgba(10,8,6,0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div style={{ backgroundColor: '#F9F4EB', width: '100%', maxWidth: 500, borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.3)', fontFamily: BODY }}>
                        <div style={{ height: 5, backgroundColor: GOLD }} />
                        <div style={{ padding: '32px' }}>
                            <h2 style={{ fontFamily: DSP, fontSize: 32, color: BLACK, margin: '0 0 8px', lineHeight: 1.1 }}>Acknowledge & Confirm</h2>
                            <p style={{ fontSize: 14, color: '#666', margin: '0 0 24px', lineHeight: 1.5 }}>Please clarify the exact package inclusions and validity dates with the client before finalizing the transaction.</p>

                            <div style={{ backgroundColor: WHITE, border: '1px solid rgba(197,143,59,0.3)', borderRadius: 12, padding: '20px', marginBottom: 24 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{activePackage.name} MEMBERSHIP</span>
                                    <span style={{ fontSize: 16, fontWeight: 700, color: BLACK }}>{activePackage.price}</span>
                                </div>

                                <div style={{ height: 1, backgroundColor: 'rgba(26,26,26,0.05)', margin: '12px 0' }} />

                                <p style={{ fontSize: 13, color: BLACK, margin: '0 0 8px', fontWeight: 600 }}>Package Inclusions:</p>
                                <p style={{ fontSize: 13, color: '#666', margin: '0 0 16px', lineHeight: 1.5 }}>{activePackage.desc}</p>

                                <div style={{ backgroundColor: 'rgba(61,122,74,0.08)', border: '1px solid rgba(61,122,74,0.2)', padding: '12px', borderRadius: 8 }}>
                                    <p style={{ fontSize: 11, fontWeight: 700, color: '#3D7A4A', textTransform: 'uppercase', margin: '0 0 4px' }}>System Logic Check:</p>
                                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#2A2A2A', lineHeight: 1.6 }}>
                                        <li><strong>Remaining Massages:</strong> {activePackage.massages}</li>
                                        <li><strong>Date of Validity:</strong> {formatDateDisplay(calculateExpiryDate(activePackage.months))}</li>
                                        <li><strong>Backend Discount Linked:</strong> {activePackage.discount}% OFF</li>
                                    </ul>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 12 }}>
                                <button onClick={() => setShowModal(false)} disabled={loading} style={{ flex: 1, height: 48, backgroundColor: 'transparent', border: '1px solid rgba(26,26,26,0.2)', borderRadius: 8, color: '#1A1A1A', fontWeight: 700, textTransform: 'uppercase', fontSize: 12, cursor: loading ? 'not-allowed' : 'pointer' }}>
                                    Decline / Cancel
                                </button>
                                <button onClick={executeTransaction} disabled={loading} style={{ flex: 1, height: 48, backgroundColor: '#1A1A1A', border: 'none', borderRadius: 8, color: GOLD, fontWeight: 700, textTransform: 'uppercase', fontSize: 12, cursor: loading ? 'not-allowed' : 'pointer', transition: 'opacity 200ms ease', opacity: loading ? 0.6 : 1 }}>
                                    {loading ? 'Processing...' : 'Confirm Transaction'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── MAIN PAGE UI ─── */}
            <div style={{ backgroundColor: BG, minHeight: '100dvh', padding: '60px 20px', fontFamily: BODY }}>
                <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>

                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.20em', color: GOLD, margin: '0 0 10px', textTransform: 'uppercase' }}>Join the Elite</p>
                        <h1 style={{ fontFamily: DSP, fontSize: 44, color: BLACK, margin: '0 0 8px', lineHeight: 1.1 }}>Sabbath Spa Membership</h1>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 24px' }}>CHOOSE FROM: SWEDISH, SHIATSU, FOOT REFLEXOLOGY</p>
                    </div>

                    <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

                        {/* TIER SELECTION */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {TIERS.map(t => {
                                const sel = selectedTier === t.id
                                return (
                                    <div key={t.id} onClick={() => setSelectedTier(t.id)} style={{ padding: '24px', backgroundColor: WHITE, border: `2px solid ${sel ? GOLD : 'rgba(26,26,26,0.08)'}`, borderRadius: 16, cursor: 'pointer', transition: 'all 200ms ease', position: 'relative', boxShadow: sel ? '0 8px 24px rgba(197,143,59,0.15)' : 'none' }}>
                                        {sel && <div style={{ position: 'absolute', top: 16, right: 16, width: 20, height: 20, borderRadius: '50%', backgroundColor: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1A1A1A', fontSize: 12, fontWeight: 'bold' }}>✓</div>}

                                        <h3 style={{ fontFamily: DSP, fontSize: 24, margin: '0 0 4px', color: sel ? GOLD : BLACK }}>{t.name} - {t.price}</h3>
                                        <p style={{ fontSize: 14, fontWeight: 600, color: BLACK, margin: '0 0 8px', lineHeight: 1.4 }}>{t.desc}</p>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <div style={{ display: 'inline-block', padding: '6px 12px', backgroundColor: 'rgba(197,143,59,0.1)', color: GOLD, fontSize: 11, fontWeight: 700, borderRadius: 6 }}>{t.savings}</div>
                                            {sel && <div style={{ display: 'inline-block', padding: '6px 12px', backgroundColor: '#1A1A1A', color: WHITE, fontSize: 11, fontWeight: 700, borderRadius: 6 }}>{t.discount}% OFF SECURED</div>}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* CLIENT DETAILS */}
                        <div style={{ backgroundColor: WHITE, padding: '32px', borderRadius: 16, border: '1px solid rgba(26,26,26,0.09)' }}>
                            <h2 style={{ fontFamily: DSP, fontSize: 24, color: BLACK, margin: '0 0 24px' }}>Client Details</h2>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 20 }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label style={LABEL}>Full Name *</label>
                                    <input style={INPUT} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Maria Santos" required />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label style={LABEL}>Mobile Number *</label>
                                    <input style={INPUT} type="tel" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="09XX XXX XXXX" required />
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 20 }}>
                                <label style={LABEL}>Email Address *</label>
                                <input style={INPUT} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="maria@example.com" required />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <label style={LABEL}>Complete Address *</label>
                                <input style={INPUT} value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Wellness Ave, City" required />
                            </div>
                        </div>

                        {error && (
                            <div style={{ padding: 14, backgroundColor: 'rgba(139,58,58,0.08)', border: '1px solid rgba(139,58,58,0.2)', borderRadius: 8, color: '#8B3A3A', fontSize: 14, textAlign: 'center' }}>
                                {error}
                            </div>
                        )}

                        <button type="submit" disabled={!isValid} style={{ height: 60, width: '100%', backgroundColor: BLACK, color: GOLD, border: '1px solid rgba(197,143,59,0.35)', borderRadius: 12, fontSize: 14, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: !isValid ? 'not-allowed' : 'pointer', opacity: !isValid ? 0.5 : 1, transition: 'opacity 200ms ease' }}>
                            {selectedTier ? `Review ${selectedTier} Details` : 'Select a Package'}
                        </button>

                    </form>
                </div>
            </div>
        </>
    )
}