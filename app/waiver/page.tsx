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
  border: '1px solid rgba(197,143,59,0.4)', // Gold border to match old style
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
// DATA SETS (Abs, Glutes, Thighs Removed per your request)
// ─────────────────────────────────────────────────────────────
const BODY_AREAS = [
  'Neck & Cervical', 'Trapezius (Upper Back)', 'Deltoids (Shoulders)',
  'Lats & Rhomboids (Upper Back)', 'Lumbar (Lower Back)', 'Pectorals (Chest)',
  'Biceps & Triceps (Arms)', 'Forearms & Hands', 'Calves', 'Feet & Ankles'
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
        
        /* Grid click animation */
        .click-card:active { transform: scale(0.97); }
        .click-img:active { transform: scale(1.05); }
      `}</style>

      <div style={{ backgroundColor: BG, minHeight: '100dvh', padding: '40px 20px', fontFamily: BODY }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.20em', color: GOLD, margin: '0 0 10px', textTransform: 'uppercase' }}>Client Consent</p>
            <h1 style={{ fontFamily: DSP, fontSize: 40, color: BLACK, margin: '0 0 8px', lineHeight: 1.1 }}>Digital Intake & Waiver</h1>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* ── OLD CLIENT DETAILS STYLE ── */}
            <Section title="Client Details">
              <div>
                <label style={LABEL}>FULL NAME *</label>
                <div style={{ position: 'relative' }}>
                  <input className="wv-in" style={INPUT} value={name} onChange={e => setName(e.target.value)} placeholder="Enter your full name" required />
                  <span style={{ position: 'absolute', right: 15, top: '50%', transform: 'translateY(-50%)', color: '#888' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  </span>
                </div>
              </div>
            </Section>

            {/* ── NEW MUSCULAR ANATOMY DIAGRAM ── */}
            <Section title="Anatomical Reference" note="For visual guidance">
              <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0', overflow: 'hidden', borderRadius: 12, backgroundColor: '#fdfdfd', border: '1px solid rgba(0,0,0,0.05)' }}>
                {/* IMPORTANT: Save your muscular diagram image in the 'public' folder as 'anatomy.jpg' 
                  If you don't have it yet, this will gracefully show a placeholder.
                */}
                <img
                  src="/anatomy.jpg"
                  alt="Muscular Anatomy Reference"
                  className="click-img"
                  style={{ maxWidth: '100%', height: 'auto', maxHeight: 350, objectFit: 'contain', cursor: 'pointer', transition: 'transform 0.3s ease' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/800x350/F9F4EB/C58F3B?text=Please+upload+anatomy.jpg+to+public+folder';
                  }}
                />
              </div>
            </Section>

            {/* ── OLD BODY FOCUS AREAS GRID ── */}
            <Section title="Body Focus Areas" note="Select the specific muscular zones you would like the therapist to focus on:">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                {BODY_AREAS.map(area => {
                  const isSelected = selectedAreas.has(area)
                  return (
                    <div
                      key={area} onClick={() => toggleArea(area)} className="click-card"
                      style={{
                        padding: '16px 20px',
                        backgroundColor: isSelected ? 'rgba(197,143,59,0.05)' : WHITE,
                        border: `1px solid ${isSelected ? GOLD : 'rgba(26,26,26,0.1)'}`,
                        borderRadius: 12,
                        fontSize: 14, fontWeight: 600, fontFamily: BODY,
                        color: isSelected ? BLACK : 'rgba(26,26,26,0.8)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        cursor: 'pointer', transition: 'all 0.2s ease',
                        boxShadow: isSelected ? '0 4px 12px rgba(197,143,59,0.1)' : '0 2px 5px rgba(0,0,0,0.02)'
                      }}
                    >
                      {area}
                      {/* Empty Circle UI (Old Style) */}
                      <div style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${isSelected ? GOLD : '#ddd'}`, backgroundColor: isSelected ? GOLD : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isSelected && <div style={{ width: 8, height: 8, backgroundColor: WHITE, borderRadius: '50%' }} />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>

            {/* ── HEALTH CONDITIONS SECTION (Fixed, Checkbox UI) ── */}
            <Section title="Health Conditions" note="Please select all that apply">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                {HEALTH_CONDITIONS_LIST.map(cond => {
                  const isSelected = selectedConditions.has(cond)
                  return (
                    <div
                      key={cond} onClick={() => toggleCondition(cond)} className="click-card"
                      style={{
                        padding: '16px 20px',
                        backgroundColor: isSelected ? 'rgba(197,143,59,0.05)' : WHITE,
                        border: `1px solid ${isSelected ? GOLD : 'rgba(26,26,26,0.1)'}`,
                        borderRadius: 12,
                        fontSize: 14, fontWeight: 600, fontFamily: BODY,
                        color: isSelected ? BLACK : 'rgba(26,26,26,0.8)',
                        display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 12,
                        cursor: 'pointer', transition: 'all 0.2s ease',
                        boxShadow: isSelected ? '0 4px 12px rgba(197,143,59,0.1)' : '0 2px 5px rgba(0,0,0,0.02)'
                      }}
                    >
                      {/* Square Checkbox UI */}
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