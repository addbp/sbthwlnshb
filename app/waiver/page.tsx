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
  padding: '0 15px',
  backgroundColor: WHITE, backgroundImage: 'none',
  border: '1px solid rgba(197,143,59,0.4)',
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
// DATA SETS & INTERACTIVE ZONES
// ─────────────────────────────────────────────────────────────
const BODY_AREAS = [
  'Neck & Cervical', 'Trapezius (Upper Back)', 'Deltoids (Shoulders)',
  'Lats & Rhomboids (Upper Back)', 'Lumbar (Lower Back)', 'Pectorals (Chest)',
  'Biceps & Triceps (Arms)', 'Forearms & Hands', 'Calves', 'Feet & Ankles'
]

// ⚠️ CALIBRATION: Tweak these percentages to perfectly fit your new image!
const INTERACTIVE_ZONES = [
  { id: 'Neck & Cervical', top: '12%', left: '45%', width: '10%', height: '8%' },
  { id: 'Deltoids (Shoulders)', top: '22%', left: '25%', width: '50%', height: '10%' },
  { id: 'Pectorals (Chest)', top: '30%', left: '35%', width: '30%', height: '12%' },
  { id: 'Biceps & Triceps (Arms)', top: '35%', left: '18%', width: '12%', height: '20%' },
  { id: 'Forearms & Hands', top: '55%', left: '12%', width: '15%', height: '20%' },
  { id: 'Trapezius (Upper Back)', top: '20%', left: '35%', width: '30%', height: '10%' },
  { id: 'Lats & Rhomboids (Upper Back)', top: '35%', left: '35%', width: '30%', height: '15%' },
  { id: 'Lumbar (Lower Back)', top: '50%', left: '38%', width: '24%', height: '12%' },
  { id: 'Calves', top: '75%', left: '32%', width: '36%', height: '15%' },
  { id: 'Feet & Ankles', top: '90%', left: '35%', width: '30%', height: '8%' },
]

const HEALTH_CONDITIONS_LIST = [
  'Stress', 'High Blood Pressure', 'Heart Issues',
  'Arthritis', 'Diabetes', 'Epilepsy',
  'Osteoporosis', 'Joint Swelling', 'Numbness',
  'Allergies', 'Pregnancy', 'Contagious Diseases'
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

  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const [clientDbNames, setClientDbNames] = useState<string[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

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
      next.has(cond) ? next.delete(cond) : next.add(cond)
      return next
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return alert("Please enter your full name.")
    setLoading(true)
    const areasArray = Array.from(selectedAreas).join(', ')
    const conditionsArray = Array.from(selectedConditions).join(', ')

    try {
      const { error } = await supabase.from('waivers').insert({
        client_name: name.trim(),
        focus_areas: areasArray || 'None',
        health_conditions: conditionsArray || 'None',
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
      <p style={{ color: 'rgba(26,26,26,0.7)', fontSize: 16 }}>Thank you, {name}. Your preferences have been saved securely.</p>
    </div>
  )

  return (
    <>
      <style>{`
        .wv-in:focus{border-color:${GOLD}!important;box-shadow:0 0 0 3px rgba(197,143,59,0.18)!important;}
        .click-card:active { transform: scale(0.97); }
        .dropdown-item:hover { background-color: rgba(197,143,59,0.08); color: ${GOLD}; }
        .hotspot { transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .hotspot:hover { transform: scale(1.05); }
      `}</style>

      <div style={{ backgroundColor: BG, minHeight: '100dvh', padding: '40px 20px', fontFamily: BODY }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.20em', color: GOLD, margin: '0 0 10px', textTransform: 'uppercase' }}>Client Consent</p>
            <h1 style={{ fontFamily: DSP, fontSize: 40, color: BLACK, margin: '0 0 8px', lineHeight: 1.1 }}>Digital Intake & Waiver</h1>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            <Section title="Client Details">
              <div>
                <label style={LABEL}>FULL NAME *</label>
                <div style={{ position: 'relative' }}>
                  <input className="wv-in" style={INPUT} value={name} onChange={e => { setName(e.target.value); setShowDropdown(true) }} onFocus={() => setShowDropdown(true)} onBlur={() => setTimeout(() => setShowDropdown(false), 200)} placeholder="Search or enter your full name" required autoComplete="off" />
                  {name.trim().length > 1 && (
                    <div style={{ position: 'absolute', right: 45, top: '50%', transform: 'translateY(-50%)', backgroundColor: isReturningClient ? 'rgba(197,143,59,0.15)' : 'rgba(46, 125, 50, 0.1)', color: isReturningClient ? GOLD : '#2e7d32', padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      {isReturningClient ? 'Returning Client' : 'New Client'}
                    </div>
                  )}
                  <span style={{ position: 'absolute', right: 15, top: '50%', transform: 'translateY(-50%)', color: '#888' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  </span>
                  {showDropdown && name.trim().length > 0 && filteredNames.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: WHITE, border: '1px solid rgba(197,143,59,0.3)', borderRadius: 10, marginTop: 6, maxHeight: 180, overflowY: 'auto', zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                      {filteredNames.map(n => (
                        <div key={n} className="dropdown-item" onClick={() => { setName(n); setShowDropdown(false); }} style={{ padding: '14px 15px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5', fontSize: 14, fontWeight: 500, fontFamily: BODY }}>{n}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Section>

            {/* ── REALISTIC INTERACTIVE DIAGRAM ── */}
            <Section title="Interactive Anatomical Reference" note="Tap directly on the muscles">
              <div style={{ position: 'relative', width: '100%', maxWidth: 500, margin: '0 auto', display: 'flex', justifyContent: 'center', backgroundColor: '#fdfdfd', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.05)' }}>

                {/* Connecting exactly to muscular-body.png */}
                <img
                  src="/muscular-body.png"
                  alt="Muscular Anatomy"
                  style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }}
                />

                {/* These are the invisible clickable zones over the image */}
                {INTERACTIVE_ZONES.map((zone) => {
                  const isSelected = selectedAreas.has(zone.id);

                  // =========================================================================
                  // 🚨 CALIBRATION TOGGLE: 
                  // Change 'rgba(197,143,59,0.0)' below to 'rgba(255,0,0,0.5)' to see the boxes.
                  // Change it back to '0.0' when you are done calibrating!
                  // =========================================================================
                  const unselectedColor = 'rgba(197,143,59,0.0)';

                  return (
                    <button
                      key={zone.id} type="button" title={zone.id} onClick={() => toggleArea(zone.id)} className="hotspot"
                      style={{
                        position: 'absolute', top: zone.top, left: zone.left, width: zone.width, height: zone.height,
                        backgroundColor: isSelected ? 'rgba(197,143,59,0.5)' : unselectedColor,
                        border: isSelected ? `2px solid ${GOLD}` : '1px solid transparent',
                        borderRadius: '20px', cursor: 'pointer', transform: isSelected ? 'scale(1.05)' : 'scale(1)', zIndex: 10,
                      }}
                    />
                  );
                })}
              </div>
            </Section>

            <Section title="Body Focus Areas" note="Select the specific muscular zones you would like the therapist to focus on:">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                {BODY_AREAS.map(area => {
                  const isSelected = selectedAreas.has(area)
                  return (
                    <div key={area} onClick={() => toggleArea(area)} className="click-card" style={{ padding: '16px 20px', backgroundColor: isSelected ? 'rgba(197,143,59,0.05)' : WHITE, border: `1px solid ${isSelected ? GOLD : 'rgba(26,26,26,0.1)'}`, borderRadius: 12, fontSize: 14, fontWeight: 600, fontFamily: BODY, color: isSelected ? BLACK : 'rgba(26,26,26,0.8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: isSelected ? '0 4px 12px rgba(197,143,59,0.1)' : '0 2px 5px rgba(0,0,0,0.02)' }}>
                      {area}
                      <div style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${isSelected ? GOLD : '#ddd'}`, backgroundColor: isSelected ? GOLD : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isSelected && <div style={{ width: 8, height: 8, backgroundColor: WHITE, borderRadius: '50%' }} />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>

            <Section title="Health Conditions" note="Please select all that apply">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                {HEALTH_CONDITIONS_LIST.map(cond => {
                  const isSelected = selectedConditions.has(cond)
                  return (
                    <div key={cond} onClick={() => toggleCondition(cond)} className="click-card" style={{ padding: '16px 20px', backgroundColor: isSelected ? 'rgba(197,143,59,0.05)' : WHITE, border: `1px solid ${isSelected ? GOLD : 'rgba(26,26,26,0.1)'}`, borderRadius: 12, fontSize: 14, fontWeight: 600, fontFamily: BODY, color: isSelected ? BLACK : 'rgba(26,26,26,0.8)', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: isSelected ? '0 4px 12px rgba(197,143,59,0.1)' : '0 2px 5px rgba(0,0,0,0.02)' }}>
                      <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${isSelected ? GOLD : '#ccc'}`, backgroundColor: isSelected ? GOLD : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isSelected && <svg width="12" height="12" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke={WHITE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </div>
                      {cond}
                    </div>
                  )
                })}
              </div>
            </Section>

            <button type="submit" disabled={loading} style={{ height: 58, backgroundColor: BLACK, color: GOLD, border: '1px solid rgba(197,143,59,0.35)', borderRadius: 11, fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'all 0.2s ease' }}>
              {loading ? 'Submitting...' : 'Submit Waiver'}
            </button>

          </form>
        </div>
      </div>
    </>
  )
}