'use client'

// app/waiver/page.tsx  —  Finalized Master Intake & Waiver
// Unified Design, Database Aligned, Clickable Options, and Photorealistic Anatomy

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
// DATA SETS
// ─────────────────────────────────────────────────────────────
const FRONT_ZONES = [
  { id: 'Neck & Cervical', top: '10%', left: '40%', width: '20%', height: '10%' },
  { id: 'Deltoids (Shoulders)', top: '22%', left: '20%', width: '60%', height: '12%' },
  { id: 'Pectorals (Chest)', top: '35%', left: '30%', width: '40%', height: '15%' },
  { id: 'Abdominals (Stomach)', top: '50%', left: '30%', width: '40%', height: '15%' },
  { id: 'Biceps (Arms)', top: '35%', left: '15%', width: '15%', height: '25%' },
  { id: 'Forearms (Hands)', top: '60%', left: '10%', width: '15%', height: '20%' },
  { id: 'Calves', top: '70%', left: '30%', width: '40%', height: '15%' },
  { id: 'Feet & Ankles', top: '85%', left: '30%', width: '40%', height: '10%' },
]

const BACK_ZONES = [
  { id: 'Neck & Cervical', top: '10%', left: '40%', width: '20%', height: '10%' },
  { id: 'Trapezius (Upper Back)', top: '22%', left: '30%', width: '40%', height: '15%' },
  { id: 'Deltoids (Shoulders)', top: '22%', left: '20%', width: '60%', height: '12%' },
  { id: 'Lats & Rhomboids (Upper Back)', top: '38%', left: '30%', width: '40%', height: '15%' },
  { id: 'Lumbar (Lower Back)', top: '55%', left: '35%', width: '30%', height: '15%' },
  { id: 'Calves', top: '70%', left: '30%', width: '40%', height: '15%' },
  { id: 'Feet & Ankles', top: '85%', left: '30%', width: '40%', height: '10%' },
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
  const [view, setView] = useState<'FRONT' | 'BACK'>('FRONT')

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
      // ⚠️ IMPORTANT: Ensure your Supabase has a 'waivers' table with these exact columns!
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

  const activeZones = view === 'FRONT' ? FRONT_ZONES : BACK_ZONES

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
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

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

            {/* ── INTERACTIVE BODY MAP SECTION ── */}
            <Section title="Body Focus Areas" note="Select specific muscular zones">
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

                {/* Photorealistic Interactive Map Graphic */}
                <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  <div style={{ display: 'flex', backgroundColor: '#f5f5f5', borderRadius: 8, padding: 4 }}>
                    <button type="button" onClick={() => setView('FRONT')} style={{ padding: '6px 16px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: 'none', backgroundColor: view === 'FRONT' ? WHITE : 'transparent', color: view === 'FRONT' ? BLACK : '#888', cursor: 'pointer', boxShadow: view === 'FRONT' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}>FRONT</button>
                    <button type="button" onClick={() => setView('BACK')} style={{ padding: '6px 16px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: 'none', backgroundColor: view === 'BACK' ? WHITE : 'transparent', color: view === 'BACK' ? BLACK : '#888', cursor: 'pointer', boxShadow: view === 'BACK' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}>BACK</button>
                  </div>

                  <div style={{ position: 'relative', width: 220, height: 400, backgroundColor: '#FAFAFA', border: '1px solid #EAEAEA', borderRadius: 12, perspective: '1000px', overflow: 'hidden' }}>
                    {/* Base Body Sculpture Asset */}
                    <img src="/anatomy.png" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: 0.15 }} />

                    {/* Interactive HUD-style hotspots */}
                    {activeZones.map((zone) => {
                      const isSelected = selectedAreas.has(zone.id)
                      return (
                        <button
                          key={zone.id} type="button" onClick={() => toggleArea(zone.id)} title={zone.id}
                          style={{
                            position: 'absolute', top: zone.top, left: zone.left, width: zone.width, height: zone.height,
                            backgroundColor: isSelected ? 'rgba(197,143,59,0.7)' : 'rgba(26,26,26,0.1)',
                            border: `2px solid ${isSelected ? GOLD : 'transparent'}`, borderRadius: '12px', cursor: 'pointer',
                            backdropFilter: 'blur(2px)', transform: isSelected ? 'scale(1.15) translateZ(20px)' : 'scale(1) translateZ(0)',
                            boxShadow: isSelected ? '0 10px 20px rgba(197,143,59,0.3)' : 'none',
                            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', zIndex: isSelected ? 10 : 1
                          }}
                        />
                      )
                    })}
                  </div>
                </div>

                {/* Selected Areas List (Font perfectly standardises to Health Conditions) */}
                <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', margin: '0 0 8px' }}>Selected Focus Areas:</p>
                  {Array.from(selectedAreas).length === 0 ? (
                    <p style={{ fontSize: 13, color: '#aaa', fontStyle: 'italic' }}>Tap the diagram to select areas.</p>
                  ) : (
                    Array.from(selectedAreas).map(area => (
                      <div key={area} onClick={() => toggleArea(area)} style={{ padding: '14px 16px', backgroundColor: 'rgba(197,143,59,0.1)', border: '1.5px solid rgba(197,143,59,0.4)', borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: BODY, color: BLACK, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                        {area}
                        <span style={{ color: GOLD }}>✓</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Section>

            {/* ── HEALTH CONDITIONS SECTION (FIXED Clickability, standardised Font) ── */}
            <Section title="Health Conditions" note="Please select all that apply">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {HEALTH_CONDITIONS_LIST.map(cond => {
                  const isSelected = selectedConditions.has(cond)
                  return (
                    <button
                      key={cond} type="button" onClick={() => toggleCondition(cond)}
                      style={{
                        padding: '14px 16px',
                        backgroundColor: isSelected ? 'rgba(197,143,59,0.1)' : WHITE,
                        border: `1.5px solid ${isSelected ? GOLD : 'rgba(26,26,26,0.13)'}`,
                        borderRadius: 10,
                        fontSize: 14, // standardised to Body Areas list
                        fontWeight: 600, // standardised
                        fontFamily: BODY, // standardised
                        color: isSelected ? BLACK : 'rgba(26,26,26,0.75)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        cursor: 'pointer', textAlign: 'left', transition: 'all 150ms ease',
                        boxShadow: isSelected ? '0 2px 8px rgba(197,143,59,0.15)' : 'none'
                      }}
                    >
                      {cond}
                      {/* Custom styled checkbox UI */}
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