'use client'

// app/booking/page.tsx  —  Phase 47 Booking Engine (Flawless Time Logic + 12AM Strict Limit + Exact Sync)
// STRICT LIVE DATABASE CONNECTION (Dynamic Staff Availability Engine + Midnight Parser Fix + Branch Router)
// FULLY EXPANDED FORMATTING PRESERVED

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef, FormEvent } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// DESIGN TOKENS & TIME MATRIX
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

const SELECT: React.CSSProperties = {
  ...INPUT,
  paddingRight: 42,
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23C58F3B' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  cursor: 'pointer',
  appearance: 'none',
  WebkitAppearance: 'none',
}

const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.13em', textTransform: 'uppercase',
  color: 'rgba(26,26,26,0.50)', marginBottom: 7, fontFamily: BODY,
}

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface ServiceItem { id: string; name: string; duration: string; price: number; category: string; description?: string; savings?: string }
interface Therapist { id: string; name: string; status: string; role: string; off_days?: string[]; branch: string; }
interface Discount { id: string; name: string; discount_percentage: number; code?: string; category: string }
interface Membership { id: string; client_name: string; client_mobile: string; client_email: string; membership_tier: string }

const fmt = (n: number) => '₱' + n.toLocaleString('en-PH')

// ─────────────────────────────────────────────────────────────
// CONTAINERS
// ─────────────────────────────────────────────────────────────
function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: WHITE, border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, padding: 'clamp(20px,3vw,28px)', display: 'flex', flexDirection: 'column', gap: 18, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ paddingBottom: 14, borderBottom: '1px solid rgba(197,143,59,0.15)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 18, height: 2, backgroundColor: GOLD, display: 'inline-block', flexShrink: 0, borderRadius: 2 }} />
          <h2 style={{ fontFamily: DSP, fontSize: 21, fontWeight: 400, color: BLACK, margin: 0, lineHeight: 1 }}>{title}</h2>
        </div>
        {note && <span style={{ fontSize: 11, color: 'rgba(26,26,26,0.5)', fontFamily: BODY, fontStyle: 'italic' }}>{note}</span>}
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
  const hasPrice = item.price > 0;
  const durationDisplay = item.duration ? `${item.duration} · ` : '';

  return (
    <button type="button" onClick={onToggle} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '13px 15px',
      backgroundColor: selected ? 'rgba(197,143,59,0.06)' : WHITE,
      border: `1.5px solid ${selected ? GOLD : 'rgba(26,26,26,0.13)'}`,
      borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 160ms ease',
      boxShadow: selected ? '0 2px 10px rgba(197,143,59,0.15)' : 'none', position: 'relative', width: '100%'
    }}>
      {selected && (
        <span style={{ position: 'absolute', top: 8, right: 9, width: 18, height: 18, borderRadius: '50%', backgroundColor: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke={WHITE} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      )}
      <span style={{ fontSize: 14, fontWeight: 600, color: selected ? BLACK : 'rgba(26,26,26,0.75)', fontFamily: BODY, lineHeight: 1.3, paddingRight: 20 }}>{item.name}</span>
      <span style={{ fontSize: 12, color: 'rgba(26,26,26,0.40)', fontFamily: BODY, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        {hasPrice ? (
          discountPct > 0 ? (
            <>
              <s style={{ opacity: 0.6, marginRight: 4 }}>{fmt(item.price)}</s>
              <strong style={{ color: GOLD }}>{fmt(actualPrice)}</strong>
            </>
          ) : (
            `${durationDisplay}${fmt(item.price)}`
          )
        ) : (
          <strong style={{ color: GOLD, letterSpacing: '0.05em' }}>Contact Us</strong>
        )}
        {item.savings && (
          <span style={{ backgroundColor: 'rgba(61,122,74,0.1)', color: '#3D7A4A', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
            {item.savings}
          </span>
        )}
      </span>
      {selected && item.description && (
        <div style={{ marginTop: 8, padding: '10px 12px', backgroundColor: WHITE, borderRadius: 6, border: '1px solid rgba(197,143,59,0.15)', width: '100%', boxSizing: 'border-box' }}>
          <span style={{ fontSize: 11, color: 'rgba(26,26,26,0.65)', lineHeight: 1.5, fontFamily: BODY, display: 'block', whiteSpace: 'pre-line' }}>
            {item.description}
          </span>
        </div>
      )}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// CORE EXECUTABLE MAIN CONTAINER
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
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [branch, setBranch] = useState('Sabbath Malolos')

  const [firstName, setFirstName] = useState('')
  const [middleInitial, setMiddleInitial] = useState('')
  const [lastName, setLastName] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')

  const [dbServices, setDbServices] = useState<ServiceItem[]>([])
  const [customServices, setCustomServices] = useState<ServiceItem[]>([])
  const [customSvcName, setCustomSvcName] = useState('')
  const [customSvcPrice, setCustomSvcPrice] = useState('')

  const [servicesLoad, setServicesLoad] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [dbDiscounts, setDbDiscounts] = useState<Discount[]>([])
  const [activeMemberships, setActiveMemberships] = useState<Membership[]>([])
  const [detectedMembership, setDetectedMembership] = useState<Membership | null>(null)

  const [discountMode, setDiscountMode] = useState<string>('none')
  const [customDiscountVal, setCustomDiscountVal] = useState<string>('')

  const [date, setDate] = useState('')
  const [minApptDate, setMinApptDate] = useState('')
  const [time, setTime] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dateBookings, setDateBookings] = useState<any[]>([])

  const [therapistSearch, setTherapistSearch] = useState('')
  const [therapistId, setTherapistId] = useState('')
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [therapistLoad, setTherapistLoad] = useState(true)
  const [notes, setNotes] = useState('')

  const autoCapitalize = (val: string) => (!val ? '' : val.charAt(0).toUpperCase() + val.slice(1))

  const getTodayStr = useCallback(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  useEffect(() => {
    setMinApptDate(getTodayStr())
    const fetchUnlimited = async (tableName: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let allRecords: any[] = [], start = 0, step = 1000
      for (; ;) {
        const { data, error } = await supabase.from(tableName).select('*').range(start, start + step - 1)
        if (error || !data || data.length === 0) break
        allRecords.push(...data)
        if (data.length < step) break
        start += step
      }
      return allRecords
    }

    async function loadData() {
      try {
        const [thRes, svRes, discRes, memRes] = await Promise.all([
          fetchUnlimited('staff'),
          fetchUnlimited('services'),
          fetchUnlimited('discounts'),
          fetchUnlimited('memberships')
        ])

        if (thRes) {
          setTherapists(thRes.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(t => ({
            id: String(t.id),
            name: t.name || t.therapist_name || 'Staff',
            status: t.status,
            role: t.role || t.specialty || 'Massage Therapist',
            off_days: t.off_days ? String(t.off_days).split(',') : [],
            branch: t.branch || 'Sabbath Malolos'
          })))
        }

        if (discRes) setDbDiscounts(discRes.filter(d => d.active) as Discount[])
        if (memRes) setActiveMemberships(memRes.filter(m => m.status === 'Active') as Membership[])

        const hardcodedWellness = [
          { id: 'ws-1', name: 'PRIVATE WELLNESS SUITE', duration: '120 min', price: 1500, category: 'Wellness Suite', description: 'A complete wellness journey combining sauna, and Jacuzzi access. Perfect for those who want the full Sabbath experience in one rejuvenating session.\n\nIncludes:\n• Private Shower\n• Sauna session (4 pax max)\n• Jacuzzi bath experience (for 2)' },
          { id: 'ws-2', name: 'PRIVATE WELLNESS SUITE WITH REGULAR MASSAGE', duration: '3 hours', price: 2000, category: 'Wellness Suite', description: 'Swedish, Foot Reflexology and Shiatsu.\n\nInclusions:\nPrivate Shower, Jacuzzi, Sauna and 60 minutes Regular Massage' },
          { id: 'ws-3', name: 'BODY SCRUBS WITH REGULAR MASSAGE', duration: '2 ½ hours', price: 3000, category: 'Wellness Suite', description: 'Swedish, Foot Reflexology and Shiatsu.\n\n• 20 minutes scalp massage - Cream bath or oil scalp massage\n• 40 minutes - A full-body exfoliation treatment using natural scrubs to remove dead skin cells, leaving the skin smooth and refreshed.\n• 60 minutes - Regular massage: Swedish, Foot Reflexology and Shiatsu' },
          { id: 'ev-1', name: 'GIFT CERTIFICATES', duration: '', price: 0, category: 'Wellness Suite', description: 'A thoughtful gift of rest and relaxation.\n🎉 10 + 1 Promo - Book 10 services, get 1 FREE!' },
          { id: 'ev-2', name: 'BRIDAL SHOWER PACKAGES', duration: '', price: 0, category: 'Wellness Suite', description: '(minimum 4 pax- choose your experience)\n💅 Le Nails Spa Bridal Package\n- FREE Foot Spa for the bride\n💆‍♀️ Sabbath Bridal Massage Package\n- FREE Upgrade to Signature Sabbath Massage for the bride\n\n🍲 Add food from Sabasu - choose from our ramen or rice meals for your spa party!' },
          { id: 'ev-3', name: 'BIRTHDAY TREATS', duration: '', price: 0, category: 'Wellness Suite', description: 'FREE home-baked chocolate cookies for the celebrant 🍪' },
          { id: 'ev-4', name: 'CORPORATE EVENTS', duration: '', price: 0, category: 'Wellness Suite', description: 'FREE 1 round of Coffee or Tea for groups of 10+ dining at Sabasu ☕\n\nCelebrate. Relax. Indulge. Make your next event a Sabbath to Remember.' }
        ];

        let finalMappedServices: ServiceItem[] = [];

        if (svRes && svRes.length > 0) {
          finalMappedServices = svRes.map(s => {
            let rawName = String(s.service_name || s.name || s.service || 'Unnamed Service');
            if (rawName.toLowerCase() === 'gel polish') rawName = 'GEL POLISH';
            if (rawName.toLowerCase() === 'rhinestones') rawName = 'RHINESTONES';

            let desc = '';
            let saveTag = '';
            let duration = String(s.duration || '60 min');
            const upName = rawName.toUpperCase();

            if (upName.includes('GIFT CERTIFICATE') || upName.includes('BRIDAL SHOWER') || upName.includes('BIRTHDAY TREAT') || upName.includes('CORPORATE EVENT')) {
              duration = '';
            }

            if (upName === 'PACKAGE A') { desc = "Mani, Pedi, Foot Spa"; saveTag = "SAVE ₱100.00 !!"; }
            else if (upName === 'PACKAGE B') { desc = "ManiGel ORLY, Pedi, Foot Spa"; saveTag = "SAVE ₱200.00 !!"; }
            else if (upName === 'PACKAGE C') { desc = "ManiGel CUCCIO, Pedi, Foot Massage"; saveTag = "SAVE ₱300.00 !!"; }
            else if (upName === 'PACKAGE D') { desc = "ManiGel CUCCIO, PediGel CUCCIO, Foot Massage"; saveTag = "SAVE ₱300.00 !!"; }
            else if (upName === 'PACKAGE E') { desc = "Mani, PediGel ORLY, Hand Paraffin"; saveTag = "SAVE ₱300.00 !!"; }
            else if (upName === 'PACKAGE F') { desc = "ManiGel ORLY, PediGel ORLY, Hand Paraffin"; saveTag = "SAVE ₱450.00 !!"; }
            else if (upName.includes('GIFT CERTIFICATE') && !upName.includes('CUSTOM') && !upName.includes('10+1')) {
              desc = 'A thoughtful gift of rest and relaxation.\n🎉 10 + 1 Promo - Book 10 services, get 1 FREE!';
            }
            else if (upName.includes('BRIDAL SHOWER')) {
              desc = '(minimum 4 pax- choose your experience)\n💅 Le Nails Spa Bridal Package\n- FREE Foot Spa for the bride\n💆‍♀️ Sabbath Bridal Massage Package\n- FREE Upgrade to Signature Sabbath Massage for the bride\n\n🍲 Add food from Sabasu - choose from our ramen or rice meals for your spa party!';
            }
            else if (upName.includes('BIRTHDAY TREAT')) {
              desc = 'FREE home-baked chocolate cookies for the celebrant 🍪';
            }
            else if (upName.includes('CORPORATE EVENT')) {
              desc = 'FREE 1 round of Coffee or Tea for groups of 10+ dining at Sabasu ☕';
            }

            return {
              id: String(s.id),
              name: rawName,
              duration: duration,
              price: Number(s.price || s.amount || 0),
              category: String(s.category || s.type || 'Massage'),
              description: desc,
              savings: saveTag
            };
          })
        }

        hardcodedWellness.forEach(hw => {
          if (!finalMappedServices.some(s => s.name.toUpperCase() === hw.name.toUpperCase())) {
            finalMappedServices.push(hw);
          }
        });

        const uniqueServices: ServiceItem[] = [];
        const seenNames = new Set<string>();
        for (const s of finalMappedServices) {
          const key = s.name.toUpperCase().trim();
          if (!seenNames.has(key)) {
            seenNames.add(key);
            uniqueServices.push(s);
          }
        }

        setDbServices(uniqueServices);

      } catch (err) {
        console.error("Supabase fetch failed:", err)
      } finally {
        setTherapistLoad(false)
        setServicesLoad(false)
      }
    }
    loadData()
  }, [supabase, getTodayStr])

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

  const isExcluded = (name: string) => {
    const n = name.toUpperCase().trim();
    return n === 'SOFT GEL' || n === 'SAUNA' || n === 'SHOWER' || n === 'JACUZZI' || n === 'SLIPPERS' || n === 'WAX' || n === 'BRAZILLIAN WAX' || n === 'REGULAR MASSAGE' || n.includes('SABBATH PACKAGE 1') || n.includes('SABBATH PACKAGE 2') || n.includes('PLATINUM') || n.includes('MEMBERSHIP') || n.includes('GIFT CERTIFICATE (10+1)') || n.includes('GIFT CERTIFICATE CUSTOM') || n.includes('THERAPIST REQUEST');
  }

  const validServices = dbServices.filter(s => !isExcluded(s.name));
  const allAvailableServices = [...validServices, ...customServices];

  const WAX_KEYWORDS = ['UPPER LIP', 'LOWER LIP', 'UNDERARMS', 'ARMS FEMALE', 'ARMS MALE', 'HALF LEGS', 'FULL LEGS', 'FULL BODY']
  const NAIL_KEYWORDS = ['SOFT GEL NAIL EXTENSION', 'FULL SET BASIC NAIL ART', '3D GEL NAIL ART/EMBOSSED', 'NAIL GEL REMOVER', 'SOFT GEL REMOVER', 'RHINESTONES', 'GEL POLISH', 'ACCENT', 'POLISH', 'NAIL ART', 'GEL REMOVAL']

  const isWaxService = (s: ServiceItem) => WAX_KEYWORDS.some(k => s.name.toUpperCase().includes(k));
  const isNailService = (s: ServiceItem) => {
    const cat = s.category?.toLowerCase() || '';
    const nameUpper = s.name.toUpperCase();
    if (NAIL_KEYWORDS.some(k => nameUpper.includes(k))) return true;
    if (cat.includes('nail') || cat.includes('le') || cat.includes('hands') || cat.includes('feet')) return true;
    return false;
  }

  const packageServices = allAvailableServices.filter(s => ['PACKAGE A', 'PACKAGE B', 'PACKAGE C', 'PACKAGE D', 'PACKAGE E', 'PACKAGE F'].includes(s.name.toUpperCase()));
  const wellnessPackages = allAvailableServices.filter(s => {
    const n = s.name.toUpperCase();
    if (packageServices.includes(s)) return false;
    return n.includes('WELLNESS SUITE') || n.includes('BODY SCRUBS WITH REGULAR MASSAGE') || n.includes('PACKAGE') || n.includes('GIFT CERTIFICATE') || n.includes('BIRTHDAY TREATS') || n.includes('CORPORATE EVENTS');
  });

  const waxServices = allAvailableServices.filter(s => !packageServices.includes(s) && !wellnessPackages.includes(s) && isWaxService(s));
  const nailServices = allAvailableServices.filter(s => !packageServices.includes(s) && !wellnessPackages.includes(s) && !waxServices.includes(s) && isNailService(s));
  const massageServices = allAvailableServices.filter(s => !packageServices.includes(s) && !wellnessPackages.includes(s) && !waxServices.includes(s) && !nailServices.includes(s) && s.category !== 'Custom');

  useEffect(() => {
    if (branch === 'Sabbath Pulilan') {
      setSelectedIds(prev => {
        const next = new Set(prev);
        let changed = false;
        nailServices.forEach(ns => { if (next.has(ns.id)) { next.delete(ns.id); changed = true; } });
        packageServices.forEach(ps => { if (next.has(ps.id)) { next.delete(ps.id); changed = true; } });
        return changed ? next : prev;
      });
      setTherapistId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch])

  function toggleService(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleAddCustomService() {
    if (!customSvcName.trim() || !customSvcPrice) return;
    const newCustomService: ServiceItem = {
      id: `custom-${Date.now()}`,
      name: customSvcName.trim(),
      duration: 'Custom',
      price: Number(customSvcPrice),
      category: 'Custom'
    }
    setCustomServices(prev => [...prev, newCustomService]);
    setSelectedIds(prev => new Set(prev).add(newCustomService.id));
    setCustomSvcName('');
    setCustomSvcPrice('');
  }

  const selectedServices = allAvailableServices.filter(s => selectedIds.has(s.id))

  let allowedTherapists = therapists.filter(t => t.branch === branch);

  if (selectedServices.length > 0) {
    const needsTherapist = selectedServices.some(s => massageServices.includes(s) || wellnessPackages.includes(s));
    const needsNailTech = selectedServices.some(s => nailServices.includes(s) || packageServices.includes(s));
    const needsWaxTech = selectedServices.some(s => waxServices.includes(s));

    allowedTherapists = allowedTherapists.filter(t => {
      const role = (t.role || '').toLowerCase();
      const isMassageTech = role.includes('massage') || role.includes('therapist') || role.includes('spa');
      const isNailTech = role.includes('nail');
      const isWaxTech = isMassageTech || isNailTech;

      if (needsTherapist && needsNailTech) return isMassageTech || isNailTech;
      if (needsTherapist) return isMassageTech;
      if (needsNailTech) return isNailTech;
      if (needsWaxTech) return isWaxTech;
      return true;
    });
  }

  // Determine current day for off-duty and dynamic slot generation
  let currentDayIndex = -1;
  let dayName = '';
  if (date) {
    const [y, m, d] = date.split('-').map(Number);
    const selectedDateObj = new Date(y, m - 1, d);
    dayName = selectedDateObj.toLocaleDateString('en-US', { weekday: 'long' });
    currentDayIndex = selectedDateObj.getDay();

    allowedTherapists = allowedTherapists.filter(t => {
      if (t.off_days && t.off_days.includes(dayName)) return false;
      return true;
    });
  }

  const filteredTherapists = allowedTherapists.filter(t => t.name.toLowerCase().includes(therapistSearch.toLowerCase()))

  const rawNailSubtotal = selectedServices.filter(isNailService).reduce((a, s) => a + Number(s.price || 0), 0)
  const rawMassageSubtotal = selectedServices.filter(s => !isNailService(s)).reduce((a, s) => a + Number(s.price || 0), 0)

  let nailDiscountPercentage = 0;
  if (detectedMembership) {
    const tier = detectedMembership.membership_tier.toUpperCase();
    if (tier === 'VIP') nailDiscountPercentage = 10;
    else if (tier === 'BASIC' || tier === 'GOLD') nailDiscountPercentage = 5;
  }
  const membershipNailDeduction = rawNailSubtotal * (nailDiscountPercentage / 100);
  const subtotalAfterMembership = (rawNailSubtotal - membershipNailDeduction) + rawMassageSubtotal;

  let promoDeduction = 0;
  let appliedPromoText = '';

  if (discountMode === 'senior') {
    promoDeduction = subtotalAfterMembership * 0.20;
    appliedPromoText = 'Senior Citizen (20%)';
  } else if (discountMode === 'pwd') {
    promoDeduction = subtotalAfterMembership * 0.20;
    appliedPromoText = 'PWD (20%)';
  } else if (discountMode.startsWith('db-')) {
    const dbId = discountMode.split('db-')[1];
    const match = dbDiscounts.find(d => String(d.id) === dbId);
    if (match) {
      promoDeduction = subtotalAfterMembership * (Number(match.discount_percentage) / 100);
      appliedPromoText = `${match.name} (${match.discount_percentage}%)`;
    }
  } else if (discountMode === 'custom_pct') {
    const pct = Number(customDiscountVal) || 0;
    promoDeduction = subtotalAfterMembership * (pct / 100);
    appliedPromoText = `Custom Discount (${pct}%)`;
  } else if (discountMode === 'custom_amount') {
    const amt = Number(customDiscountVal) || 0;
    promoDeduction = amt;
    appliedPromoText = `Custom Discount (₱${amt})`;
  }

  const finalTotalAmount = Math.max(0, subtotalAfterMembership - promoDeduction);

  // ─── FETCH LIVE CONFLICTS (WITH ADDITIONAL MINS EXTENSIONS) ───
  useEffect(() => {
    if (!date) return;
    const fetchDateBookings = async () => {
      const { data } = await supabase
        .from('bookings')
        .select('appointment_time, therapist_name, branch, status, additional_mins')
        .eq('appointment_date', date)
        .eq('branch', branch)
        .neq('status', 'Cancelled')
        .neq('status', 'Completed');
      if (data) setDateBookings(data);
    }
    fetchDateBookings();
  }, [date, branch, supabase]);


  // ─── ALGORITHMIC TIMELINE OVERLAP ENGINE ───
  const getMinutesFromMidnight = (tStr: string) => {
    if (!tStr) return -1;
    const match = tStr.match(/(\d+):(\d+)(?:\s*(AM|PM))?/i);
    if (!match) return -1;

    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    let ampm = match[3] ? match[3].toUpperCase() : '';

    if (!ampm) {
      if (h === 11) ampm = 'AM';
      else if (h === 12 || (h >= 1 && h <= 10)) ampm = 'PM';
      else if (h > 12) {
        h -= 12;
        ampm = 'PM';
      } else {
        ampm = 'AM';
      }
    }

    if (ampm === 'PM' && h !== 12 && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;

    // Exact mapping for strictly parsing overlap and past time
    // 12:00 AM represents the end of the night shift
    if (h === 0 && m === 0) return 24 * 60;

    return h * 60 + m;
  };

  const checkOverlapConstraint = useCallback((timeA: string, timeB: string, extraMinsA = 0) => {
    const startA = getMinutesFromMidnight(timeA);
    const startB = getMinutesFromMidnight(timeB);
    if (startA === -1 || startB === -1) return false;

    // Core 60-minute assumed service block + explicit extensions
    const endA = startA + 60 + extraMinsA;
    const endB = startB + 60;

    // Strict 15-minute padding intervals
    return (startA - 15) < endB && (startB - 15) < endA;
  }, []);

  // ─── 15-MINUTE DYNAMIC INTERVAL GENERATOR (11AM to 12AM or 1PM to 12AM) ───
  const generate15MinSlots = (isSunday: boolean) => {
    const slots = [];
    const startMins = isSunday ? 13 * 60 : 11 * 60; // 1pm on Sun, 11am Mon-Sat
    const endMins = 24 * 60; // 12:00 AM (midnight)

    for (let m = startMins; m <= endMins; m += 15) {
      let h = Math.floor(m / 60);
      let min = m % 60;
      let ampm = 'AM';

      if (h >= 12 && h < 24) {
        ampm = 'PM';
        if (h > 12) h -= 12;
      } else if (h === 24) {
        h = 12; ampm = 'AM';
      }

      slots.push(`${h}:${min.toString().padStart(2, '0')} ${ampm}`);
    }
    return slots;
  };

  // ─── DYNAMIC AVAILABILITY VALIDATION ───
  let availableSlots: { time: string, available: boolean }[] = [];

  if (date) {
    const isSunday = currentDayIndex === 0;
    const baseSlots = generate15MinSlots(isSunday);
    const isToday = date === getTodayStr();
    const now = new Date();

    let currMins = now.getHours() * 60 + now.getMinutes();

    availableSlots = baseSlots.map(t => {
      let isPast = false;
      if (isToday) {
        const slotMins = getMinutesFromMidnight(t);
        // Standard time comparison so 1AM doesn't accidentally cancel 11AM
        if (slotMins !== -1 && slotMins <= currMins) {
          isPast = true;
        }
      }

      let isConflict = false;
      if (therapistId) {
        const tName = therapists.find(th => th.id === therapistId)?.name;
        isConflict = dateBookings.some(b => b.therapist_name === tName && checkOverlapConstraint(b.appointment_time, t, Number(b.additional_mins || 0)));
      } else {
        if (allowedTherapists.length === 0) {
          isConflict = true;
        } else {
          // It's free if AT LEAST ONE allowed therapist is free
          const freeTherapist = allowedTherapists.find(th => {
            return !dateBookings.some(b => b.therapist_name === th.name && checkOverlapConstraint(b.appointment_time, t, Number(b.additional_mins || 0)));
          });
          isConflict = !freeTherapist;
        }
      }

      return { time: t, available: !isPast && !isConflict }
    });
  }

  const getTherapistStatus = (t: Therapist) => {
    if (time) {
      const isConflict = dateBookings.some(b => b.therapist_name === t.name && checkOverlapConstraint(b.appointment_time, time, Number(b.additional_mins || 0)));
      if (isConflict) return ` (Unavailable)`;
    }
    return t.status ? ` (${t.status})` : '';
  }

  const isTherapistDisabled = (t: Therapist) => {
    if (time) {
      return dateBookings.some(b => b.therapist_name === t.name && checkOverlapConstraint(b.appointment_time, time, Number(b.additional_mins || 0)));
    }
    return false;
  }

  // Validate the chosen time exists and is available
  const selectedSlot = availableSlots.find(s => s.time === time);
  const isTimeInvalid = time !== '' && (!selectedSlot || !selectedSlot.available);

  const validation = {
    firstName: firstName.trim().length < 2,
    lastName: lastName.trim().length < 2,
    mobile: mobile.trim().length < 7,
    email: email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    services: selectedIds.size === 0,
    date: date === '',
    time: time === '' || isTimeInvalid,
  }

  const isValid = !Object.values(validation).some(Boolean)
  const eb = (hasErr: boolean): React.CSSProperties => attempted && hasErr ? { borderColor: 'rgba(139,58,58,0.65)', boxShadow: '0 0 0 3px rgba(139,58,58,0.10)' } : {}

  function handleFormPreSubmit(e: FormEvent) {
    e.preventDefault()
    setAttempted(true)
    if (!isValid || loading) {
      if (isTimeInvalid && time !== '') setSubmitError("The selected time is unavailable. It is either past operating hours or overlaps with an existing booking.");
      return;
    }
    setShowConfirmModal(true)
  }

  async function executeBooking() {
    setShowConfirmModal(false)
    setLoading(true); setSubmitError(null)

    const selectedTherapist = therapists.find(t => t.id === therapistId)
    const generatedBookingId = crypto.randomUUID();

    const miStr = middleInitial.trim() ? ` ${middleInitial.trim()}.` : '';
    const constructedFullName = `${firstName.trim()}${miStr} ${lastName.trim()}`;

    let trackingNotes = notes.trim();
    if (promoDeduction > 0 && appliedPromoText) {
      trackingNotes += `\n\n[SYSTEM CHECKOUT: ${appliedPromoText} APPLIED - ₱${promoDeduction.toLocaleString()} DEDUCTED]`;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        booking_id: generatedBookingId,
        branch: branch,
        client_name: constructedFullName,
        client_mobile: mobile.trim(),
        client_email: email.trim(),
        service_name: selectedServices.map(s => s.name).join(', '),
        price: finalTotalAmount,
        therapist_name: selectedTherapist?.name ?? null,
        appointment_date: date,
        appointment_time: time.trim().toUpperCase(),
        payment_method: 'PAY AT COUNTER',
        status: 'Pending',
        notes: trackingNotes.trim(),
      };

      const { error: dbErr } = await supabase.from('bookings').insert(payload)
      if (dbErr) throw new Error(dbErr.message)

      if (email.trim() !== '') {
        try {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: firstName.trim(),
              email: email.trim(),
              date: date,
              time: time.trim().toUpperCase(),
              services: selectedServices.map(s => s.name).join(', '),
              totalAmount: finalTotalAmount,
              branch: branch
            })
          })
        } catch (e) {
          console.error("Email notification skipped", e)
        }
      }

      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed.')
    } finally { setLoading(false) }
  }

  const formatMiStr = middleInitial.trim() ? ` ${middleInitial.trim()}.` : '';
  const displayFullName = `${firstName.trim()}${formatMiStr} ${lastName.trim()}`;
  const selectedTherapistDisplay = therapists.find(t => t.id === therapistId)?.name || 'Unassigned';

  if (submitted) return (
    <>
      <style>{`
        @media print {
          @page { margin: 0; size: auto; }
          body { margin: 1cm; background: #FFF !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="no-print" style={{ backgroundColor: BG, minHeight: '100dvh', padding: '100px 20px', textAlign: 'center', fontFamily: BODY }}>
        <div style={{ fontSize: 44, color: GOLD, margin: '0 auto 22px', width: 70, height: 70, borderRadius: '50%', backgroundColor: 'rgba(197,143,59,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>
        <h2 style={{ fontFamily: DSP, fontSize: 40, color: BLACK, margin: '0 0 14px' }}>Booking Received</h2>

        <p style={{ color: 'rgba(26,26,26,0.7)', fontSize: 16, maxWidth: 450, margin: '0 auto 24px', lineHeight: 1.6 }}>
          Thank you, <strong style={{ color: BLACK }}>{displayFullName}</strong>! Your appointment at <strong style={{ color: GOLD }}>{branch}</strong> on <strong style={{ color: BLACK }}>{date}</strong> at <strong style={{ color: BLACK }}>{time.toUpperCase()}</strong> is officially on our calendar.
        </p>

        <div style={{ backgroundColor: WHITE, border: '1px solid rgba(197,143,59,0.3)', borderRadius: 16, padding: '24px', maxWidth: 450, margin: '0 auto 32px', textAlign: 'left', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          {email.trim() && (
            <>
              <p style={{ fontSize: 14, color: BLACK, margin: '0 0 12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>✉️</span> Please check your inbox for the receipt <span style={{ color: GOLD }}>{email}</span>
              </p>
              <div style={{ height: 1, backgroundColor: 'rgba(26,26,26,0.05)', margin: '16px 0' }} />
            </>
          )}
          <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.65)', margin: '0 0 8px', lineHeight: 1.5 }}>
            <strong style={{ color: BLACK }}>Important:</strong> Sabbath Spa will confirm your appointment 1 hour before your check-in via SMS or Call.
          </p>
          <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.65)', margin: 0, lineHeight: 1.5 }}>
            For immediate concerns, please contact us at <strong style={{ color: BLACK }}>0917 199 7772</strong>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => window.print()} style={{ height: 50, padding: '0 32px', backgroundColor: BLACK, color: GOLD, border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 200ms ease' }}>
            Print Receipt
          </button>
          <button onClick={() => window.location.reload()} style={{ height: 50, padding: '0 32px', backgroundColor: 'transparent', color: BLACK, border: '1px solid rgba(26,26,26,0.2)', borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 200ms ease' }}>
            Book Another Session
          </button>
        </div>
      </div>

      <div className="print-only" style={{ padding: '20px', maxWidth: '400px', margin: '0 auto', color: '#000', fontFamily: 'monospace', fontSize: '14px', lineHeight: 1.5 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h1 style={{ margin: '0 0 5px', fontSize: 22, fontWeight: 'bold' }}>{branch.toUpperCase()}</h1>
          <p style={{ margin: 0, fontSize: 12, textTransform: 'uppercase' }}>Wellness Hub</p>
          <p style={{ margin: 0, fontSize: 12, textTransform: 'uppercase' }}>Booking Receipt</p>
        </div>
        <div style={{ marginBottom: 15 }}>
          <p style={{ margin: 0 }}><strong>Date:</strong> {date}</p>
          <p style={{ margin: 0 }}><strong>Time:</strong> {time.toUpperCase()}</p>
          <p style={{ margin: 0 }}><strong>Client:</strong> {displayFullName}</p>
          <p style={{ margin: 0 }}><strong>Therapist:</strong> {selectedTherapistDisplay}</p>
        </div>
        <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '10px 0', margin: '15px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: 10 }}>
            <span>Item</span>
            <span>Amount</span>
          </div>
          {selectedServices.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ paddingRight: 10 }}>{s.name}</span>
              <span>{s.price > 0 ? fmt(s.price) : 'Contact Us'}</span>
            </div>
          ))}
          {promoDeduction > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontStyle: 'italic' }}>
              <span>Discount ({appliedPromoText})</span>
              <span>-{fmt(promoDeduction)}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 18 }}>
          <span>Total:</span>
          <span>{fmt(finalTotalAmount)}</span>
        </div>
        <div style={{ marginTop: 30, textAlign: 'center' }}>
          <p style={{ margin: 0, textTransform: 'uppercase', fontSize: 12, fontWeight: 'bold' }}>Payment Method: PAY AT COUNTER</p>
          <p style={{ margin: '15px 0 0', fontSize: 12 }}>Thank you for choosing Sabbath Spa!</p>
          <p style={{ margin: 0, fontSize: 10 }}>Have a blessed and relaxing day.</p>
        </div>
      </div>
    </>
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
        .modal-overlay { position: fixed; inset: 0; background-color: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; }
      `}</style>

      {/* ─── CONFIRMATION POPUP MODAL ─── */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div style={{ backgroundColor: '#F9F4EB', width: '100%', maxWidth: 500, borderRadius: 16, padding: 32, boxShadow: '0 24px 60px rgba(0,0,0,0.3)', fontFamily: BODY }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: DSP, fontSize: 32, margin: '0 0 8px', color: BLACK, lineHeight: 1.1 }}>Acknowledge & Confirm</h3>
            <p style={{ fontSize: 14, color: '#666', margin: '0 0 24px', lineHeight: 1.5 }}>
              Please review the exact booking details and location before finalizing the transaction.
            </p>

            <div style={{ backgroundColor: WHITE, border: '1px solid rgba(197,143,59,0.3)', borderRadius: 12, padding: 20, marginBottom: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(26,26,26,0.1)', paddingBottom: 14, marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: GOLD, textTransform: 'uppercase' }}>Booking Summary</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: BLACK }}>{fmt(finalTotalAmount)}</span>
              </div>

              <div style={{ fontSize: 13, color: BLACK, lineHeight: 1.6 }}>
                <div style={{ display: 'flex', marginBottom: 8 }}><strong style={{ width: 100, color: '#666' }}>Client:</strong> <span>{displayFullName}</span></div>
                <div style={{ display: 'flex', marginBottom: 8 }}><strong style={{ width: 100, color: '#666' }}>Branch:</strong> <span style={{ fontWeight: 700, color: GOLD }}>{branch}</span></div>
                <div style={{ display: 'flex', marginBottom: 8 }}><strong style={{ width: 100, color: '#666' }}>Schedule:</strong> <span>{date} at {time.toUpperCase()}</span></div>
                <div style={{ display: 'flex', marginBottom: 8 }}><strong style={{ width: 100, color: '#666' }}>Therapist:</strong> <span>{selectedTherapistDisplay}</span></div>

                <div style={{ marginTop: 16, padding: '12px 14px', backgroundColor: 'rgba(61,122,74,0.05)', borderRadius: 8, border: '1px solid rgba(61,122,74,0.1)' }}>
                  <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 800, color: '#3D7A4A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Services Selected:</p>
                  <p style={{ margin: 0, fontSize: 13, color: BLACK, fontWeight: 600, lineHeight: 1.4 }}>
                    {selectedServices.map(s => s.name).join(', ')}
                  </p>
                </div>

                {appliedPromoText && (
                  <p style={{ margin: '12px 0 0', fontSize: 12, color: '#C83232', fontWeight: 600 }}>Discount Applied: {appliedPromoText} (-₱{promoDeduction.toLocaleString()})</p>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" onClick={() => setShowConfirmModal(false)} style={{ flex: 1, height: 50, backgroundColor: 'transparent', border: '1px solid rgba(26,26,26,0.2)', borderRadius: 10, color: BLACK, fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 200ms ease' }}>
                Decline / Cancel
              </button>
              <button type="button" onClick={executeBooking} style={{ flex: 1, height: 50, backgroundColor: BLACK, border: 'none', borderRadius: 10, color: GOLD, fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 200ms ease' }}>
                Confirm Transaction
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: BG, minHeight: '100dvh', padding: '40px 20px', fontFamily: BODY }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.20em', color: GOLD, margin: '0 0 10px', textTransform: 'uppercase' }}>Reserve Your Visit</p>
            <h1 style={{ fontFamily: DSP, fontSize: 40, color: BLACK, margin: '0 0 8px', lineHeight: 1.1 }}>Book a Session</h1>
          </div>

          <form onSubmit={handleFormPreSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }} noValidate>

            <Section title="Client Information">
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: 12, alignItems: 'start' }}>
                <Field label="First Name *">
                  <input className="bk-in" style={{ ...INPUT, ...eb(validation.firstName) }} value={firstName} onChange={e => setFirstName(autoCapitalize(e.target.value))} placeholder="Maria" />
                </Field>
                <Field label="M.I.">
                  <input className="bk-in" maxLength={1} style={{ ...INPUT, textAlign: 'center' }} value={middleInitial} onChange={e => setMiddleInitial(e.target.value.toUpperCase())} placeholder="A" />
                </Field>
                <Field label="Last Name *">
                  <input className="bk-in" style={{ ...INPUT, ...eb(validation.lastName) }} value={lastName} onChange={e => setLastName(autoCapitalize(e.target.value))} placeholder="Santos" />
                </Field>
              </div>
              <Row2>
                <Field label="Mobile Number *">
                  <input className="bk-in" style={{ ...INPUT, ...eb(validation.mobile) }} type="tel" inputMode="numeric" value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, ''))} placeholder="09XX XXX XXXX" />
                </Field>
                <Field label="Email Address (Optional)">
                  <input className="bk-in" style={{ ...INPUT, ...eb(validation.email) }} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="maria@example.com" />
                </Field>
              </Row2>
            </Section>

            <Section title="Select Branch" note="Please confirm your preferred location">
              <Field label="Branch Location *">
                <select
                  className="bk-in"
                  style={SELECT}
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                >
                  <option value="Sabbath Malolos">Sabbath Malolos</option>
                  <option value="Sabbath Pulilan">Sabbath Pulilan</option>
                </select>
              </Field>
            </Section>

            <Section title="Select Services" note={selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Choose one or more'}>
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
              ) : validServices.length === 0 && customServices.length === 0 ? (
                <div style={{ backgroundColor: 'rgba(139,58,58,0.05)', padding: 16, borderRadius: 8, border: '1px solid rgba(139,58,58,0.2)' }}>
                  <p style={{ color: '#8B3A3A', fontSize: 14, margin: 0, fontWeight: 600 }}>No services found in database.</p>
                </div>
              ) : (
                <div className="svc-scroll" style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 8, display: 'flex', flexDirection: 'column', gap: 20 }}>

                  {massageServices.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, marginBottom: 12 }}>Massage Therapy</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(220px,100%),1fr))', gap: 10 }}>
                        {massageServices.map(s => <ServiceChip key={s.id} item={s} selected={selectedIds.has(s.id)} onToggle={() => toggleService(s.id)} />)}
                      </div>
                    </div>
                  )}

                  {branch !== 'Sabbath Pulilan' && nailServices.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, marginBottom: 12 }}>Le Nails Salon</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(220px,100%),1fr))', gap: 10 }}>
                        {nailServices.map(s => (
                          <ServiceChip
                            key={s.id}
                            item={s}
                            selected={selectedIds.has(s.id)}
                            onToggle={() => toggleService(s.id)}
                            discountPct={nailDiscountPercentage}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {waxServices.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, marginBottom: 12 }}>Wax Service</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(220px,100%),1fr))', gap: 10 }}>
                        {waxServices.map(s => <ServiceChip key={s.id} item={s} selected={selectedIds.has(s.id)} onToggle={() => toggleService(s.id)} />)}
                      </div>
                    </div>
                  )}

                  {wellnessPackages.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, marginBottom: 12 }}>Private Wellness Suite & Sabbath Spa Packages</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(220px,100%),1fr))', gap: 10 }}>
                        {wellnessPackages.map(s => <ServiceChip key={s.id} item={s} selected={selectedIds.has(s.id)} onToggle={() => toggleService(s.id)} />)}
                      </div>
                    </div>
                  )}

                  {branch !== 'Sabbath Pulilan' && packageServices.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, marginBottom: 12 }}>Packages & Savings</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(220px,100%),1fr))', gap: 10 }}>
                        {packageServices.map(s => <ServiceChip key={s.id} item={s} selected={selectedIds.has(s.id)} onToggle={() => toggleService(s.id)} />)}
                      </div>
                    </div>
                  )}

                  {customServices.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, marginBottom: 12 }}>Custom Services</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(220px,100%),1fr))', gap: 10 }}>
                        {customServices.map(s => <ServiceChip key={s.id} item={s} selected={selectedIds.has(s.id)} onToggle={() => toggleService(s.id)} />)}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 10, padding: 16, backgroundColor: 'rgba(26,26,26,0.02)', borderRadius: 12, border: '1px dashed rgba(26,26,26,0.2)' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#666', marginBottom: 12 }}>Add Custom Service</p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <input className="bk-in" style={{ ...INPUT, flex: '2 1 200px', height: 44, fontSize: 14 }} placeholder="Custom Service Name" value={customSvcName} onChange={e => setCustomSvcName(e.target.value)} />
                      <div style={{ position: 'relative', flex: '1 1 100px' }}>
                        <span style={{ position: 'absolute', left: 12, top: 13, fontSize: 14, color: '#666', fontWeight: 600 }}>₱</span>
                        <input className="bk-in" style={{ ...INPUT, height: 44, fontSize: 14, paddingLeft: 28 }} type="number" placeholder="Price" value={customSvcPrice} onChange={e => setCustomSvcPrice(e.target.value)} />
                      </div>
                      <button type="button" onClick={handleAddCustomService} style={{ height: 44, padding: '0 20px', backgroundColor: BLACK, color: GOLD, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ ADD</button>
                    </div>
                  </div>

                </div>
              )}
            </Section>

            <Section title="Appointment Details">
              <Row2>
                <Field label="Preferred Date *">
                  <input suppressHydrationWarning className="bk-in" type="date" min={minApptDate} style={{ ...INPUT, ...eb(validation.date) }} value={date} onChange={e => setDate(e.target.value)} />
                </Field>

                {/* ── RESTORED & UPGRADED: 15-MINUTE STRICT DROPDOWN ── */}
                <Field label="Preferred Time *">
                  <select className="bk-in" style={{ ...SELECT, ...eb(validation.time) }} value={time} onChange={e => setTime(e.target.value)}>
                    <option value="">--:-- --</option>
                    {availableSlots.map(s => (
                      <option key={s.time} value={s.time} disabled={!s.available}>
                        {s.time} {!s.available ? ' (Booked/Unavailable)' : ''}
                      </option>
                    ))}
                  </select>
                </Field>
              </Row2>

              <Field label={therapistLoad ? 'Staff Selection (loading…)' : `Staff Selection (${branch})`}>
                <input className="bk-in" style={{ ...INPUT, marginBottom: 10, height: 44, fontSize: 14 }} placeholder={`Search staff in ${branch}...`} value={therapistSearch} onChange={e => setTherapistSearch(e.target.value)} />
                <select className="bk-in" style={SELECT} value={therapistId} onChange={e => setTherapistId(e.target.value)}>
                  <option value="">Any Available Staff / No Preference</option>
                  {filteredTherapists.map(t => (
                    <option key={t.id} value={t.id} disabled={isTherapistDisabled(t)}>
                      {t.name}{getTherapistStatus(t)}
                    </option>
                  ))}
                </select>
                {selectedServices.length > 0 && (
                  <p style={{ fontSize: 11, color: '#666', fontStyle: 'italic', marginTop: 8, marginBottom: 0 }}>
                    Showing specialized staff for your selected services.
                  </p>
                )}
              </Field>

              {/* ── OPERATING HOURS INFO ── */}
              <div style={{ marginTop: 12, padding: '16px', backgroundColor: '#fafafa', borderRadius: 12, border: '1px solid rgba(26,26,26,0.08)' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.05em' }}>
                  Sabbath Spa Operating Hours
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: BLACK, fontWeight: 600 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(26,26,26,0.1)', paddingBottom: 8 }}>
                    <span>Monday – Saturday</span>
                    <span style={{ color: GOLD }}>11:00 AM – 12:00 AM</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Sunday</span>
                    <span style={{ color: GOLD }}>1:00 PM – 12:00 AM</span>
                  </div>
                </div>
              </div>

            </Section>

            <Section
              title="Discounts & Promos"
              note={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Select active promo options directly. <span style={{ color: '#C83232', fontWeight: 600 }}>*Will be verified upon checking in</span></span>}
            >
              <Field label="Choose Available Discount">
                <div style={{ display: 'flex', gap: 10 }}>
                  <select className="bk-in" style={{ ...SELECT, flex: 2 }} value={discountMode} onChange={e => { setDiscountMode(e.target.value); setCustomDiscountVal(''); }}>
                    <option value="none">No Discount</option>
                    <option value="senior">Senior Citizen (20%)</option>
                    <option value="pwd">PWD (20%)</option>
                    {dbDiscounts.map(d => (
                      <option key={d.id} value={`db-${d.id}`}>{d.name} ({d.discount_percentage}%)</option>
                    ))}
                    <option value="custom_pct">Custom %</option>
                    <option value="custom_amount">Custom ₱</option>
                  </select>

                  {(discountMode === 'custom_pct' || discountMode === 'custom_amount') && (
                    <div style={{ position: 'relative', flex: 1 }}>
                      <span style={{ position: 'absolute', left: 14, top: 18, fontSize: 14, color: '#666', fontWeight: 700 }}>
                        {discountMode === 'custom_amount' ? '₱' : '%'}
                      </span>
                      <input className="bk-in" style={{ ...INPUT, paddingLeft: 34 }} type="number" value={customDiscountVal} onChange={e => setCustomDiscountVal(e.target.value)} placeholder={discountMode === 'custom_amount' ? 'Amount' : 'Percentage'} />
                    </div>
                  )}
                </div>
              </Field>

              {promoDeduction > 0 && (
                <div style={{ padding: '12px 16px', backgroundColor: 'rgba(61,122,74,0.1)', border: '1px solid rgba(61,122,74,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 16, color: '#3D7A4A' }}>✓</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#3D7A4A', textTransform: 'uppercase' }}>{appliedPromoText} APPLIED</div>
                    <div style={{ fontSize: 12, color: '#2A2A2A' }}>₱{promoDeduction.toLocaleString()} deduction applied to total checkout cost</div>
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