'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, FormEvent } from 'react'
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
// ALL INTERACTIVE ZONES (Mapped for Side-By-Side Image)
// ─────────────────────────────────────────────────────────────
const INTERACTIVE_ZONES = [
  // FRONT BODY (Left side)
  { id: 'Neck & Cervical', top: '10%', left: '21%', width: '8%', height: '6%' },
  { id: 'Pectorals (Chest)', top: '22%', left: '15%', width: '20%', height: '12%' },
  { id: 'Biceps & Triceps (Arms)', top: '35%', left: '8%', width: '34%', height: '15%' },
  { id: 'Forearms & Hands', top: '50%', left: '4%', width: '42%', height: '15%' },

  // BACK BODY (Right side)
  { id: 'Trapezius (Upper Back)', top: '18%', left: '65%', width: '20%', height: '10%' },
  { id: 'Deltoids (Shoulders)', top: '20%', left: '58%', width: '34%', height: '10%' },
  { id: 'Lats & Rhomboids (Upper Back)', top: '30%', left: '65%', width: '20%', height: '15%' },
  { id: 'Lumbar (Lower Back)', top: '45%', left: '67%', width: '16%', height: '10%' },
  { id: 'Calves', top: '75%', left: '64%', width: '22%', height: '15%' },
  { id: 'Feet & Ankles', top: '90%', left: '64%', width: '22%', height: '6%' },
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
      next.has(cond) ? next.delete(cond) : next.add(cond)
      return next
    })
  }

  // ── SUBMIT FUNCTION ──
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
        .wv-in:hover:not(:focus){border-color:rgba(197,143,59,0.45)!important;}
      `}</style>

      <div style={{ backgroundColor: BG, minHeight: '100dvh', padding: '40px 20px', fontFamily: BODY }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.20em', color: GOLD, margin: '0 0 10px', textTransform: 'uppercase' }}>Client Consent</p>
            <h1 style={{ fontFamily: DSP, fontSize: 40, color: BLACK, margin: '0 0 8px', lineHeight: 1.1 }}>Digital Intake & Waiver</h1>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            <Section title="Client Details">
              <div>
                <label style={LABEL}>Full Name *</label>
                <input className="wv-in" style={INPUT} value={name} onChange={e => setName(e.target.value)} placeholder="Enter your full name" required />
              </div>
            </Section>

            {/* ── GORGEOUS, SIDE-BY-SIDE BODY MAP SECTION ── */}
            <Section title="Body Focus Areas" note="Tap directly on the specific muscular zones">
              <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', alignItems: 'center' }}>

                {/* Image & Hotspots Container */}
                <div style={{ flex: '1 1 400px', position: 'relative', width: '100%', maxWidth: 500, margin: '0 auto', backgroundColor: '#FAFAFA', border: '1px solid #EAEAEA', borderRadius: 16, overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>

                  {/* IMPORTANT: Ensure your image is named exactly muscular-body.png in the public folder */}
                  <img
                    src="/muscular-body.png"
                    alt="Muscular Anatomy"
                    style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }}
                  />

                  {/* Interactive HUD-style hotspots */}
                  {INTERACTIVE_ZONES.map((zone) => {
                    const isSelected = selectedAreas.has(zone.id)

                    // 🚨 CALIBRATION: Change 0.0 to 0.4 red here to see the boxes temporarily! 
                    const unselectedColor = 'rgba(255, 0, 0, 0.0)';

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

                {/* Selected Areas List */}
                <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', margin: '0 0 8px' }}>Selected Focus Areas:</p>
                  {Array.from(selectedAreas).length === 0 ? (
                    <div style={{ padding: '20px', backgroundColor: '#fafafa', border: '1px dashed #ddd', borderRadius: 10, textAlign: 'center' }}>
                      <p style={{ fontSize: 13, color: '#aaa', fontStyle: 'italic', margin: 0 }}>Tap the diagram to select areas.</p>
                    </div>
                  ) : (
                    Array.from(selectedAreas).map(area => (
                      <div key={area} onClick={() => toggleArea(area)} style={{ padding: '14px 16px', backgroundColor: 'rgba(197,143,59,0.08)', border: '1px solid rgba(197,143,59,0.4)', borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: BODY, color: BLACK, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 2px 8px rgba(197,143,59,0.1)' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
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
                        fontSize: 14,
                        fontWeight: 600,
                        fontFamily: BODY,
                        color: isSelected ? BLACK : 'rgba(26,26,26,0.75)',
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

            <button type="submit" disabled={loading} style={{ height: 58, backgroundColor: BLACK, color: GOLD, border: '1px solid rgba(197,143,59,0.35)', borderRadius: 11, fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Submitting...' : 'Confirm & Sign Waiver'}
            </button>

          </form>
        </div>
      </div>
    </>
  )
}