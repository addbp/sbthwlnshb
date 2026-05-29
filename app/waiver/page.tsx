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
  { id: 'Neck & Cervical', top: '10%', left: '21%', width: '8%', height: '7%' },
  { id: 'Pectorals (Chest)', top: '19%', left: '15.5%', width: '19%', height: '11.5%' },
  { id: 'Biceps & Triceps (Arms)', top: '23%', left: '11%', width: '7%', height: '24%' },
  { id: 'Forearms & Hands', top: '48%', left: '4%', width: '8%', height: '20%' },
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
  const [agreed, setAgreed] = useState(false)
  const [signature, setSignature] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Smart Search & History States
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clientHistory, setClientHistory] = useState<any[]>([])
  const [clientDbNames, setClientDbNames] = useState<string[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  // Canvas Signature State
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = 200
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.strokeStyle = BLACK; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      }
    }
  }, [])

  // ── FETCH EVERYTHING FROM DATABASE ──
  useEffect(() => {
    async function fetchAllRecords() {
      try {
        const [liveRes, archiveRes, clientRes] = await Promise.all([
          supabase.from('bookings').select('client_name, created_at, service_name').order('created_at', { ascending: false }),
          supabase.from('bookings_import').select('client_name, created_at, service_name').order('created_at', { ascending: false }),
          supabase.from('client').select('client_name, created_at').order('created_at', { ascending: false }).catch(() => ({ data: [] }))
        ])

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const combined: any[] = [
          ...(liveRes.data || []),
          ...(archiveRes.data || []),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...((clientRes as any).data || [])
        ].filter(d => d.client_name)

        setClientHistory(combined)
        setClientDbNames(Array.from(new Set(combined.map(d => d.client_name))))
      } catch (err) { console.error("History Load Error:", err) }
    }
    fetchAllRecords()
  }, [supabase])

  const filteredNames = clientDbNames.filter(n => n.toLowerCase().includes(name.toLowerCase()) && n.toLowerCase() !== name.toLowerCase())
  const matchingHistory = clientHistory.filter(h => h.client_name.toLowerCase() === name.trim().toLowerCase())
  const isReturningClient = matchingHistory.length > 0

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
      if (cond === 'None of the above') return next.has('None of the above') ? new Set() : new Set(['None of the above'])
      next.delete('None of the above')
      next.has(cond) ? next.delete(cond) : next.add(cond)
      return next
    })
  }

  // ── DRAWING LOGIC ──
  const getCoords = (e: React.MouseEvent | React.TouchEvent, rect: DOMRect) => {
    const isTouch = 'touches' in e
    const clientX = isTouch ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = isTouch ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const startDrawing = (e: any) => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const { x, y } = getCoords(e, canvas.getBoundingClientRect())
    ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true)
  }

  const draw = (e: any) => {
    if (!isDrawing || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d'); if (!ctx) return
    const { x, y } = getCoords(e, canvasRef.current.getBoundingClientRect())
    ctx.lineTo(x, y); ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    if (canvasRef.current) setSignature(canvasRef.current.toDataURL('image/png'))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !agreed || !signature) return alert("Please complete all required fields and sign.")
    setLoading(true)
    try {
      const { error } = await supabase.from('waivers').insert({
        client_name: name.trim(),
        focus_areas: Array.from(selectedAreas).join(', ') || 'None',
        health_conditions: Array.from(selectedConditions).join(', ') || 'None',
        signature, terms_agreed: agreed, date_signed: new Date().toISOString()
      })
      if (error) throw error
      setSubmitted(true)
    } catch (err: any) { alert("Error: " + err.message) } finally { setLoading(false) }
  }

  if (submitted) return (
    <div style={{ backgroundColor: BG, minHeight: '100dvh', padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 44, color: GOLD, marginBottom: 20, width: 70, height: 70, borderRadius: '50%', backgroundColor: 'rgba(197,143,59,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>
      <h2 style={{ fontFamily: DSP, fontSize: 40, color: BLACK, margin: '0 0 10px' }}>Waiver Signed</h2>
      <p style={{ color: 'rgba(26,26,26,0.7)', fontFamily: BODY }}>Thank you, {name}. Your intake form is secure.</p>
      <button onClick={() => window.location.reload()} style={{ marginTop: 30, height: 50, padding: '0 30px', backgroundColor: BLACK, color: GOLD, border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>SUBMIT ANOTHER</button>
    </div>
  )

  return (
    <>
      <style>{`
        .wv-in:focus{border-color:${GOLD}!important;box-shadow:0 0 0 3px rgba(197,143,59,0.18)!important;}
        .wv-in:hover:not(:focus){border-color:rgba(197,143,59,0.45)!important;}
        .dropdown-item:hover { background-color: rgba(197,143,59,0.08); color: ${GOLD}; }
        .focus-scroll::-webkit-scrollbar { width: 6px; }
        .focus-scroll::-webkit-scrollbar-thumb { background: rgba(197,143,59,0.2); border-radius: 6px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justifyContent: center; padding: 20px; }
      `}</style>

      {/* ── CLIENT HISTORY MODAL ── */}
      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div style={{ backgroundColor: WHITE, width: '100%', maxWidth: 500, borderRadius: 20, padding: 30, boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: DSP, fontSize: 24, margin: 0 }}>Client Visit History</h3>
              <button onClick={() => setShowHistoryModal(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>
            <p style={{ fontSize: 13, color: GOLD, fontWeight: 700, textTransform: 'uppercase', marginBottom: 15 }}>Records for {name}</p>
            <div className="focus-scroll" style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #eee', borderRadius: 12 }}>
              {matchingHistory.map((h, i) => (
                <div key={i} style={{ padding: '15px', borderBottom: i === matchingHistory.length - 1 ? 'none' : '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: BLACK }}>{h.service_name || 'Massage Session'}</div>
                    <div style={{ fontSize: 12, color: 'rgba(26,26,26,0.5)' }}>{new Date(h.created_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  </div>
                  <div style={{ fontSize: 10, backgroundColor: 'rgba(197,143,59,0.1)', color: GOLD, padding: '4px 8px', borderRadius: 4, fontWeight: 800 }}>PAST</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: BG, minHeight: '100dvh', padding: '40px 20px', fontFamily: BODY }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.20em', color: GOLD, margin: '0 0 10px', textTransform: 'uppercase' }}>Client Consent</p>
            <h1 style={{ fontFamily: DSP, fontSize: 40, color: BLACK, margin: '0 0 8px', lineHeight: 1.1 }}>Digital Intake & Waiver</h1>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* ── CLIENT DETAILS SECTION ── */}
            <Section title="Client Details">
              <div style={{ position: 'relative' }}>
                <label style={LABEL}>Full Name *</label>
                <input className="wv-in" style={INPUT} value={name} onChange={e => { setName(e.target.value); setShowDropdown(true) }} onFocus={() => setShowDropdown(true)} onBlur={() => setTimeout(() => setShowDropdown(false), 200)} placeholder="Search or enter full name" required autoComplete="off" />

                {showDropdown && name.trim().length > 0 && filteredNames.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: WHITE, border: '1px solid rgba(197,143,59,0.3)', borderRadius: 10, marginTop: 6, maxHeight: 180, overflowY: 'auto', zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                    {filteredNames.map(n => (
                      <div key={n} className="dropdown-item" onClick={() => { setName(n); setShowDropdown(false); }} style={{ padding: '14px 15px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5', fontSize: 14, fontWeight: 500 }}>{n}</div>
                    ))}
                  </div>
                )}
              </div>

              {name.trim().length > 1 && (
                <div style={{ marginTop: 14, padding: '16px', backgroundColor: isReturningClient ? 'rgba(197,143,59,0.06)' : 'rgba(46, 125, 50, 0.04)', borderRadius: 12, border: `1px solid ${isReturningClient ? 'rgba(197,143,59,0.2)' : 'rgba(46, 125, 50, 0.15)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 800, color: isReturningClient ? GOLD : '#2e7d32', textTransform: 'uppercase' }}>{isReturningClient ? 'Returning Client' : 'New Client'}</p>
                    <p style={{ margin: 0, fontSize: 13, color: 'rgba(26,26,26,0.8)' }}>{isReturningClient ? `Found ${matchingHistory.length} previous visits.` : 'Welcome! Please complete your first intake.'}</p>
                  </div>
                  {isReturningClient && (
                    <button type="button" onClick={() => setShowHistoryModal(true)} style={{ backgroundColor: GOLD, color: WHITE, border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 10px rgba(197,143,59,0.2)' }}>VIEW HISTORY</button>
                  )}
                </div>
              )}
            </Section>

            {/* ── BODY MAP SECTION (UNTOUCHED) ── */}
            <Section title="Body Focus Areas" note="Tap diagram or select from list">
              <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: '1 1 400px', position: 'relative', width: '100%', maxWidth: 500, margin: '0 auto', backgroundColor: '#FAFAFA', border: '1px solid #EAEAEA', borderRadius: 16, overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/muscular-body.png" alt="Anatomy" style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }} />
                  {INTERACTIVE_ZONES.map((zone) => (
                    <button key={`map-${zone.id}`} type="button" onClick={() => toggleArea(zone.id)} style={{ position: 'absolute', top: zone.top, left: zone.left, width: zone.width, height: zone.height, backgroundColor: selectedAreas.has(zone.id) ? 'rgba(197,143,59,0.5)' : 'transparent', border: `2px solid ${selectedAreas.has(zone.id) ? GOLD : 'transparent'}`, borderRadius: '16px', cursor: 'pointer', transition: 'all 0.3s' }} />
                  ))}
                </div>
                <div className="focus-scroll" style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
                  {INTERACTIVE_ZONES.map(zone => (
                    <button key={`list-${zone.id}`} type="button" onClick={() => toggleArea(zone.id)} style={{ padding: '14px 16px', backgroundColor: selectedAreas.has(zone.id) ? 'rgba(197,143,59,0.08)' : WHITE, border: `1px solid ${selectedAreas.has(zone.id) ? GOLD : 'rgba(26,26,26,0.13)'}`, borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', ...TEXT_FORMAT, fontWeight: 500 }}>
                      {zone.id}
                      <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${selectedAreas.has(zone.id) ? GOLD : '#ccc'}`, backgroundColor: selectedAreas.has(zone.id) ? GOLD : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {selectedAreas.has(zone.id) && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke={WHITE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </Section>

            {/* ── HEALTH CONDITIONS ── */}
            <Section title="Health Conditions">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                {HEALTH_CONDITIONS_LIST.map(cond => (
                  <button key={cond} type="button" onClick={() => toggleCondition(cond)} style={{ padding: '14px 16px', backgroundColor: selectedConditions.has(cond) ? 'rgba(197,143,59,0.08)' : WHITE, border: `1px solid ${selectedConditions.has(cond) ? GOLD : 'rgba(26,26,26,0.13)'}`, borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', ...TEXT_FORMAT, fontWeight: 500 }}>
                    {cond}
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${selectedConditions.has(cond) ? GOLD : '#ccc'}`, backgroundColor: selectedConditions.has(cond) ? GOLD : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {selectedConditions.has(cond) && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke={WHITE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </div>
                  </button>
                ))}
              </div>
            </Section>

            {/* ── CONSENT ── */}
            <Section title="Acknowledgement">
              <div style={{ display: 'flex', gap: 14, cursor: 'pointer' }} onClick={() => setAgreed(!agreed)}>
                <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${agreed ? GOLD : '#ccc'}`, backgroundColor: agreed ? GOLD : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {agreed && <svg width="14" height="14" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke={WHITE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(26,26,26,0.7)', lineHeight: 1.6 }}>I acknowledge that massage therapy is not a substitute for medical diagnosis. I have stated all my medical conditions truthfully.</p>
              </div>
            </Section>

            {/* ── SIGNATURE ── */}
            <Section title="Digital Signature">
              <div style={{ position: 'relative', width: '100%', maxWidth: 500 }}>
                <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} style={{ border: '1px solid rgba(197,143,59,0.5)', borderRadius: 12, backgroundColor: '#fafafa', width: '100%', height: 200, touchAction: 'none', cursor: 'crosshair' }} />
                <button type="button" onClick={clearSignature} style={{ position: 'absolute', top: 12, right: 12, fontSize: 10, fontWeight: 700, padding: '6px 12px', borderRadius: 6, backgroundColor: 'rgba(26,26,26,0.05)', border: 'none', cursor: 'pointer' }}>CLEAR</button>
              </div>
            </Section>

            <button type="submit" disabled={loading} style={{ height: 60, backgroundColor: BLACK, color: GOLD, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Processing...' : 'Confirm & Sign'}
            </button>

          </form>
        </div>
      </div>
    </>
  )
}