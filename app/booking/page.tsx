'use client'

// app/booking/page.tsx  —  Phase 2 Booking Engine
// STRICT LIVE DATABASE CONNECTION (Memberships + Live Discounts + Smart Therapists)

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef, FormEvent } from 'react'
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
interface Therapist { id: string; name: string; status: string; role: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Discount { id: string; name: string; discount_percentage: number; code?: string; category: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Membership { id: string; client_name: string; client_mobile: string; client_email: string; membership_tier: string }

const fmt = (n: number) => '₱' + n.toLocaleString('en-PH')

const PAYMENT_METHODS = [
  { key: 'gcash', label: 'GCash', qrImage: '/qr-gcash.png', icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="1" y="1" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.5" /><path d="M12.5 8H10a2 2 0 1 0 0 4h2.5v-2H10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> },
  { key: 'maya', label: 'Maya', qrImage: '/qr-maya.png', icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="1" y="1" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.5" /><path d="M12.5 8H10a2 2 0 1 0 0 4h2.5v-2H10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> },
  { key: 'bank', label: 'Bank Transfer', qrImage: '/qr-qrph.png', icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M2 8.5L10 3l8 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><rect x="3" y="9" width="3" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.4" /><rect x="8.5" y="9" width="3" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.4" /><rect x="14" y="9" width="3" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.4" /><path d="M1.5 16.5h17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg> },
  { key: 'cash', label: 'Cash', qrImage: null, icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="1" y="5" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" /><circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.3" /><path d="M4.5 10h.3M15.2 10h.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg> },
]

const TIME_SLOTS = [
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
  '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
  '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM',
  '8:00 PM', '8:30 PM', '9:00 PM', '9:30 PM', '10:00 PM', '10:30 PM',
  '11:00 PM', '11:30 PM', '12:00 AM'
]

const TOP_SERVICES = ['COMBINATION', 'SWEDISH', 'SABBATH SIGNATURE', 'VENTOSA', 'AROMATHERAPY', 'HOT STONE']

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

function ServiceChip({ item, selected, onToggle, discountPct = 0 }: { item: ServiceItem; selected: boolean; onToggle: () => void; discountPct?: number }) {
  const actualPrice = discountPct > 0 ? item.price * (1 - discountPct / 100) : item.price;

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
      <span style={{ fontSize: 12, color: 'rgba(26,26,26,0.40)', fontFamily: BODY }}>
        {item.duration} · {discountPct > 0 ? (
          <>
            <s style={{ opacity: 0.6, marginRight: 4 }}>{fmt(item.price)}</s>
            <strong style={{ color: GOLD }}>{fmt(actualPrice)}</strong>
          </>
        ) : (
          fmt(item.price)
        )}
      </span>
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

  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')

  const [dbServices, setDbServices] = useState<ServiceItem[]>([])
  const [servicesLoad, setServicesLoad] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Database Arrays for Logic (Limits strictly disabled)
  const [dbDiscounts, setDbDiscounts] = useState<Discount[]>([])
  const [activeMemberships, setActiveMemberships] = useState<Membership[]>([])

  // Auto-detected Membership State
  const [detectedMembership, setDetectedMembership] = useState<Membership | null>(null)

  // Promo/Discount States
  const [promoInput, setPromoInput] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<Discount | null>(null)

  const [date, setDate] = useState('')
  const [minApptDate, setMinApptDate] = useState('')
  const [time, setTime] = useState('')

  const [therapistSearch, setTherapistSearch] = useState('')
  const [therapistId, setTherapistId] = useState('')
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [therapistLoad, setTherapistLoad] = useState(true)

  const [payMethod, setPayMethod] = useState('')
  const [notes, setNotes] = useState('')

  const getTodayStr = useCallback(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [])

  useEffect(() => {
    setMinApptDate(getTodayStr())

    async function loadData() {
      try {
        // Force unlimited fetch using .limit(10000) safety nets
        const [thRes, svRes, discRes, memRes] = await Promise.all([
          supabase.from('staff').select('*').order('name', { ascending: true }).limit(10000),
          supabase.from('services').select('*').limit(10000),
          supabase.from('discounts').select('*').eq('active', true).limit(10000),
          supabase.from('memberships').select('*').eq('status', 'Active').limit(10000)
        ])

        if (thRes.data) {
          setTherapists(thRes.data.map(t => ({
            id: String(t.id),
            name: t.name || t.therapist_name || 'Staff',
            status: t.status,
            role: t.role || t.specialty || 'Massage Therapist'
          })))
        }

        if (discRes.data) setDbDiscounts(discRes.data as Discount[])
        if (memRes.data) setActiveMemberships(memRes.data as Membership[])

        if (svRes.data && svRes.data.length > 0) {
          const mappedServices = svRes.data.map(s => {
            let rawName = String(s.service_name || s.name || s.service || 'Unnamed Service');
            if (rawName.toLowerCase() === 'gel polish') rawName = 'GEL POLISH';
            if (rawName.toLowerCase() === 'rhinestones') rawName = 'RHINESTONES';
            return {
              id: String(s.id),
              name: rawName,
              duration: String(s.duration || '60 min'),
              price: Number(s.price || s.amount || 0),
              category: String(s.category || s.type || 'Massage')
            };
          })
          setDbServices(mappedServices)
        }
      } catch (err) {
        console.error("Supabase fetch failed:", err)
      } finally {
        setTherapistLoad(false)
        setServicesLoad(false)
      }
    }
    loadData()
  }, [supabase, getTodayStr])

  // ─── LIVE AUTO-DETECT MEMBERSHIP ───
  useEffect(() => {
    if (!mobile && !email) {
      setDetectedMembership(null);
      return;
    }
    const found = activeMemberships.find(m =>
      (email && m.client_email && m.client_email.toLowerCase() === email.toLowerCase()) ||
      (mobile && m.client_mobile && mobile.length >= 10 && m.client_mobile.includes(mobile))
    );
    setDetectedMembership(found || null);
  }, [mobile, email, activeMemberships])

  const popularitySort = (a: ServiceItem, b: ServiceItem) => {
    const aUpper = a.name.toUpperCase(); const bUpper = b.name.toUpperCase();
    const aIndex = TOP_SERVICES.findIndex(t => aUpper.includes(t)); const bIndex = TOP_SERVICES.findIndex(t => bUpper.includes(t));
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1; if (bIndex !== -1) return 1;
    return 0;
  }

  // ─── SERVICE & THERAPIST FILTERING ───
  const validServices = dbServices.filter(s => s.name.toUpperCase() !== 'SOFT GEL')

  const NAIL_KEYWORDS = [
    'SOFT GEL NAIL EXTENSION', 'FULL SET BASIC NAIL ART', '3D GEL NAIL ART/EMBOSSED',
    'NAIL GEL REMOVER', 'SOFT GEL REMOVER', 'RHINESTONES', 'GEL POLISH',
    'ACCENT', 'POLISH', 'NAIL ART', 'GEL REMOVAL'
  ]

  const isNailService = (s: ServiceItem) => {
    const cat = s.category?.toLowerCase() || '';
    const nameUpper = s.name.toUpperCase();
    if (NAIL_KEYWORDS.some(keyword => nameUpper.includes(keyword))) return true;
    if (cat.includes('nail') || cat.includes('le') || cat.includes('hands') || cat.includes('feet')) return true;
    return false;
  }

  const nailServices = validServices.filter(isNailService).sort(popularitySort)
  const massageServices = validServices.filter(s => !isNailService(s)).sort(popularitySort)

  function toggleService(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedServices = validServices.filter(s => selectedIds.has(s.id))

  // ─── SMART THERAPIST FILTERING ───
  let allowedTherapists = therapists;
  if (selectedServices.length > 0) {
    const hasMassage = selectedServices.some(s => !isNailService(s));
    const hasNails = selectedServices.some(isNailService);

    allowedTherapists = therapists.filter(t => {
      const role = t.role.toLowerCase();
      const isMassageTech = role.includes('massage') || role.includes('therapist');
      const isNailTech = role.includes('nail');

      if (hasMassage && hasNails) return isMassageTech || isNailTech;
      if (hasMassage) return isMassageTech;
      if (hasNails) return isNailTech;
      return true; // Fallback
    });
  }
  const filteredTherapists = allowedTherapists.filter(t => t.name.toLowerCase().includes(therapistSearch.toLowerCase()))

  // ─── DYNAMIC PRICING AND DISCOUNT CALCULATOR ───
  const rawNailSubtotal = selectedServices.filter(isNailService).reduce((a, s) => a + Number(s.price || 0), 0)
  const rawMassageSubtotal = selectedServices.filter(s => !isNailService(s)).reduce((a, s) => a + Number(s.price || 0), 0)

  // 1. Calculate Nail Auto-Discount based on Membership Tier
  let nailDiscountPercentage = 0;
  if (detectedMembership) {
    const tier = detectedMembership.membership_tier.toUpperCase();
    if (tier === 'PLATINUM' || tier === 'VIP') nailDiscountPercentage = 10;
    else if (tier === 'BASIC' || tier === 'GOLD') nailDiscountPercentage = 5;
  }
  const membershipNailDeduction = rawNailSubtotal * (nailDiscountPercentage / 100);
  const subtotalAfterMembership = (rawNailSubtotal - membershipNailDeduction) + rawMassageSubtotal;

  // 2. Apply Custom Promo Code / Database Discount to the remaining total
  let promoDeduction = 0;
  if (appliedPromo) {
    promoDeduction = subtotalAfterMembership * (Number(appliedPromo.discount_percentage) / 100);
  }

  const finalTotalAmount = Math.max(0, subtotalAfterMembership - promoDeduction);

  const availableTimeSlots = date === getTodayStr() ? TIME_SLOTS.filter(t => {
    const match = t.match(/(\d+):(\d+)\s(AM|PM)/);
    if (!match) return true;
    let h = parseInt(match[1]); const m = parseInt(match[2]); const ampm = match[3];
    if (ampm === 'PM' && h !== 12) h += 12; if (ampm === 'AM' && h === 12) h = 0;
    const now = new Date(); const currH = now.getHours(); const currM = now.getMinutes();
    if (h > currH) return true; if (h === currH && m > currM) return true;
    return false;
  }) : TIME_SLOTS;

  useEffect(() => {
    if (time && !availableTimeSlots.includes(time)) setTime('');
  }, [date, availableTimeSlots, time]);

  const validation = {
    name: name.trim().length < 2,
    mobile: mobile.trim().length < 7,
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    services: selectedIds.size === 0,
    date: date === '',
    time: time === '',
    payment: payMethod === '',
  }
  const isValid = !Object.values(validation).some(Boolean)
  const eb = (hasErr: boolean): React.CSSProperties => attempted && hasErr ? { borderColor: 'rgba(139,58,58,0.65)', boxShadow: '0 0 0 3px rgba(139,58,58,0.10)' } : {}

  // ─── APPLY PROMO LOGIC ───
  function handleApplyPromo() {
    if (!promoInput.trim()) {
      setAppliedPromo(null);
      return;
    }
    const match = dbDiscounts.find(d =>
      d.name.toLowerCase() === promoInput.trim().toLowerCase() ||
      (d.code && d.code.toLowerCase() === promoInput.trim().toLowerCase())
    );
    if (match) {
      setAppliedPromo(match);
    } else {
      alert("Invalid or expired promo code.");
      setAppliedPromo(null);
      setPromoInput('');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setAttempted(true)
    if (!isValid || loading) return
    setLoading(true); setSubmitError(null)

    const selectedTherapist = therapists.find(t => t.id === therapistId)
    const generatedBookingId = crypto.randomUUID();

    let trackingNotes = notes.trim();
    if (detectedMembership) trackingNotes += `\n\n[SYSTEM: ${detectedMembership.membership_tier} MEMBERSHIP DETECTED - ${nailDiscountPercentage}% OFF NAILS APPLIED]`;
    if (appliedPromo) trackingNotes += `\n[SYSTEM: PROMO CODE '${appliedPromo.name}' - ${appliedPromo.discount_percentage}% OFF APPLIED]`;

    try {
      const { error: dbErr } = await supabase.from('bookings').insert({
        booking_id: generatedBookingId,
        client_name: name.trim(),
        client_mobile: mobile.trim(),
        client_email: email.trim(),
        service_name: selectedServices.map(s => s.name).join(', '),
        price: finalTotalAmount,
        therapist_name: selectedTherapist?.name ?? null,
        appointment_date: date,
        appointment_time: time,
        payment_method: payMethod,
        status: 'Pending',
        notes: trackingNotes.trim() || 'None',
      })

      if (dbErr) throw new Error(dbErr.message)

      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(), email: email.trim(), date: date, time: time,
            services: selectedServices.map(s => s.name).join(', '),
            totalAmount: finalTotalAmount
          })
        })
      } catch (e) {
        console.error("Email notification skipped", e)
      }
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed.')
    } finally { setLoading(false) }
  }

  const selectedPaymentMethodObj = PAYMENT_METHODS.find(pm => pm.key === payMethod)

  if (submitted) return (
    <div style={{ backgroundColor: BG, minHeight: '100dvh', padding: '100px 20px', textAlign: 'center', fontFamily: BODY }}>
      <div style={{ fontSize: 44, color: GOLD, margin: '0 auto 22px', width: 70, height: 70, borderRadius: '50%', backgroundColor: 'rgba(197,143,59,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>
      <h2 style={{ fontFamily: DSP, fontSize: 40, color: BLACK, margin: '0 0 14px' }}>Booking Received</h2>

      <p style={{ color: 'rgba(26,26,26,0.7)', fontSize: 16, maxWidth: 450, margin: '0 auto 24px', lineHeight: 1.6 }}>
        Thank you, <strong style={{ color: BLACK }}>{name}</strong>! Your appointment on <strong style={{ color: BLACK }}>{date}</strong> at <strong style={{ color: BLACK }}>{time}</strong> is officially on our calendar.
      </p>

      <div style={{ backgroundColor: WHITE, border: '1px solid rgba(197,143,59,0.3)', borderRadius: 16, padding: '24px', maxWidth: 450, margin: '0 auto 32px', textAlign: 'left', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <p style={{ fontSize: 14, color: BLACK, margin: '0 0 12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>✉️</span> Please check your inbox for the receipt <span style={{ color: GOLD }}>{email}</span>
        </p>
        <div style={{ height: 1, backgroundColor: 'rgba(26,26,26,0.05)', margin: '16px 0' }} />
        <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.65)', margin: '0 0 8px', lineHeight: 1.5 }}>
          <strong style={{ color: BLACK }}>Important:</strong> Sabbath Spa will confirm your appointment 1 hour before your check-in via SMS or Call.
        </p>
        <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.65)', margin: 0, lineHeight: 1.5 }}>
          For immediate concerns, please contact us at <strong style={{ color: BLACK }}>0917 199 7772</strong>.
        </p>
      </div>

      <button onClick={() => window.location.reload()} style={{ height: 50, padding: '0 32px', backgroundColor: 'transparent', color: BLACK, border: '1px solid rgba(26,26,26,0.2)', borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 200ms ease' }}>
        Book Another Session
      </button>
    </div>
  )

  return (
    <>
      <style>{`
        .bk-in:focus{border-color:${GOLD}!important;box-shadow:0 0 0 3px rgba(197,143,59,0.18)!important;}
        .bk-in:hover:not(:focus){border-color:rgba(197,143,59,0.45)!important;}
        .svc-scroll::-webkit-scrollbar { width: 6px; }
        .svc-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.02); border-radius: 4px; }
        .svc-scroll::-webkit-scrollbar-thumb { background: rgba(197,143,59,0.3); border-radius: 4px; }
        .svc-scroll::-webkit-scrollbar-thumb:hover { background: rgba(197,143,59,0.6); }
      `}</style>

      <div style={{ backgroundColor: BG, minHeight: '100dvh', padding: '40px 20px', fontFamily: BODY }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.20em', color: GOLD, margin: '0 0 10px', textTransform: 'uppercase' }}>Reserve Your Visit</p>
            <h1 style={{ fontFamily: DSP, fontSize: 40, color: BLACK, margin: '0 0 8px', lineHeight: 1.1 }}>Book a Session</h1>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }} noValidate>

            <Section title="Client Information">
              <Field label="Full Name *">
                <input className="bk-in" style={{ ...INPUT, ...eb(validation.name) }} value={name} onChange={e => setName(e.target.value)} placeholder="Maria Santos" />
              </Field>
              <Row2>
                <Field label="Mobile Number *">
                  <input
                    className="bk-in"
                    style={{ ...INPUT, ...eb(validation.mobile) }}
                    type="tel"
                    inputMode="numeric"
                    value={mobile}
                    onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
                    placeholder="09XX XXX XXXX"
                  />
                </Field>
                <Field label="Email Address *">
                  <input className="bk-in" style={{ ...INPUT, ...eb(validation.email) }} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="maria@example.com" />
                </Field>
              </Row2>
            </Section>

            <Section title="Select Services" note={selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Choose one or more'}>

              {/* ── LIVE MEMBERSHIP DETECTOR BANNER ── */}
              {detectedMembership && (
                <div style={{ backgroundColor: 'rgba(197,143,59,0.08)', border: '1px solid rgba(197,143,59,0.3)', padding: '16px 20px', borderRadius: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', color: WHITE, fontSize: 20 }}>👑</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: BLACK, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                      {detectedMembership.membership_tier} Member Detected
                    </div>
                    <div style={{ fontSize: 12, color: '#666', lineHeight: 1.4 }}>
                      Automatically applying <strong>{nailDiscountPercentage}% OFF</strong> to all Le Nails services.
                    </div>
                  </div>
                </div>
              )}

              {servicesLoad ? (
                <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.5)', fontStyle: 'italic' }}>Loading live services from database...</p>
              ) : validServices.length === 0 ? (
                <div style={{ backgroundColor: 'rgba(139,58,58,0.05)', padding: 16, borderRadius: 8, border: '1px solid rgba(139,58,58,0.2)' }}>
                  <p style={{ color: '#8B3A3A', fontSize: 14, margin: 0, fontWeight: 600 }}>No services found in database.</p>
                </div>
              ) : (
                <div className="svc-scroll" style={{ maxHeight: 350, overflowY: 'auto', paddingRight: 8, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {massageServices.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, marginBottom: 12 }}>Massage Therapy</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(220px,100%),1fr))', gap: 10 }}>
                        {massageServices.map(s => <ServiceChip key={s.id} item={s} selected={selectedIds.has(s.id)} onToggle={() => toggleService(s.id)} />)}
                      </div>
                    </div>
                  )}

                  {nailServices.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, marginBottom: 12 }}>Le Nails</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(220px,100%),1fr))', gap: 10 }}>
                        {nailServices.map(s => (
                          <ServiceChip
                            key={s.id}
                            item={s}
                            selected={selectedIds.has(s.id)}
                            onToggle={() => toggleService(s.id)}
                            discountPct={nailDiscountPercentage} // Passes visual discount natively to the chip!
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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
                    {availableTimeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
              </Row2>

              {/* SMART THERAPIST DROPDOWN */}
              <Field label={therapistLoad ? 'Therapist (loading…)' : `Therapist`}>
                <input className="bk-in" style={{ ...INPUT, marginBottom: 10, height: 44, fontSize: 14 }} placeholder="Search for a therapist..." value={therapistSearch} onChange={e => setTherapistSearch(e.target.value)} />
                <select className="bk-in" style={SELECT} value={therapistId} onChange={e => setTherapistId(e.target.value)}>
                  <option value="">Choose your therapist (optional)…</option>
                  {filteredTherapists.map(t => <option key={t.id} value={t.id}>{t.name}{t.status ? ` (${t.status})` : ''}</option>)}
                </select>
                {selectedServices.length > 0 && (
                  <p style={{ fontSize: 11, color: '#666', fontStyle: 'italic', marginTop: 8, marginBottom: 0 }}>
                    Showing specific staff for selected services.
                  </p>
                )}
              </Field>
            </Section>

            <Section title="Payment Method">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(120px,100%),1fr))', gap: 10 }}>
                {PAYMENT_METHODS.map(pm => {
                  const sel = payMethod === pm.key
                  return (
                    <button key={pm.key} type="button" onClick={() => setPayMethod(pm.key)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px 10px', backgroundColor: sel ? BLACK : WHITE, border: `1.5px solid ${sel ? BLACK : 'rgba(26,26,26,0.13)'}`, borderRadius: 12, cursor: 'pointer', color: sel ? GOLD : 'rgba(26,26,26,0.50)', transition: 'all 180ms ease' }}>
                      {pm.icon}
                      <span style={{ fontSize: 12, fontWeight: 600, textAlign: 'center' }}>{pm.label}</span>
                    </button>
                  )
                })}
              </div>

              {selectedPaymentMethodObj && selectedPaymentMethodObj.qrImage && (
                <div style={{ marginTop: 14, padding: 20, backgroundColor: 'rgba(197,143,59,0.05)', border: '1px dashed rgba(197,143,59,0.4)', borderRadius: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Scan to Pay with {selectedPaymentMethodObj.label}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedPaymentMethodObj.qrImage} alt={`QR Code for ${selectedPaymentMethodObj.label}`} style={{ width: '100%', maxWidth: 350, height: 'auto', objectFit: 'contain', margin: '0 auto', display: 'block', borderRadius: 8 }} />
                </div>
              )}
            </Section>

            {/* ─── LIVE DATABASE PROMO CODES ─── */}
            <Section title="Discounts & Promos" note="Type or select an option">
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    list="db-discounts"
                    className="bk-in"
                    style={{ ...INPUT, backgroundImage: 'none' }}
                    value={promoInput}
                    onChange={e => {
                      setPromoInput(e.target.value);
                      if (!e.target.value) setAppliedPromo(null);
                    }}
                    placeholder="e.g. Senior, PWD, VIP Discount..."
                  />
                  <datalist id="db-discounts">
                    {dbDiscounts.map(d => (
                      <option key={d.id} value={d.name} />
                    ))}
                  </datalist>
                </div>
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  style={{ padding: '0 24px', backgroundColor: BLACK, color: GOLD, border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}
                >
                  Apply
                </button>
              </div>

              {appliedPromo && (
                <div style={{ padding: '12px 16px', backgroundColor: 'rgba(61,122,74,0.1)', border: '1px solid rgba(61,122,74,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16, color: '#3D7A4A' }}>✓</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#3D7A4A', textTransform: 'uppercase' }}>{appliedPromo.name} APPLIED</div>
                    <div style={{ fontSize: 12, color: '#2A2A2A' }}>{appliedPromo.discount_percentage}% off remaining total</div>
                  </div>
                </div>
              )}
            </Section>

            <Section title="Additional Notes" note="optional">
              <textarea className="bk-in" style={{ ...INPUT, height: 'auto', minHeight: 100, padding: '13px 15px', resize: 'vertical', lineHeight: 1.65 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Allergies, special requests…" />
            </Section>

            {submitError && (
              <div style={{ padding: 14, backgroundColor: 'rgba(139,58,58,0.08)', border: '1px solid rgba(139,58,58,0.2)', borderRadius: 8, color: '#8B3A3A', fontSize: 14, textAlign: 'center' }}>
                {submitError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button type="submit" disabled={loading || !isValid} style={{ height: 58, backgroundColor: BLACK, color: GOLD, border: '1px solid rgba(197,143,59,0.35)', borderRadius: 11, fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: loading || !isValid ? 'not-allowed' : 'pointer', opacity: loading || !isValid ? 0.4 : 1, transition: 'opacity 200ms ease' }}>
                {loading ? 'Sending request…' : `Confirm Booking · ${fmt(finalTotalAmount)}`}
              </button>
            </div>

          </form>
        </div>
      </div>
    </>
  )
}