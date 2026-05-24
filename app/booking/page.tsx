'use client'

// app/booking/page.tsx  —  Phase 2 Booking Engine
// STRICT LIVE DATABASE CONNECTION (No Fallbacks)

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef, FormEvent } from 'react'
import Image from 'next/image'
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
const CARET = `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23C58F3B' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`

const INPUT: React.CSSProperties = {
  display: 'block', width: '100%', height: 54,
  padding: '0 15px',
  backgroundColor: WHITE, backgroundImage: 'none',
  border: '1px solid rgba(26,26,26,0.14)',
  borderRadius: 10, fontSize: 16, color: BLACK,
  fontFamily: BODY, lineHeight: 1,
  appearance: 'none', WebkitAppearance: 'none',
  boxSizing: 'border-box', outline: 'none',
  transition: 'border-color 180ms ease, box-shadow 180ms ease',
}

const SELECT: React.CSSProperties = {
  ...INPUT,
  paddingRight: 42,
  backgroundImage: CARET,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  cursor: 'pointer',
}

const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.13em', textTransform: 'uppercase',
  color: 'rgba(26,26,26,0.50)', marginBottom: 7, fontFamily: BODY,
}

// ─────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ─────────────────────────────────────────────────────────────
interface ServiceItem { id: string; name: string; duration: string; price: number; category: string }
interface Therapist { id: string; name: string; status: string }
type ClientStatus = 'idle' | 'checking' | 'new' | 'returning'
interface ClientInfo { status: ClientStatus; visits?: number; name?: string; pastServices?: string[] }

const fmt = (n: number) => '₱' + n.toLocaleString('en-PH')

const PAYMENT_METHODS = [
  {
    key: 'gcash', label: 'GCash',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="1" y="1" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.5" /><path d="M12.5 8H10a2 2 0 1 0 0 4h2.5v-2H10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  },
  {
    key: 'bank', label: 'Bank Transfer',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M2 8.5L10 3l8 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><rect x="3" y="9" width="3" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.4" /><rect x="8.5" y="9" width="3" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.4" /><rect x="14" y="9" width="3" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.4" /><path d="M1.5 16.5h17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
  },
  {
    key: 'mastercard', label: 'Mastercard',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="1" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" /><circle cx="7.5" cy="10" r="3" stroke="currentColor" strokeWidth="1.3" /><circle cx="12.5" cy="10" r="3" stroke="currentColor" strokeWidth="1.3" /></svg>
  },
  {
    key: 'cash', label: 'Cash',
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="1" y="5" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" /><circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.3" /><path d="M4.5 10h.3M15.2 10h.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
  },
]

const TIME_SLOTS = [
  '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
  '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
  '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM',
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column' }}><label style={LABEL}>{label}</label>{children}</div>
}

function Row2({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, alignItems: 'end' }}>{children}</div>
}

function ClientBadge({ info }: { info: ClientInfo }) {
  if (info.status === 'idle') return null
  if (info.status === 'checking') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', backgroundColor: 'rgba(26,26,26,0.05)', borderRadius: 9, fontSize: 13, color: 'rgba(26,26,26,0.50)', fontFamily: BODY }}>
      Checking client records…
    </div>
  )
  if (info.status === 'new') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', backgroundColor: 'rgba(61,122,74,0.10)', border: '1px solid rgba(61,122,74,0.28)', borderRadius: 9 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#3D7A4A', fontFamily: BODY }}>New Client</span>
      <span style={{ fontSize: 12, color: 'rgba(61,122,74,0.70)', fontFamily: BODY }}>— welcome to Sabbath Spa!</span>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', backgroundColor: 'rgba(197,143,59,0.11)', border: '1px solid rgba(197,143,59,0.35)', borderRadius: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: GOLD, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: GOLD, fontFamily: BODY }}>Returning Client</span>
        <span style={{ fontSize: 13, color: 'rgba(197,143,59,0.90)', fontFamily: BODY }}>
          {info.name ? `— ${info.name}` : ''} ({info.visits} visits)
        </span>
      </div>
      {info.pastServices && info.pastServices.length > 0 && (
        <div style={{ paddingLeft: 16, fontSize: 11, color: 'rgba(197,143,59,0.75)', fontFamily: BODY }}>
          <strong>Previously Availed:</strong> {info.pastServices.join(' · ')}
        </div>
      )}
    </div>
  )
}

function ServiceChip({ item, selected, onToggle }: { item: ServiceItem; selected: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '13px 15px',
      backgroundColor: selected ? 'rgba(197,143,59,0.10)' : WHITE,
      border: `1.5px solid ${selected ? GOLD : 'rgba(26,26,26,0.13)'}`,
      borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 160ms ease',
      boxShadow: selected ? '0 2px 10px rgba(197,143,59,0.18)' : 'none', position: 'relative',
    }}>
      {selected && (
        <span style={{ position: 'absolute', top: 8, right: 9, width: 18, height: 18, borderRadius: '50%', backgroundColor: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke={BLACK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      )}
      <span style={{ fontSize: 14, fontWeight: 600, color: selected ? BLACK : 'rgba(26,26,26,0.75)', fontFamily: BODY, lineHeight: 1.3, paddingRight: 20 }}>{item.name}</span>
      <span style={{ fontSize: 12, color: 'rgba(26,26,26,0.40)', fontFamily: BODY }}>{item.duration} · {fmt(item.price)}</span>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function BookingPage() {
  const supabaseRef = useRef<SupabaseClient | null>(null)
  if (!supabaseRef.current) {
    supabaseRef.current = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  const supabase = supabaseRef.current

  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [lookupQuery, setLookupQuery] = useState('')
  const [clientInfo, setClientInfo] = useState<ClientInfo>({ status: 'idle' })
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')

  const [dbServices, setDbServices] = useState<ServiceItem[]>([])
  const [servicesLoad, setServicesLoad] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [date, setDate] = useState('')
  const [minApptDate, setMinApptDate] = useState('')
  const [time, setTime] = useState('')
  const [therapistId, setTherapistId] = useState('')
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [therapistLoad, setTherapistLoad] = useState(true)
  const [payMethod, setPayMethod] = useState('')
  const [notes, setNotes] = useState('')

  // ── STRICT LIVE DATA FETCHING ──────────────────────────────────
  useEffect(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    setMinApptDate(d.toISOString().split('T')[0])

    async function loadData() {
      try {
        const [thRes, svRes] = await Promise.all([
          supabase.from('therapists').select('*').order('name', { ascending: true }),
          supabase.from('services').select('*') // Grabs exactly what is in your database
        ])

        if (thRes.data) {
          setTherapists(thRes.data.map(t => ({ id: String(t.id), name: t.name || t.therapist_name || 'Staff', status: t.status })))
        }

        if (svRes.data && svRes.data.length > 0) {
          const mappedServices = svRes.data.map(s => ({
            id: String(s.id),
            // Flexibly checks for standard column names you might be using
            name: String(s.service_name || s.name || s.service || 'Unnamed Service'),
            duration: String(s.duration || '60 min'),
            price: Number(s.price || s.amount || 0),
            category: String(s.category || s.type || 'Massage')
          }))
          setDbServices(mappedServices)
        } else {
          console.warn("No services returned. Please check if your 'services' table has Row Level Security (RLS) blocking public read access.")
        }
      } catch (err) {
        console.error("Supabase fetch failed:", err)
      } finally {
        setTherapistLoad(false)
        setServicesLoad(false)
      }
    }
    loadData()
  }, [supabase])

  const massageServices = dbServices.filter(s => s.category?.toLowerCase().includes('massage') || s.category?.toLowerCase().includes('therapy') || s.category?.toLowerCase().includes('body'))
  const nailServices = dbServices.filter(s => s.category?.toLowerCase().includes('nail') || s.category?.toLowerCase().includes('le') || s.category?.toLowerCase().includes('hands') || s.category?.toLowerCase().includes('feet'))

  // Catch any uncategorized ones and push them to the main list
  const assignedIds = new Set([...massageServices.map(s => s.id), ...nailServices.map(s => s.id)])
  const unassigned = dbServices.filter(s => !assignedIds.has(s.id))
  massageServices.push(...unassigned)

  // ── Smart Client Lookup ────────────────────────────────────
  const lookupClient = useCallback(async (query: string) => {
    const clean = query.trim()
    if (clean.length < 3) { setClientInfo({ status: 'idle' }); return }

    setClientInfo({ status: 'checking' })
    try {
      const isPhone = /^[\d\s+\-()]+$/.test(clean)
      let orQuery = `client_name.ilike.%${clean}%`
      if (isPhone) {
        const numOnly = clean.replace(/\D/g, '')
        orQuery = `client_mobile.ilike.%${numOnly}%,mobile.ilike.%${numOnly}%,client_name.ilike.%${clean}%`
      }

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .or(orQuery)
        .order('created_at', { ascending: false })

      if (error || !data || data.length === 0) {
        setClientInfo({ status: 'new' }); return
      }

      setName(data[0].client_name || '')
      if (data[0].client_mobile) setMobile(data[0].client_mobile)
      if (data[0].client_email) setEmail(data[0].client_email)

      const pastSet = new Set<string>()
      data.forEach(b => {
        if (b.service_name) pastSet.add(b.service_name)
        if (b.services && Array.isArray(b.services)) b.services.forEach((s: string) => pastSet.add(s))
      })
      const pastArr = Array.from(pastSet).slice(0, 3)

      setClientInfo({
        status: 'returning',
        visits: data.length,
        name: data[0].client_name,
        pastServices: pastArr
      })
    } catch {
      setClientInfo({ status: 'new' })
    }
  }, [supabase])

  function handleLookupChange(val: string) {
    setLookupQuery(val)
    setClientInfo({ status: 'idle' })
    if (lookupTimer.current) clearTimeout(lookupTimer.current)
    lookupTimer.current = setTimeout(() => lookupClient(val), 800)
  }

  function toggleService(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedServices = dbServices.filter(s => selectedIds.has(s.id))
  const totalAmount = selectedServices.reduce((a, s) => a + Number(s.price || 0), 0)

  const validation = {
    name: name.trim().length < 2,
    mobile: mobile.trim().length < 7,
    services: selectedIds.size === 0,
    date: date === '',
    time: time === '',
    therapist: false, // Optional for booking
    payment: payMethod === '',
  }
  const isValid = !Object.values(validation).some(Boolean)
  const eb = (hasErr: boolean): React.CSSProperties => attempted && hasErr ? { borderColor: 'rgba(139,58,58,0.65)', boxShadow: '0 0 0 3px rgba(139,58,58,0.10)' } : {}

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setAttempted(true)
    if (!isValid) return
    setLoading(true); setSubmitError(null)

    const selectedTherapist = therapists.find(t => t.id === therapistId)

    try {
      const { error: dbErr } = await supabase.from('bookings').insert({
        client_name: name.trim(),
        client_mobile: mobile.trim(),
        client_email: email.trim() || null,
        services: selectedServices.map(s => s.name),
        service_name: selectedServices.map(s => s.name).join(', '),
        amount: totalAmount,
        therapist_id: therapistId || null,
        therapist_name: selectedTherapist?.name ?? null,
        appointment_date: date,
        appointment_time: time,
        payment_method: payMethod,
        is_new_client: clientInfo.status === 'new',
        status: 'upcoming',
        notes: notes.trim() || null,
      })
      if (dbErr) throw new Error(dbErr.message)
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed.')
    } finally { setLoading(false) }
  }

  if (submitted) return (
    <div style={{ backgroundColor: BG, minHeight: '100dvh', padding: '100px 20px', textAlign: 'center', fontFamily: BODY }}>
      <div style={{ fontSize: 44, color: GOLD, marginBottom: 22 }}>✦</div>
      <h2 style={{ fontFamily: DSP, fontSize: 40, color: BLACK, margin: '0 0 14px' }}>Booking Received</h2>
      <p style={{ color: 'rgba(26,26,26,0.55)', fontSize: 16, maxWidth: 380, margin: '0 auto 36px' }}>Thank you, <strong style={{ color: BLACK }}>{name}</strong>. We'll confirm your appointment on <strong style={{ color: BLACK }}>{date}</strong> at <strong style={{ color: BLACK }}>{time}</strong> via SMS shortly.</p>
    </div>
  )

  return (
    <>
      <style>{`
        .bk-in:focus{border-color:${GOLD}!important;box-shadow:0 0 0 3px rgba(197,143,59,0.18)!important;}
        .bk-in:hover:not(:focus){border-color:rgba(197,143,59,0.45)!important;}
      `}</style>

      <div style={{ backgroundColor: BG, minHeight: '100dvh', padding: '40px 20px', fontFamily: BODY }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.20em', color: GOLD, margin: '0 0 10px', textTransform: 'uppercase' }}>Reserve Your Visit</p>
            <h1 style={{ fontFamily: DSP, fontSize: 40, color: BLACK, margin: '0 0 8px', lineHeight: 1.1 }}>Book a Session</h1>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }} noValidate>

            <Section title="Client Information">
              <Field label="Search by Name or Mobile Number">
                <input className="bk-in" style={INPUT} type="text" value={lookupQuery} onChange={e => handleLookupChange(e.target.value)} placeholder="Maria Santos or 09XX XXX XXXX" />
              </Field>
              <ClientBadge info={clientInfo} />

              <Field label="Full Name *">
                <input className="bk-in" style={{ ...INPUT, ...eb(validation.name) }} value={name} onChange={e => setName(e.target.value)} placeholder="Maria Santos" />
              </Field>
              <Row2>
                <Field label="Mobile Number *">
                  <input className="bk-in" style={{ ...INPUT, ...eb(validation.mobile) }} type="tel" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="+63 9XX XXX XXXX" />
                </Field>
                <Field label="Email Address">
                  <input className="bk-in" style={INPUT} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Optional" />
                </Field>
              </Row2>
            </Section>

            <Section title="Select Services" note={selectedIds.size > 0 ? `${selectedIds.size} selected · ${fmt(totalAmount)} total` : 'Choose one or more'}>
              {servicesLoad ? (
                <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.5)', fontStyle: 'italic' }}>Loading live services from database...</p>
              ) : dbServices.length === 0 ? (
                <div style={{ backgroundColor: 'rgba(139,58,58,0.05)', padding: 16, borderRadius: 8, border: '1px solid rgba(139,58,58,0.2)' }}>
                  <p style={{ color: '#8B3A3A', fontSize: 14, margin: 0, fontWeight: 600 }}>No services found in database.</p>
                  <p style={{ color: '#8B3A3A', fontSize: 12, margin: '4px 0 0 0' }}>If your Supabase table has data, please ensure <strong>Row Level Security (RLS)</strong> is configured to allow public reads for the `services` table.</p>
                </div>
              ) : (
                <>
                  {massageServices.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, marginBottom: 12 }}>Massage Therapy</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(220px,100%),1fr))', gap: 10 }}>
                        {massageServices.map(s => <ServiceChip key={s.id} item={s} selected={selectedIds.has(s.id)} onToggle={() => toggleService(s.id)} />)}
                      </div>
                    </div>
                  )}

                  {nailServices.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, marginBottom: 12 }}>Le Nails</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(220px,100%),1fr))', gap: 10 }}>
                        {nailServices.map(s => <ServiceChip key={s.id} item={s} selected={selectedIds.has(s.id)} onToggle={() => toggleService(s.id)} />)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </Section>

            <Section title="Appointment Details">
              <Row2>
                <Field label="Preferred Date *">
                  <input suppressHydrationWarning className="bk-in" type="date" min={minApptDate} style={{ ...INPUT, ...eb(validation.date) }} value={date} onChange={e => setDate(e.target.value)} />
                </Field>
                <Field label="Preferred Time *">
                  <select className="bk-in" style={{ ...SELECT, ...eb(validation.time) }} value={time} onChange={e => setTime(e.target.value)}>
                    <option value="">Select time…</option>
                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
              </Row2>
              <Field label={therapistLoad ? 'Therapist (loading…)' : `Therapist`}>
                <select className="bk-in" style={SELECT} value={therapistId} onChange={e => setTherapistId(e.target.value)}>
                  <option value="">Choose your therapist (optional)…</option>
                  {therapists.map(t => <option key={t.id} value={t.id}>{t.name}{t.status ? ` (${t.status})` : ''}</option>)}
                </select>
              </Field>
            </Section>

            <Section title="Payment Method">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(140px,100%),1fr))', gap: 10 }}>
                {PAYMENT_METHODS.map(pm => {
                  const sel = payMethod === pm.key
                  return (
                    <button key={pm.key} type="button" onClick={() => setPayMethod(pm.key)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px 10px', backgroundColor: sel ? BLACK : WHITE, border: `1.5px solid ${sel ? BLACK : 'rgba(26,26,26,0.13)'}`, borderRadius: 12, cursor: 'pointer', color: sel ? GOLD : 'rgba(26,26,26,0.50)', transition: 'all 180ms ease' }}>
                      {pm.icon}
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{pm.label}</span>
                    </button>
                  )
                })}
              </div>
            </Section>

            <Section title="Additional Notes" note="optional">
              <textarea className="bk-in" style={{ ...INPUT, height: 'auto', minHeight: 100, padding: '13px 15px', resize: 'vertical', lineHeight: 1.65 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Allergies, special requests…" />
            </Section>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button type="submit" disabled={loading || !isValid} style={{ height: 58, backgroundColor: BLACK, color: GOLD, border: '1px solid rgba(197,143,59,0.35)', borderRadius: 11, fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', opacity: loading || !isValid ? 0.4 : 1 }}>
                {loading ? 'Sending request…' : `Confirm Booking${totalAmount > 0 ? ` · ${fmt(totalAmount)}` : ''}`}
              </button>
            </div>

          </form>
        </div>
      </div>
    </>
  )
}