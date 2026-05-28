'use client'
export const dynamic = 'force-dynamic'

import { useState, useRef, useCallback, useEffect, FormEvent } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import AnatomicalMap from '@/components/ui/AnatomicalMap'

const F = {
  bg: '#F9F4EB', white: '#FFFFFF', black: '#1A1A1A', gold: '#C58F3B',
  goldBorder: 'rgba(197,143,59,0.28)', border: 'rgba(26,26,26,0.13)',
  muted: '#7A6E65', faint: 'rgba(26,26,26,0.36)', danger: '#8B3A3A',
  dangerBg: 'rgba(139,58,58,0.10)', display: "'Cormorant Garamond', Georgia, serif",
  body: "'Inter', system-ui, sans-serif",
} as const

const INPUT: React.CSSProperties = {
  display: 'block', width: '100%', height: 54, padding: '0 15px',
  backgroundColor: F.white, border: `1px solid ${F.border}`, borderRadius: 10,
  fontSize: 16, color: F.black, fontFamily: F.body, outline: 'none'
}

const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.13em',
  textTransform: 'uppercase', color: F.muted, marginBottom: 7, fontFamily: F.body,
}

const CONDITIONS = [
  { key: 'stress', label: 'Stress' }, { key: 'high_bp', label: 'High Blood Pressure' },
  { key: 'heart', label: 'Heart Issues' }, { key: 'arthritis', label: 'Arthritis' },
  { key: 'diabetes', label: 'Diabetes' }, { key: 'epilepsy', label: 'Epilepsy' },
  { key: 'osteo', label: 'Osteoporosis' }, { key: 'swelling', label: 'Joint Swelling' },
  { key: 'numbness', label: 'Numbness' }, { key: 'allergies', label: 'Allergies' },
  { key: 'pregnancy', label: 'Pregnancy', hasWeeks: true }, { key: 'contagious', label: 'Contagious Diseases' },
  { key: 'surgeries', label: 'Surgeries' }, { key: 'depression', label: 'Depression / Anxiety' },
  { key: 'migraines', label: 'Migraines' }, { key: 'injuries', label: 'Injuries' },
  { key: 'skin', label: 'Skin Sensitivities' }, { key: 'back_pain', label: 'Back Pain' },
  { key: 'none', label: 'None of the above' },
] as const

type CondKey = typeof CONDITIONS[number]['key']
type ClientStatus = 'idle' | 'checking' | 'new' | 'returning'
interface ClientInfo { status: ClientStatus; visits?: number; name?: string }

function ClientBadge({ info }: { info: ClientInfo }) {
  if (info.status === 'idle') return null
  if (info.status === 'checking') return <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', backgroundColor: 'rgba(26,26,26,0.05)', borderRadius: 9, fontSize: 13, color: 'rgba(26,26,26,0.50)' }}>Looking up client record…</div>
  if (info.status === 'new') return <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', backgroundColor: 'rgba(61,122,74,0.10)', border: '1px solid rgba(61,122,74,0.28)', borderRadius: 9 }}><span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#3D7A4A' }} /><span style={{ fontSize: 13, fontWeight: 600, color: '#3D7A4A' }}>New Client</span></div>
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', backgroundColor: 'rgba(197,143,59,0.11)', border: '1px solid rgba(197,143,59,0.35)', borderRadius: 9 }}><span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: F.gold }} /><span style={{ fontSize: 13, fontWeight: 600, color: F.gold }}>Returning Client</span><span style={{ fontSize: 12, color: 'rgba(197,143,59,0.80)' }}>{info.name ? `— ${info.name}` : ''} {info.visits && info.visits > 1 && `(${info.visits} visits)`}</span></div>
}

function SignaturePad({ onChange, hasError }: { onChange: (url: string | null) => void; hasError?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const hasLines = useRef(false)

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const dpr = window.devicePixelRatio || 1; const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr); ctx.strokeStyle = F.black; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  }, [])

  const pos = (e: { clientX: number; clientY: number }, el: HTMLCanvasElement) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
  const start = (x: number, y: number) => { const ctx = ref.current?.getContext('2d'); if (!ctx) return; drawing.current = true; last.current = { x, y }; ctx.beginPath(); ctx.moveTo(x, y) }
  const move = (x: number, y: number) => { if (!drawing.current || !last.current) return; const ctx = ref.current?.getContext('2d'); if (!ctx) return; ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(x, y); ctx.stroke(); last.current = { x, y }; hasLines.current = true }
  const stop = () => { if (!drawing.current) return; drawing.current = false; last.current = null; if (hasLines.current && ref.current) onChange(ref.current.toDataURL('image/png')) }
  const clear = () => { const canvas = ref.current; const ctx = canvas?.getContext('2d'); if (!ctx || !canvas) return; const dpr = window.devicePixelRatio || 1; const rect = canvas.getBoundingClientRect(); ctx.clearRect(0, 0, rect.width * dpr, rect.height * dpr); hasLines.current = false; onChange(null) }

  return (
    <div style={{ touchAction: 'none' }}>
      <div style={{ position: 'relative', border: `1.5px solid ${hasError ? 'rgba(139,58,58,0.60)' : F.goldBorder}`, borderRadius: 12, backgroundColor: '#FDFCF8', overflow: 'hidden', boxShadow: hasError ? '0 0 0 3px rgba(139,58,58,0.10)' : 'none' }}>
        <div style={{ position: 'absolute', bottom: 36, left: 24, right: 24, height: 1, backgroundColor: 'rgba(197,143,59,0.22)' }} />
        <div style={{ position: 'absolute', bottom: 42, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(197,143,59,0.28)' }}>Sign here</div>
        <canvas ref={ref} style={{ display: 'block', width: '100%', height: 200, cursor: 'crosshair', touchAction: 'none' }} onMouseDown={e => { start(pos(e.nativeEvent, e.currentTarget).x, pos(e.nativeEvent, e.currentTarget).y) }} onMouseMove={e => { move(pos(e.nativeEvent, e.currentTarget).x, pos(e.nativeEvent, e.currentTarget).y) }} onMouseUp={stop} onMouseLeave={stop} onTouchStart={e => { e.preventDefault(); start(pos(e.touches[0], e.currentTarget).x, pos(e.touches[0], e.currentTarget).y) }} onTouchMove={e => { e.preventDefault(); move(pos(e.touches[0], e.currentTarget).x, pos(e.touches[0], e.currentTarget).y) }} onTouchEnd={stop} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 12, color: F.faint }}>Use finger, stylus, or mouse</span>
        <button type="button" onClick={clear} style={{ background: 'none', border: `1px solid ${F.goldBorder}`, borderRadius: 7, padding: '4px 14px', fontSize: 10, fontWeight: 700, color: F.gold, cursor: 'pointer' }}>Clear</button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <div style={{ backgroundColor: F.white, border: `1px solid rgba(26,26,26,0.09)`, borderRadius: 16, padding: 'clamp(20px,3vw,26px)', display: 'flex', flexDirection: 'column', gap: 16 }}><div style={{ display: 'flex', alignItems: 'center', paddingBottom: 12, borderBottom: `1px solid rgba(197,143,59,0.14)` }}><h2 style={{ fontFamily: F.display, fontSize: 21, fontWeight: 400, color: F.black, margin: 0 }}>{title}</h2></div>{children}</div> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div style={{ display: 'flex', flexDirection: 'column' }}><label style={LABEL}>{label}</label>{children}</div> }
function Row2({ children }: { children: React.ReactNode }) { return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, alignItems: 'end' }}>{children}</div> }

export default function WaiverPage() {
  const supabaseRef = useRef<SupabaseClient | null>(null)
  if (!supabaseRef.current) { supabaseRef.current = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!) }
  const supabase = supabaseRef.current

  const [submitted, setSubmitted] = useState(false); const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [signatureImg, setSignatureImg] = useState<string | null>(null); const [attempted, setAttempted] = useState(false)
  const [lookupQuery, setLookupQuery] = useState(''); const [clientInfo, setClientInfo] = useState<ClientInfo>({ status: 'idle' })
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lookupClient = useCallback(async (query: string) => {
    const clean = query.trim(); if (clean.length < 3) { setClientInfo({ status: 'idle' }); return }
    setClientInfo({ status: 'checking' })
    try {
      const isPhone = /^[\d\s+\-()]+$/.test(clean)
      let orQuery = `client_name.ilike.%${clean}%`
      if (isPhone) orQuery = `client_mobile.ilike.%${clean.replace(/\D/g, '')}%,client_name.ilike.%${clean}%`
      const { data, count, error } = await supabase.from('bookings').select('id, client_name', { count: 'exact' }).or(orQuery).order('created_at', { ascending: false }).limit(1)
      if (error || !data || data.length === 0) setClientInfo({ status: 'new' })
      else setClientInfo({ status: 'returning', visits: count ?? 1, name: data[0].client_name })
    } catch { setClientInfo({ status: 'new' }) }
  }, [supabase])

  function handleLookupChange(val: string) { setLookupQuery(val); setClientInfo({ status: 'idle' }); if (lookupTimer.current) clearTimeout(lookupTimer.current); lookupTimer.current = setTimeout(() => lookupClient(val), 800) }

  const [form, setForm] = useState({ name: '', mobile: '', email: '', targetBodyParts: [] as string[], conditions: [] as CondKey[], agreed: false, signatureDate: new Date().toISOString().split('T')[0], therapistName: '' })
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => { const t = e.target; setForm(p => ({ ...p, [field]: t.type === 'checkbox' ? t.checked : t.value })) }

  const toggleCondition = (key: CondKey) => setForm(p => {
    if (key === 'none') return { ...p, conditions: p.conditions.includes('none') ? [] : ['none' as CondKey] }
    const withoutNone = p.conditions.filter(k => k !== 'none')
    return { ...p, conditions: withoutNone.includes(key) ? withoutNone.filter(k => k !== key) : [...withoutNone, key] }
  })

  const validation = { name: form.name.trim().length < 2, mobile: form.mobile.trim().length < 6, agreed: !form.agreed, signature: !signatureImg }
  const canSubmit = !Object.values(validation).some(Boolean)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setAttempted(true); if (!canSubmit) return; setLoading(true); setSubmitError(null)
    try {
      const { error } = await supabase.from('waivers').insert({
        client_name: form.name.trim(),
        client_mobile: form.mobile.trim(),
        target_body_parts: form.targetBodyParts,
        health_conditions: form.conditions,
        agreed_to_terms: form.agreed,
        signature_data_url: signatureImg,
        signature_date: form.signatureDate,
        therapist_name: form.therapistName.trim() || null
      })
      if (error) throw new Error(error.message)
      setSubmitted(true)
    } catch (err: any) { setSubmitError(`Error: ${err.message}. Please check if your 'waivers' table exists!`) }
    finally { setLoading(false) }
  }

  if (submitted) return (
    <div style={{ backgroundColor: F.bg, minHeight: '100dvh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <h2 style={{ fontFamily: F.display, fontSize: 30, color: F.gold }}>Waiver Submitted Successfully</h2>
    </div>
  )

  return (
    <div style={{ backgroundColor: F.bg, minHeight: '100dvh', padding: '40px 20px', fontFamily: F.body }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Section title="Client Lookup">
          <Field label="Search by Name or Mobile Number">
            <input className="w-in" style={INPUT} type="text" value={lookupQuery} onChange={e => handleLookupChange(e.target.value)} placeholder="Maria Santos or 09XX XXX XXXX" />
          </Field>
          <ClientBadge info={clientInfo} />
        </Section>

        <Section title="Client Information">
          <Field label="Full Name *"><input className="w-in" style={{ ...INPUT, borderColor: attempted && validation.name ? F.danger : F.border }} value={form.name} onChange={set('name')} placeholder="Maria Santos" /></Field>
          <Row2>
            <Field label="Mobile Number *"><input className="w-in" style={{ ...INPUT, borderColor: attempted && validation.mobile ? F.danger : F.border }} type="tel" value={form.mobile} onChange={set('mobile')} placeholder="+63 9XX XXX XXXX" /></Field>
            <Field label="Email Address"><input className="w-in" style={INPUT} type="email" value={form.email} onChange={set('email')} placeholder="Optional" /></Field>
          </Row2>
        </Section>

        <Section title="Body Focus Areas">
          <AnatomicalMap selectedParts={form.targetBodyParts} onChange={parts => setForm(p => ({ ...p, targetBodyParts: parts }))} />
        </Section>

        <Section title="Health Conditions">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
            {CONDITIONS.map(c => (
              <label key={c.key} style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', padding: '8px', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 8 }}>
                <input type="checkbox" checked={form.conditions.includes(c.key)} readOnly style={{ width: 18, height: 18, accentColor: F.gold }} />
                {c.label}
              </label>
            ))}
          </div>
        </Section>

        <Section title="Acknowledgment & Consent">
          <div style={{ backgroundColor: '#F8F6F0', border: `1px solid rgba(197,143,59,0.16)`, borderRadius: 10, padding: '18px 20px', fontSize: 13, color: '#3A3530', lineHeight: 1.82, maxHeight: 200, overflowY: 'auto' }}>
            <p style={{ margin: '0 0 10px', fontWeight: 700, color: F.black, fontSize: 14 }}>Sabbath Spa &amp; Wellness Hub — Waiver &amp; Consent Form</p>
            <ol style={{ margin: '0 0 12px', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <li>I confirm that all health information provided is accurate.</li>
              <li>I understand treatments are for relaxation, not medical diagnosis.</li>
              <li>I voluntarily consent to receive massage therapy.</li>
              <li>I release Sabbath Spa from liability for adverse reactions.</li>
            </ol>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 14, border: `1px solid ${attempted && validation.agreed ? F.danger : F.goldBorder}`, borderRadius: 10, cursor: 'pointer', backgroundColor: attempted && validation.agreed ? F.dangerBg : 'transparent' }}>
            <input type="checkbox" checked={form.agreed} onChange={set('agreed')} style={{ width: 22, height: 22, accentColor: F.gold }} />
            <span style={{ fontSize: 14, color: '#2A2A2A', lineHeight: 1.65 }}>I have read and <strong>fully agree</strong> to the Waiver &amp; Consent above. <span style={{ color: F.gold }}>*</span></span>
          </label>
        </Section>

        <Section title="Client Signature">
          <SignaturePad onChange={setSignatureImg} hasError={attempted && validation.signature} />
          <Row2>
            <Field label="Date Signed"><input className="w-in" style={INPUT} type="date" value={form.signatureDate} onChange={set('signatureDate')} /></Field>
            <Field label="Therapist (staff completes)"><input className="w-in" style={INPUT} value={form.therapistName} onChange={set('therapistName')} placeholder="Assigned therapist" /></Field>
          </Row2>
        </Section>

        {submitError && <div style={{ padding: 15, backgroundColor: F.dangerBg, color: F.danger, borderRadius: 10, textAlign: 'center', fontWeight: 600 }}>{submitError}</div>}

        <button onClick={handleSubmit} disabled={loading} style={{ height: 56, backgroundColor: F.black, color: F.gold, borderRadius: 10, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', border: 'none', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Submitting...' : 'Submit Waiver'}
        </button>
      </div>
    </div>
  )
}