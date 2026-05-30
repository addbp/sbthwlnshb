'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, FormEvent, useMemo } from 'react'
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
  color: BLACK
}

const INPUT: React.CSSProperties = {
  display: 'block',
  width: '100%',
  height: 54,
  padding: '0 15px',
  backgroundColor: WHITE,
  border: '1px solid rgba(26,26,26,0.14)',
  borderRadius: 10,
  fontSize: 16,
  color: BLACK,
  fontFamily: BODY,
  outline: 'none'
}

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.13em',
  textTransform: 'uppercase',
  color: 'rgba(26,26,26,0.50)',
  marginBottom: 7,
  fontFamily: BODY
}

// ─────────────────────────────────────────────────────────────
// INTERACTIVE ZONES
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
  'Stress', 'High Blood Pressure', 'Heart Issues', 'Arthritis', 'Diabetes', 'Epilepsy',
  'Osteoporosis', 'Joint Swelling', 'Numbness', 'Allergies', 'Pregnancy', 'Contagious Diseases',
  'Other', 'None of the above'
]

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <div style={{ backgroundColor: WHITE, border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, padding: '28px', display: 'flex', flexDirection: 'column', gap: 18, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ paddingBottom: 14, borderBottom: '1px solid rgba(197,143,59,0.15)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 18, height: 2, backgroundColor: GOLD, display: 'inline-block', borderRadius: 2 }} />
          <h2 style={{ fontFamily: DSP, fontSize: 21, fontWeight: 400, color: BLACK, margin: 0 }}>{title}</h2>
        </div>
        {note && <span style={{ fontSize: 11, color: 'rgba(26,26,26,0.38)', fontFamily: BODY }}>{note}</span>}
      </div>
      {children}
    </div>
  )
}

export default function WaiverPage() {
  const supabaseRef = useRef<SupabaseClient | null>(null)
  if (!supabaseRef.current) {
    supabaseRef.current = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  }
  const supabase = supabaseRef.current

  const [name, setName] = useState('')
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set())
  const [selectedConditions, setSelectedConditions] = useState<Set<string>>(new Set())
  const [agreed, setAgreed] = useState(false)
  const [signature, setSignature] = useState('')
  const [loading, setLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [allRecords, setAllRecords] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width; canvas.height = 200
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.strokeStyle = BLACK;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round'
      }
    }
  }, [])

  // ── UNLIMITED PAGINATION SCRAPER ──
  useEffect(() => {
    async function fetchAllRecords() {
      try {
        const tables = ['bookings', 'bookings_import', 'client', 'clients'];

        const fetchPaginated = async (tableName: string) => {
          let allTableData: any[] = [];
          let start = 0;
          const step = 1000;
          let hasMore = true;

          while (hasMore) {
            const { data, error } = await supabase
              .from(tableName)
              .select('*')
              .range(start, start + step - 1);

            if (error || !data) {
              hasMore = false;
              break;
            }

            allTableData.push(...data);

            if (data.length < step) {
              hasMore = false;
            } else {
              start += step;
            }
          }
          return allTableData;
        };

        const results = await Promise.allSettled(tables.map(t => fetchPaginated(t)));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const finalPool: any[] = [];

        results.forEach((res) => {
          if (res.status === 'fulfilled' && res.value) {
            res.value.forEach((item: any) => {
              const rawName = item.client_name || item.full_name || item.name || "";
              const rawDate = item.created_at || item.booking_date || item.date || item.updated_at;
              const rawService = item.service_name || item.service || item.treatment || "Spa Service";

              if (rawName) {
                finalPool.push({
                  ...item,
                  display_name: rawName,
                  display_date: rawDate ? new Date(rawDate).toLocaleDateString() : "Unknown Date",
                  display_service: rawService,
                  search_key: rawName.toString().trim().toLowerCase(),
                  sort_date: rawDate ? new Date(rawDate).getTime() : 0
                });
              }
            });
          }
        });

        finalPool.sort((a, b) => b.sort_date - a.sort_date);
        setAllRecords(finalPool);
        setDataLoaded(true);
      } catch (err) { console.error("Database Fetch Error:", err) }
    }
    fetchAllRecords()
  }, [supabase])

  const normalizedInput = name.trim().toLowerCase()

  const matchingHistory = useMemo(() => {
    return normalizedInput ? allRecords.filter(r => r.search_key === normalizedInput) : []
  }, [allRecords, normalizedInput])

  const isReturningClient = matchingHistory.length > 0

  const dropdownOptions = useMemo(() => {
    if (!normalizedInput || normalizedInput.length < 2) return []
    const names = Array.from(new Set(allRecords.map(r => r.display_name)))
    return names.filter(n => n.toLowerCase().includes(normalizedInput) && n.toLowerCase() !== normalizedInput).slice(0, 5)
  }, [allRecords, normalizedInput])

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
      if (cond === 'None of the above') return new Set(['None of the above'])
      next.delete('None of the above');
      next.has(cond) ? next.delete(cond) : next.add(cond)
      return next
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getCoords = (e: any, rect: DOMRect) => {
    const isTouch = e.touches
    const clientX = isTouch ? e.touches[0].clientX : e.clientX
    const clientY = isTouch ? e.touches[0].clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const startDrawing = (e: any) => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const { x, y } = getCoords(e, canvas.getBoundingClientRect())
    ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const draw = (e: any) => {
    if (!isDrawing || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d'); if (!ctx) return
    const { x, y } = getCoords(e, canvasRef.current.getBoundingClientRect())
    ctx.lineTo(x, y); ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    if (canvasRef.current) {
      setSignature(canvasRef.current.toDataURL('image/png'))
    }
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      setSignature('')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !agreed || !signature) {
      return alert("Please complete Name, Acknowledgement, and Signature.")
    }

    setLoading(true)
    try {
      const { error } = await supabase.from('waivers').insert({
        client_name: name.trim(),
        focus_areas: Array.from(selectedAreas).join(', ') || 'None',
        health_conditions: Array.from(selectedConditions).join(', ') || 'None',
        signature: signature,
        terms_agreed: agreed,
        date_signed: new Date().toISOString()
      })
      if (error) throw error
      setSubmitted(true)
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) return (
    <div style={{ backgroundColor: BG, minHeight: '100dvh', padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 44, color: GOLD, marginBottom: 20, width: 70, height: 70, borderRadius: '50%', backgroundColor: 'rgba(197,143,59,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>
      <h2 style={{ fontFamily: DSP, fontSize: 40, color: BLACK }}>Waiver Saved</h2>
      <button onClick={() => window.location.reload()} style={{ marginTop: 30, height: 50, padding: '0 30px', backgroundColor: BLACK, color: GOLD, border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>NEW WAIVER</button>
    </div>
  )

  return (
    <>
      <style>{`
        .wv-in:focus{border-color:${GOLD}!important;box-shadow:0 0 0 3px rgba(197,143,59,0.18)!important;}
        .dropdown-item:hover { background-color: rgba(197,143,59,0.08); color: ${GOLD}; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
      `}</style>

      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div style={{ backgroundColor: WHITE, width: '100%', maxWidth: 500, borderRadius: 20, padding: 30, boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: DSP, fontSize: 24, margin: 0 }}>Visit History</h3>
              <button onClick={() => setShowHistoryModal(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ maxHeight: 350, overflowY: 'auto', border: '1px solid #eee', borderRadius: 12 }}>
              {matchingHistory.map((h, i) => (
                <div key={i} style={{ padding: '15px', borderBottom: i === matchingHistory.length - 1 ? 'none' : '1px solid #eee' }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{h.display_service}</div>
                  <div style={{ fontSize: 12, color: 'rgba(26,26,26,0.5)' }}>{h.display_date}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: BG, minHeight: '100dvh', padding: '40px 20px', fontFamily: BODY }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontFamily: DSP, fontSize: 40, color: BLACK }}>Digital Intake & Waiver</h1>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <Section title="Client Details">
              <div style={{ position: 'relative' }}>
                <label style={LABEL}>Full Name *</label>
                <input
                  className="wv-in"
                  style={INPUT}
                  value={name}
                  onChange={e => { setName(e.target.value); setShowDropdown(true) }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  placeholder="Search for name..."
                  required
                  autoComplete="off"
                />
                {showDropdown && dropdownOptions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: WHITE, border: '1px solid rgba(197,143,59,0.3)', borderRadius: 10, marginTop: 6, maxHeight: 180, overflowY: 'auto', zIndex: 50 }}>
                    {dropdownOptions.map(n => (
                      <div key={n} className="dropdown-item" onClick={() => { setName(n); setShowDropdown(false); }} style={{ padding: '14px 15px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5', fontSize: 14 }}>{n}</div>
                    ))}
                  </div>
                )}
              </div>

              {name.trim().length > 1 && dataLoaded && (
                <div style={{ marginTop: 14, padding: '16px', backgroundColor: isReturningClient ? 'rgba(197,143,59,0.06)' : 'rgba(46, 125, 50, 0.04)', borderRadius: 12, border: `1px solid ${isReturningClient ? 'rgba(197,143,59,0.2)' : 'rgba(46, 125, 50, 0.15)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 800, color: isReturningClient ? GOLD : '#2e7d32', textTransform: 'uppercase' }}>{isReturningClient ? 'Returning Client Found' : 'New Client Registration'}</p>
                    <p style={{ margin: 0, fontSize: 13, color: 'rgba(26,26,26,0.8)' }}>{isReturningClient ? `Welcome back! Found ${matchingHistory.length} previous visits.` : 'No previous records found.'}</p>
                  </div>
                  {isReturningClient && (
                    <button type="button" onClick={() => setShowHistoryModal(true)} style={{ backgroundColor: GOLD, color: WHITE, border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>HISTORY</button>
                  )}
                </div>
              )}
            </Section>

            <Section title="Body Focus Areas (Optional)" note="Tap diagram or select from list">
              <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: '1 1 400px', position: 'relative', maxWidth: 500, margin: '0 auto' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/muscular-body.png" alt="Anatomy" style={{ width: '100%', height: 'auto', display: 'block' }} />
                  {INTERACTIVE_ZONES.map((zone) => (
                    <button
                      key={`map-${zone.id}`}
                      type="button"
                      onClick={() => toggleArea(zone.id)}
                      style={{
                        position: 'absolute',
                        top: zone.top,
                        left: zone.left,
                        width: zone.width,
                        height: zone.height,
                        backgroundColor: selectedAreas.has(zone.id) ? 'rgba(197,143,59,0.5)' : 'transparent',
                        border: `2px solid ${selectedAreas.has(zone.id) ? GOLD : 'transparent'}`,
                        borderRadius: '16px',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                </div>
                <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
                  {INTERACTIVE_ZONES.map(zone => (
                    <button
                      key={`list-${zone.id}`}
                      type="button"
                      onClick={() => toggleArea(zone.id)}
                      style={{
                        padding: '14px 16px',
                        backgroundColor: selectedAreas.has(zone.id) ? 'rgba(197,143,59,0.08)' : WHITE,
                        border: `1px solid ${selectedAreas.has(zone.id) ? GOLD : 'rgba(26,26,26,0.13)'}`,
                        borderRadius: 10,
                        display: 'flex',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        ...TEXT_FORMAT
                      }}
                    >
                      {zone.id}
                      {selectedAreas.has(zone.id) && <span style={{ color: GOLD }}>✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            </Section>

            <Section title="Health Conditions (Optional)">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                {HEALTH_CONDITIONS_LIST.map(cond => (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => toggleCondition(cond)}
                    style={{
                      padding: '14px 16px',
                      backgroundColor: selectedConditions.has(cond) ? 'rgba(197,143,59,0.08)' : WHITE,
                      border: `1px solid ${selectedConditions.has(cond) ? GOLD : 'rgba(26,26,26,0.13)'}`,
                      borderRadius: 10,
                      display: 'flex',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      ...TEXT_FORMAT
                    }}
                  >
                    {cond}
                    {selectedConditions.has(cond) && <span style={{ color: GOLD }}>✓</span>}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Acknowledgement">
              <div style={{ display: 'flex', gap: 14, cursor: 'pointer' }} onClick={() => setAgreed(!agreed)}>
                <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${agreed ? GOLD : '#ccc'}`, backgroundColor: agreed ? GOLD : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {agreed && <svg width="14" height="14" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke={WHITE} strokeWidth="2" strokeLinecap="round" /></svg>}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(26,26,26,0.7)', lineHeight: 1.6 }}>
                  I understand that the treatment is for relaxation and wellness only, and not a form of medical treatment. I confirm that I have disclosed all relevant medical conditions, and I take full responsibility for any undisclosed or unknown conditions that may be affected during or after the treatment. I acknowledge that Sabbath Spa and its staff shall not be held liable for any injury, allergic reaction, illness, or other medical issue that may occur during or after the session. I agree that any complaints must be made within 24 hours of service. I also understand that Sabbath Spa may refuse or stop service at any time for health or safety reasons, or in the event of inappropriate behavior. I agree to communicate immediately if I feel any discomfort so that the pressure or strokes can be adjusted. I understand that any inappropriate, illicit, or sexually suggestive motion will result in the immediate termination of the session. I also agree to refrain from consuming alcohol, drugs, or smoking before or during my appointment. I authorize Sabbath Spa to collect, use, store, and process my personal data for service, records, and communication, including the use of trusted third-party platforms and tools (such as AI-assisted systems), in accordance with the Data Privacy Act of 2012.
                </p>
              </div>
            </Section>

            <Section title="Signature & Date" note="Please sign and verify the date">
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 350px' }}>
                  <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    style={{
                      border: '1px solid #ddd',
                      borderRadius: 12,
                      backgroundColor: '#fafafa',
                      width: '100%',
                      height: 200,
                      cursor: 'crosshair'
                    }}
                  />
                  <button
                    type="button"
                    onClick={clearSignature}
                    style={{
                      float: 'right',
                      marginTop: 8,
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '6px 12px',
                      cursor: 'pointer',
                      border: 'none',
                      background: 'transparent'
                    }}
                  >
                    CLEAR SIGNATURE
                  </button>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={LABEL}>Date Signed</label>
                  <div style={{
                    ...INPUT,
                    backgroundColor: '#F0F0F0',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'rgba(0,0,0,0.5)',
                    fontWeight: 600
                  }}>
                    {today}
                  </div>
                </div>
              </div>
            </Section>

            <button
              type="submit"
              disabled={loading}
              style={{
                height: 60,
                backgroundColor: BLACK,
                color: GOLD,
                border: 'none',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {loading ? 'Processing...' : 'Confirm & Sign'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}