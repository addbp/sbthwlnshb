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

const TEXT_FORMAT: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  fontFamily: BODY,
  color: BLACK,
}

const INPUT: React.CSSProperties = {
  display: 'block', width: '100%', height: 54,
  padding: '0 15px',
  backgroundColor: WHITE, backgroundImage: 'none',
  border: '1px solid rgba(26,26,26,0.14)',
  borderRadius: 10, fontSize: 16, color: BLACK,
  fontFamily: BODY, lineHeight: 1,
  boxSizing: 'border-box', outline: 'none',
  transition: 'border-color 180ms ease, box-shadow 180ms ease',
}

const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.13em', textTransform: 'uppercase',
  color: 'rgba(26,26,26,0.50)', marginBottom: 7, fontFamily: BODY,
}

// ─────────────────────────────────────────────────────────────
// ALL INTERACTIVE ZONES - PROFESSIONALLY CALIBRATED (UNTOUCHED)
// ─────────────────────────────────────────────────────────────
const INTERACTIVE_ZONES = [
  // --- FRONT BODY (Left half of image) ---
  { id: 'Neck & Cervical', top: '10%', left: '21%', width: '8%', height: '7%' },
  { id: 'Pectorals (Chest)', top: '19%', left: '15.5%', width: '19%', height: '11.5%' },
  { id: 'Biceps & Triceps (Arms)', top: '23%', left: '11%', width: '7%', height: '24%' },
  { id: 'Forearms & Hands', top: '48%', left: '4%', width: '8%', height: '20%' },

  // --- BACK BODY (Right half of image) ---
  { id: 'Trapezius (Upper Back)', top: '16%', left: '62.5%', width: '25%', height: '9%' },
  { id: 'Deltoids (Shoulders)', top: '18%', left: '55%', width: '12%', height: '11%' },
  { id: 'Lats & Rhomboids (Upper Back)', top: '25%', left: '62.5%', width: '25%', height: '14%' },
  { id: 'Lumbar (Lower Back)', top: '42%', left: '67.5%', width: '15%', height: '9%' },
  { id: 'Calves', top: '70%', left: '61.5%', width: '27%', height: '13%' },
  { id: 'Feet & Ankles', top: '88%', left: '66%', width: '18%', height: '7%' },
]

const HEALTH_CONDITIONS_LIST = [
  'Stress', 'High Blood Pressure', 'Heart Issues', 'Arthritis',
  'Diabetes', 'Epilepsy', 'Osteoporosis', 'Joint Swelling',
  'Numbness', 'Allergies', 'Pregnancy', 'Contagious Diseases',
  'Other', 'None of the above'
]

// ─────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────
function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <div style={{ backgroundColor: WHITE, border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, padding: 'clamp(20px,3vw,28px)', display: 'flex', flexDirection: 'column', gap: 18, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ paddingBottom: 14, borderBottom: '1px solid rgba(197,143,59,0.15)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 18, height: 2, backgroundColor: GOLD, display: 'inline-block', flexShrink: 0, borderRadius: 2 }} />
          <h2 style={{ fontFamily: DSP, fontSize: 21, fontWeight: 400, color: BLACK, margin: 0, lineHeight: 1 }}>{title}</h2>
        </div>
        {note && <span style={{ fontSize: 11, color: 'rgba(26,26,26,0.38)', fontFamily: BODY, fontStyle: 'italic' }}>{note}</span>}
      </div>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function WaiverPage() {
  const supabaseRef = useRef<SupabaseClient | null>(null)
  if (!supabaseRef.current) {
    supabaseRef.current = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  const supabase = supabaseRef.current

  const [name, setName] = useState('')
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set())
  const [selectedConditions, setSelectedConditions] = useState<Set<string>>(new Set())

  // New States for Acknowledgement & Signature
  const [agreed, setAgreed] = useState(false)
  const [signature, setSignature] = useState('')

  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Smart Search States
  const [clientDbNames, setClientDbNames] = useState<string[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  // Fetch client history for Smart Search
  useEffect(() => {
    async function fetchClientHistory() {
      try {
        const [liveRes, archiveRes] = await Promise.all([
          supabase.from('bookings').select('client_name'),
          supabase.from('bookings_import').select('client_name')
        ])
        const liveNames = liveRes.data ? liveRes.data.map(d => d.client_name) : []
        const archiveNames = archiveRes.data ? archiveRes.data.map(d => d.client_name) : []
        const combinedHistory = [...liveNames, ...archiveNames].filter(Boolean)
        const uniqueNames = Array.from(new Set(combinedHistory))
        setClientDbNames(uniqueNames)
      } catch (err) {
        console.error("Failed to load client history", err)
      }
    }
    fetchClientHistory()
  }, [supabase])

  const filteredNames = clientDbNames.filter(n => n.toLowerCase().includes(name.toLowerCase()) && n.toLowerCase() !== name.toLowerCase())
  const isReturningClient = clientDbNames.some(n => n.toLowerCase() === name.trim().toLowerCase())

  // ── TOGGLE FUNCTIONS ──
  const toggleArea = (id: string) => {
    setSelectedAreas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleCondition = (cond: string) => {
    setSelectedConditions(prev => {
      const next = new Set(prev)
      if (cond === 'None of the above') {
        return next.has('None of the above') ? new Set() : new Set(['None of the above'])
      }
      next.delete('None of the above')
      next.has(cond) ? next.delete(cond) : next.add(cond)
      return next
    })
  }

  // ── SUBMIT FUNCTION ──
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return alert("Please enter your full name.")
    if (!agreed) return alert("Please acknowledge and agree to the terms.")
    if (!signature.trim()) return alert("Please provide your digital signature.")

    setLoading(true)

    const areasArray = Array.from(selectedAreas).join(', ')
    const conditionsArray = Array.from(selectedConditions).join(', ')

    try {
      const { error } = await supabase.from('waivers').insert({
        client_name: name.trim(),
        focus_areas: areasArray || 'None',
        health_conditions: conditionsArray || 'None',
        signature: signature.trim(),
        terms_agreed: agreed,
        date_signed: new Date().toISOString()
      })

      if (error) throw new Error(error.message)
      setSubmitted(true)
    } catch (err: any) {
      alert("Submission failed: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) return (
    <div style={{ backgroundColor: BG, minHeight: '100dvh', padding: '100px 20px', textAlign: 'center', fontFamily: BODY }}>
      <div style={{ fontSize: 44, color: GOLD, margin: '0 auto 22px', width: 70, height: 70, borderRadius: '50%', backgroundColor: 'rgba(197,143,59,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>
      <h2 style={{ fontFamily: DSP, fontSize: 40, color: BLACK, margin: '0 0 14px' }}>Waiver Signed Successfully</h2>
      <p style={{ color: 'rgba(26,26,26,0.7)', fontSize: 16 }}>Thank you, {name}. Your signed waiver has been securely saved.</p>
    </div>
  )

  return (
    <>
      <style>{`
        .wv-in:focus{border-color:${GOLD}!important;box-shadow:0 0 0 3px rgba(197,143,59,0.18)!important;}
        .wv-in:hover:not(:focus){border-color:rgba(197,143,59,0.45)!important;}
        .dropdown-item:hover { background-color: rgba(197,143,59,0.08); color: ${GOLD}; }
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600&display=swap');
      `}</style>

      <div style={{ backgroundColor: BG, minHeight: '100dvh', padding: '40px 20px', fontFamily: BODY }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.20em', color: GOLD, margin: '0 0 10px', textTransform: 'uppercase' }}>Client Consent</p>
            <h1 style={{ fontFamily: DSP, fontSize: 40, color: BLACK, margin: '0 0 8px', lineHeight: 1.1 }}>Digital Intake & Waiver</h1>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* ── CLIENT DETAILS ── */}
            <Section title="Client Details">
              <div>
                <label style={LABEL}>Full Name *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="wv-in"
                    style={INPUT}
                    value={name}
                    onChange={e => { setName(e.target.value); setShowDropdown(true) }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    placeholder="Search or enter your full name"
                    required
                    autoComplete="off"
                  />
                  {name.trim().length > 1 && (
                    <div style={{ position: 'absolute', right: 15, top: '50%', transform: 'translateY(-50%)', backgroundColor: isReturningClient ? 'rgba(197,143,59,0.15)' : 'rgba(46, 125, 50, 0.1)', color: isReturningClient ? GOLD : '#2e7d32', padding: '6px 10px', borderRadius: 6, fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      {isReturningClient ? 'Returning Client' : 'New Client'}
                    </div>
                  )}
                  {showDropdown && name.trim().length > 0 && filteredNames.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: WHITE, border: '1px solid rgba(197,143,59,0.3)', borderRadius: 10, marginTop: 6, maxHeight: 180, overflowY: 'auto', zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                      {filteredNames.map(n => (
                        <div key={n} className="dropdown-item" onClick={() => { setName(n); setShowDropdown(false); }} style={{ padding: '14px 15px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5', fontSize: 14, fontWeight: 500, fontFamily: BODY }}>
                          {n}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Section>

            {/* ── BODY MAP SECTION (UNTOUCHED) ── */}
            <Section title="Body Focus Areas" note="Tap directly on the specific muscular zones">
              <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: '1 1 400px', position: 'relative', width: '100%', maxWidth: 500, margin: '0 auto', backgroundColor: '#FAFAFA', border: '1px solid #EAEAEA', borderRadius: 16, overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
                  <img src="/muscular-body.png" alt="Muscular Anatomy" style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }} />
                  {INTERACTIVE_ZONES.map((zone) => {
                    const isSelected = selectedAreas.has(zone.id)
                    const unselectedColor = 'rgba(197, 143, 59, 0.0)'
                    return (
                      <button
                        key={zone.id} type="button" onClick={() => toggleArea(zone.id)} title={zone.id}
                        style={{
                          position: 'absolute', top: zone.top, left: zone.left, width: zone.width, height: zone.height,
                          backgroundColor: isSelected ? 'rgba(197,143,59,0.5)' : unselectedColor,
                          border: `2px solid ${isSelected ? GOLD : 'transparent'}`, borderRadius: '16px', cursor: 'pointer',
                          transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                          boxShadow: isSelected ? '0 10px 25px rgba(197,143,59,0.4)' : 'none',
                          transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', zIndex: 10
                        }}
                      />
                    )
                  })}
                </div>
                <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', margin: '0 0 8px' }}>Selected Focus Areas:</p>
                  {Array.from(selectedAreas).length === 0 ? (
                    <div style={{ padding: '20px', backgroundColor: '#fafafa', border: '1px dashed #ddd', borderRadius: 10, textAlign: 'center' }}>
                      <p style={{ fontSize: 13, color: '#aaa', fontStyle: 'italic', margin: 0 }}>Tap the diagram to select areas.</p>
                    </div>
                  ) : (
                    Array.from(selectedAreas).map(area => (
                      <div key={area} onClick={() => toggleArea(area)} style={{ padding: '14px 16px', backgroundColor: 'rgba(197,143,59,0.08)', border: '1px solid rgba(197,143,59,0.4)', borderRadius: 10, ...TEXT_FORMAT, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 2px 8px rgba(197,143,59,0.1)' }}>
                        {area}
                        <span style={{ color: GOLD }}>✓</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Section>

            {/* ── HEALTH CONDITIONS SECTION ── */}
            <Section title="Health Conditions" note="Please select all that apply">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                {HEALTH_CONDITIONS_LIST.map(cond => {
                  const isSelected = selectedConditions.has(cond)
                  return (
                    <button
                      key={cond} type="button" onClick={() => toggleCondition(cond)}
                      style={{
                        padding: '14px 16px',
                        backgroundColor: isSelected ? 'rgba(197,143,59,0.08)' : WHITE,
                        border: `1px solid ${isSelected ? 'rgba(197,143,59,0.4)' : 'rgba(26,26,26,0.13)'}`,
                        borderRadius: 10,
                        ...TEXT_FORMAT, fontWeight: 500, color: isSelected ? BLACK : 'rgba(26,26,26,0.75)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        cursor: 'pointer', textAlign: 'left', transition: 'all 150ms ease',
                        boxShadow: isSelected ? '0 2px 8px rgba(197,143,59,0.1)' : 'none'
                      }}
                    >
                      {cond}
                      <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${isSelected ? GOLD : '#ccc'}`, backgroundColor: isSelected ? GOLD : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isSelected && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke={WHITE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </Section>

            {/* ── NEW: ACKNOWLEDGEMENT & CONSENT ── */}
            <Section title="Acknowledgement & Consent">
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', cursor: 'pointer', padding: '4px 0' }} onClick={() => setAgreed(!agreed)}>
                <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${agreed ? GOLD : '#ccc'}`, backgroundColor: agreed ? GOLD : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, transition: 'all 0.2s' }}>
                  {agreed && <svg width="14" height="14" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke={WHITE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </div>
                <p style={{ margin: 0, fontSize: 14, color: 'rgba(26,26,26,0.85)', lineHeight: 1.6, fontFamily: BODY }}>
                  I understand that massage therapy is provided for stress reduction, relaxation, and relief from muscular tension. I acknowledge that massage therapy is not a substitute for medical examination or diagnosis. I have stated all my known medical conditions and take it upon myself to keep the therapist updated on my health.
                </p>
              </div>
            </Section>

            {/* ── NEW: DIGITAL SIGNATURE ── */}
            <Section title="Digital Signature" note="Type your full name to sign">
              <div>
                <input
                  className="wv-in"
                  style={{
                    display: 'block', width: '100%', height: 60,
                    padding: '10px 15px', backgroundColor: 'transparent',
                    border: 'none', borderBottom: '2px solid rgba(26,26,26,0.2)',
                    borderRadius: 0, fontSize: 32, color: BLACK,
                    fontFamily: "'Caveat', cursive", // Beautiful cursive signature font
                    boxSizing: 'border-box', outline: 'none',
                    transition: 'border-color 180ms ease'
                  }}
                  value={signature}
                  onChange={e => setSignature(e.target.value)}
                  placeholder="Sign your name here..."
                  required
                />
              </div>
            </Section>

            <button type="submit" disabled={loading} style={{ height: 64, backgroundColor: BLACK, color: GOLD, border: '1px solid rgba(197,143,59,0.35)', borderRadius: 11, fontSize: 14, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, marginTop: 10 }}>
              {loading ? 'Submitting...' : 'Confirm & Sign Waiver'}
            </button>

          </form>
        </div>
      </div>
    </>
  )
}