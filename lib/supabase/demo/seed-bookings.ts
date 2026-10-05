// lib/supabase/demo/seed-bookings.ts
// DEMO MODE ONLY — fake bookings, services, staff and products.
// Booking rows carry both column families the app reads: the legacy POS set
// (booking_id, appointment_date, appointment_time '2:30 PM', status 'Completed')
// and the normalized set (id, booking_date, booking_time '14:30:00',
// booking_status 'completed'). payment_status is lowercase ('paid' / 'unpaid');
// the POS screens upper-case it on read. All data is invented.

import {
  BRANCHES, CLIENTS, SERVICES, STAFF, THERAPISTS, TODAY,
  dayOffset, isoAt, makeRng, uuid,
} from './fixtures'
import type { DemoClient, DemoService, DemoStaff } from './fixtures'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
type Rng = ReturnType<typeof makeRng>
type LegacyStatus = 'Pending' | 'Ongoing' | 'Completed' | 'Hold' | 'Cancelled'

const NS_BOOKING = 0xb00c
const NS_BOOKING_PRODUCT = 0xb0b0
const NS_PRODUCT = 0xf00d

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// ─────────────────────────────────────────────────────────────
// Services — fixture categories mapped to the labels the UI groups by
// (services page orders 'Massage Services' then 'Le Nails Salon')
// ─────────────────────────────────────────────────────────────
const CATEGORY_LABEL: Record<string, string> = {
  Massage: 'Massage Services',
  'Foot Spa': 'Massage Services',
  Facial: 'Facial Treatments',
  'Body Scrub': 'Body Treatments',
  Nails: 'Le Nails Salon',
  'Wellness Suite': 'Wellness Suite',
}

const SERVICE_BLURB: Record<string, string> = {
  'Swedish Massage': 'Long, flowing strokes that ease tension and improve circulation.',
  'Deep Tissue Massage': 'Firm, slow pressure that works into stubborn knots in the back and shoulders.',
  'Hilot Traditional Massage': 'Filipino healing massage with warm coconut oil and banana leaves.',
  'Hot Stone Massage': 'Heated basalt stones melt away deep muscle tension.',
  'Ventosa Cupping': 'Traditional cupping paired with a relaxing back massage.',
  'Foot Reflexology': 'Pressure-point foot massage that restores balance from the ground up.',
  'Classic Facial': 'Deep cleanse, gentle extraction and a hydrating mask.',
  'Body Scrub & Wrap': 'Full-body exfoliation followed by a nourishing wrap.',
  'Manicure & Pedicure': 'Nail shaping, cuticle care and polish for hands and feet.',
  'Wellness Suite (2 hrs)': 'Private suite with sauna, jacuzzi and shower for up to two guests.',
}

const SERVICE_WEIGHT: Record<string, number> = {
  'Swedish Massage': 22,
  'Deep Tissue Massage': 14,
  'Hilot Traditional Massage': 12,
  'Hot Stone Massage': 7,
  'Ventosa Cupping': 7,
  'Foot Reflexology': 14,
  'Classic Facial': 7,
  'Body Scrub & Wrap': 5,
  'Manicure & Pedicure': 9,
  'Wellness Suite (2 hrs)': 4,
}

const isNail = (s: DemoService) => s.category === 'Nails'

// ─────────────────────────────────────────────────────────────
// Staff — off_days is a comma list of weekday names (staff page + Gantt)
// ─────────────────────────────────────────────────────────────
const OFF_DAYS = ['Tuesday', 'Wednesday', 'Thursday', 'Monday', 'Monday', 'Friday', 'Wednesday', 'Sunday']
const MASSAGE_SPECIALTIES = ['Swedish & Hilot', 'Deep Tissue & Hot Stone', 'Ventosa & Reflexology']
const OFF_DAY_BY_ID = new Map(STAFF.map((s, i) => [s.id, OFF_DAYS[i % OFF_DAYS.length]]))

function specialtyOf(s: DemoStaff, i: number): string {
  if (s.role === 'Nail Technician') return 'Nail Care'
  if (s.role === 'Receptionist') return 'Front Desk'
  return MASSAGE_SPECIALTIES[i % MASSAGE_SPECIALTIES.length]
}

const canServe = (t: DemoStaff, s: DemoService) =>
  isNail(s) ? t.role === 'Nail Technician' : t.role === 'Massage Therapist'

// ─────────────────────────────────────────────────────────────
// Products — Sabasu food & drinks plus a little retail (booking add-ons)
// ─────────────────────────────────────────────────────────────
const PRODUCTS = ([
  ['Shoyu Ramen', 'Food', 280],
  ['Tonkotsu Ramen', 'Food', 320],
  ['Chicken Teriyaki Rice', 'Food', 260],
  ['Beef Gyudon', 'Food', 290],
  ['Brewed Coffee', 'Beverage', 120],
  ['Iced Matcha Latte', 'Beverage', 160],
  ['Ginger Lemongrass Tea', 'Beverage', 90],
  ['Calamansi Juice', 'Beverage', 80],
  ['Bottled Water', 'Beverage', 40],
  ['Chocolate Chip Cookies (3 pcs)', 'Dessert', 120],
  ['Mango Float Cup', 'Dessert', 140],
  ['Spa Slippers', 'Retail', 210],
  ['Lavender Massage Oil 100ml', 'Retail', 350],
] as [string, string, number][]).map(([name, category, price], i) => ({
  id: uuid(NS_PRODUCT, i + 1),
  name,
  category,
  price,
}))

// ─────────────────────────────────────────────────────────────
// Payments — upper-case labels matching the POS <select> options
// (fixtures' Maya / Card have no option there, so QRPH / MASTERCARD stand in)
// ─────────────────────────────────────────────────────────────
const PAID_METHODS: [string, number][] = [
  ['CASH', 42], ['GCASH', 36], ['QRPH', 10], ['BANK TRANSFER', 6], ['MASTERCARD', 6],
]
const SOURCES: [string, number][] = [
  ['walk_in', 35], ['website', 28], ['facebook', 20], ['phone', 14], ['admin', 3],
]
const NOTE_POOL = [
  'Prefers firm pressure',
  'Light pressure only, please',
  'Focus on lower back',
  'Stiff neck and shoulders',
  'Allergic to lavender oil',
  'Requested a female therapist',
  'Celebrating a birthday today',
  'Referred by a friend',
  'Avoid the left knee (old injury)',
  'Prefers a quiet room',
]

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function weighted<T>(r: Rng, items: readonly T[], weight: (t: T) => number): T {
  const total = items.reduce((sum, t) => sum + weight(t), 0)
  let x = r.next() * total
  for (const t of items) {
    x -= weight(t)
    if (x < 0) return t
  }
  return items[items.length - 1]
}

const pickPair = (r: Rng, pairs: [string, number][]) => weighted(r, pairs, (p) => p[1])[0]

const weekdayOf = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]

/** Opens 11:00 AM Mon–Sat, 1:00 PM Sunday; last call 12:00 AM (app/booking/page.tsx). */
const openMin = (date: string) => (weekdayOf(date) === 'Sunday' ? 13 * 60 : 11 * 60)
const LAST_START = 22 * 60
const CLOSE = 24 * 60

/** '2:30 PM' — the legacy appointment_time format. */
function to12h(mins: number): string {
  const h24 = Math.floor(mins / 60) % 24
  const ampm = h24 >= 12 ? 'PM' : 'AM'
  return `${h24 % 12 || 12}:${String(mins % 60).padStart(2, '0')} ${ampm}`
}

/** '14:30:00' — the Postgres time format of booking_time. */
function to24h(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  return `${String(h).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:00`
}

/** ISO timestamp for minutes after Manila midnight on `date` (may roll past midnight). */
const isoAtMins = (date: string, mins: number) =>
  new Date(new Date(isoAt(date, '00:00')).getTime() + mins * 60000).toISOString()

function manilaNowMinutes(): number {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

function refNo(r: Rng): string {
  return `${r.int(1000, 9999)} ${r.int(100, 999)} ${r.int(100000, 999999)}`
}

// ─────────────────────────────────────────────────────────────
// Day planner — keeps therapists from double-booking (15-min padding,
// same rule as the public booking form) and clients to one visit a day
// ─────────────────────────────────────────────────────────────
type DayPlan = { date: string; busy: Map<string, [number, number][]>; clientsUsed: Set<string> }

const newPlan = (date: string): DayPlan => ({ date, busy: new Map(), clientsUsed: new Set() })

function onDuty(date: string, branch: string): DemoStaff[] {
  const wd = weekdayOf(date)
  return THERAPISTS.filter((t) => t.branch === branch && OFF_DAY_BY_ID.get(t.id) !== wd)
}

function isFree(plan: DayPlan, id: string, start: number, end: number): boolean {
  return !(plan.busy.get(id) ?? []).some(([s, e]) => start - 15 < e && s - 15 < end)
}

function reserve(plan: DayPlan, id: string, start: number, end: number) {
  const list = plan.busy.get(id) ?? []
  list.push([start, end])
  plan.busy.set(id, list)
}

function freeTherapist(r: Rng, plan: DayPlan, branch: string, s: DemoService, start: number, end: number) {
  const pool = onDuty(plan.date, branch).filter((t) => canServe(t, s) && isFree(plan, t.id, start, end))
  return pool.length ? r.pick(pool) : null
}

const offeredServices = (date: string, branch: string) =>
  SERVICES.filter((s) => onDuty(date, branch).some((t) => canServe(t, s)))

const HOME_CLIENTS: Record<string, DemoClient[]> = Object.fromEntries(
  BRANCHES.map((b) => [b, CLIENTS.filter((c) => c.branch === b)]),
)

/** Mostly home-branch clients, biased toward "regulars" at the front of the list. */
function pickClient(r: Rng, plan: DayPlan, branch: string): DemoClient {
  for (let tries = 0; tries < 15; tries++) {
    const pool = r.chance(0.8) ? HOME_CLIENTS[branch] : CLIENTS
    const c = pool[Math.floor(Math.pow(r.next(), 1.5) * pool.length)]
    if (plan.clientsUsed.has(c.id) || c.created_at.slice(0, 10) > plan.date) continue
    plan.clientsUsed.add(c.id)
    return c
  }
  const c = CLIENTS.find((x) => !plan.clientsUsed.has(x.id)) ?? CLIENTS[0]
  plan.clientsUsed.add(c.id)
  return c
}

// ─────────────────────────────────────────────────────────────
// Row builder
// ─────────────────────────────────────────────────────────────
type Draft = {
  n: number
  date: string
  branch: string
  start: number
  service: DemoService
  therapist: DemoStaff | null
  client: DemoClient
  status: LegacyStatus
  bookingStatus: string
  source: string
  paid: boolean
  method: string
  discountPct: number
  addMins: number
  createdAt: string
  notes: string
  reminderSent: boolean
}

function buildBooking(d: Draft, r: Rng): Row {
  const id = uuid(NS_BOOKING, d.n)
  const addPrice = (d.addMins / 30) * 300 // 'ADDITIONAL 30 MINS' is ₱300 on the menu
  const gross = d.service.price + addPrice
  const discountAmount = Math.round((gross * d.discountPct) / 100)
  const net = gross - discountAmount
  const duration = d.service.duration_minutes + d.addMins
  const nails = isNail(d.service)
  const method = d.paid ? d.method : 'PAY AT COUNTER'
  const email = d.source === 'walk_in' ? '' : d.client.email
  const completedAt = d.status === 'Completed' ? isoAtMins(d.date, d.start + duration) : null
  const updatedAt = completedAt ?? (d.status === 'Ongoing' ? isoAtMins(d.date, d.start) : d.createdAt)

  return {
    id,
    booking_id: id,

    // ── legacy POS columns (overview, ledger, payments, staff, public form) ──
    branch: d.branch,
    client_name: d.client.full_name,
    client_mobile: d.client.phone,
    client_email: email,
    service_name: d.service.name,
    price: d.service.price,
    therapist_name: d.therapist?.full_name ?? null,
    appointment_date: d.date,
    appointment_time: to12h(d.start),
    status: d.status,
    payment_method: method,
    payment_status: d.paid ? 'paid' : 'unpaid',
    received_payment: d.paid ? net : 0,
    ref_no: d.paid && method !== 'CASH' ? refNo(r) : '',
    receipt_url: '',
    discount_pct: d.discountPct,
    therapist_comm_pct: d.therapist ? (nails ? 20 : 30) : 0,
    additional_mins: d.addMins,
    additional_price: addPrice,
    reminder_sent: d.reminderSent && email !== '',
    notes: d.notes,

    // ── normalized columns (booking detail/edit, reports, sales, clients) ──
    client_id: d.client.id,
    service_id: d.service.id,
    therapist_id: d.therapist?.id ?? null,
    booking_date: d.date,
    booking_time: to24h(d.start),
    duration_minutes: duration,
    booking_source: d.source,
    booking_status: d.bookingStatus,
    category: nails ? 'LE NAILS' : 'SABBATH',
    client_name_text: d.client.full_name,
    service_name_text: d.service.name,
    therapist_name_text: d.therapist?.full_name ?? null,
    customer_type: 'returning', // finalized in seedBookings()
    membership_type: null,
    total_amount: gross,
    discount_amount: discountAmount,
    net_sales: net,
    completed_at: completedAt,
    created_at: d.createdAt,
    updated_at: updatedAt,

    // ── embedded relations, under the keys the select strings use ──
    services: {
      id: d.service.id,
      service_name: d.service.name,
      price: d.service.price,
      duration_minutes: d.service.duration_minutes,
      category: CATEGORY_LABEL[d.service.category] ?? d.service.category,
    },
    clients: {
      id: d.client.id,
      full_name: d.client.full_name,
      mobile_number: d.client.phone,
      email: d.client.email,
      discounts: null,
    },
  }
}

function discountFor(r: Rng): { pct: number; note: string } {
  if (!r.chance(0.1)) return { pct: 0, note: '' }
  const pct = r.pick([20, 20, 10])
  const note = pct === 20 ? r.pick(['Senior Citizen ID presented', 'PWD ID presented']) : 'Birthday promo (10%)'
  return { pct, note }
}

const joinNotes = (...parts: string[]) => parts.filter(Boolean).join(' · ')

// ─────────────────────────────────────────────────────────────
// Past (-60..-1) and upcoming (+1..+7) days
// ─────────────────────────────────────────────────────────────
function dailyCount(r: Rng, weekday: string): number {
  if (weekday === 'Saturday') return r.int(2, 4)
  if (weekday === 'Friday' || weekday === 'Sunday') return r.int(2, 3)
  return r.int(1, 3)
}

function placeBooking(r: Rng, plan: DayPlan, branch: string, allowExtension: boolean) {
  const offered = offeredServices(plan.date, branch)
  if (!offered.length) return null
  const open = openMin(plan.date)
  for (let tries = 0; tries < 10; tries++) {
    const service = weighted(r, offered, (s) => SERVICE_WEIGHT[s.name] ?? 5)
    const extendable = allowExtension && !isNail(service) && service.category !== 'Wellness Suite'
    const addMins = extendable && r.chance(0.12) ? (r.chance(0.3) ? 60 : 30) : 0
    const duration = service.duration_minutes + addMins
    const last = Math.min(LAST_START, CLOSE - duration)
    const slots = Math.floor((last - open) / 30)
    // sqrt skews toward afternoon/evening, when the spa is busiest
    const start = open + 30 * Math.min(slots, Math.floor(Math.sqrt(r.next()) * (slots + 1)))
    const therapist = freeTherapist(r, plan, branch, service, start, start + duration)
    if (!therapist) continue
    reserve(plan, therapist.id, start, start + duration)
    return { service, start, therapist, addMins }
  }
  return null
}

function seedOtherDays(r: Rng): Row[] {
  const rows: Row[] = []
  let n = 0
  for (let off = -60; off <= 7; off++) {
    if (off === 0) continue
    const date = dayOffset(off)
    const plan = newPlan(date)
    for (const branch of BRANCHES) {
      const count = off > 0 ? r.int(0, 2) : dailyCount(r, weekdayOf(date))
      for (let k = 0; k < count; k++) {
        const past = off < 0
        const placed = placeBooking(r, plan, branch, past)
        if (!placed) continue
        const client = pickClient(r, plan, branch)
        const source = past ? pickPair(r, SOURCES) : pickPair(r, SOURCES.filter(([s]) => s !== 'walk_in'))

        let status: LegacyStatus = 'Pending'
        let bookingStatus = source === 'website' ? 'pending' : 'confirmed'
        let paid = false
        let notes = r.chance(0.25) ? r.pick(NOTE_POOL) : ''
        const disc = past ? discountFor(r) : { pct: 0, note: '' }

        if (past) {
          const roll = r.next()
          if (roll < 0.035) {
            status = 'Cancelled'
            bookingStatus = 'cancelled'
            notes = r.pick(['Client cancelled via Messenger', 'Cancelled — client feeling unwell', 'Rescheduled by client'])
          } else if (roll < 0.055) {
            status = 'Cancelled'
            bookingStatus = 'no_show'
            notes = 'No-show — tried calling twice'
          } else {
            status = 'Completed'
            bookingStatus = 'completed'
            paid = true
          }
        } else if (source === 'website' && r.chance(0.2)) {
          paid = true // GCash deposit sent with the online booking
        }

        const createdAt = source === 'walk_in'
          ? isoAtMins(date, placed.start - r.int(5, 25))
          : isoAtMins(dayOffset(past ? off - r.int(1, 5) : -r.int(1, 4)), r.int(9 * 60, 22 * 60))

        rows.push(buildBooking({
          n: ++n,
          date,
          branch,
          start: placed.start,
          service: placed.service,
          therapist: status === 'Cancelled' && r.chance(0.5) ? null : placed.therapist,
          client,
          status,
          bookingStatus,
          source,
          paid,
          method: paid ? (past ? pickPair(r, PAID_METHODS) : 'GCASH') : 'PAY AT COUNTER',
          discountPct: status === 'Completed' ? disc.pct : 0,
          addMins: status === 'Completed' ? placed.addMins : 0,
          createdAt,
          notes: joinNotes(notes, status === 'Completed' ? disc.note : ''),
          reminderSent: past,
        }, r))
      }
    }
  }
  return rows
}

// ─────────────────────────────────────────────────────────────
// Today — a fixed script laid out around "now" (30-min grid) so the overview
// always shows a mix: completed earlier, in session now, upcoming later.
// ─────────────────────────────────────────────────────────────
type TodaySlot = {
  off: number
  status: LegacyStatus
  source: string
  unassigned?: boolean
  nails?: boolean
  addMins?: number
  discount?: [number, string]
  note?: string
  prepaid?: boolean
  fresh?: boolean // just booked online → newest in the list view
}

const TODAY_SCRIPT: Record<string, TodaySlot[]> = {
  'Sabbath Malolos': [
    { off: -240, status: 'Completed', source: 'walk_in' },
    { off: -180, status: 'Completed', source: 'facebook', discount: [20, 'Senior Citizen ID presented'] },
    { off: -150, status: 'Completed', source: 'phone', addMins: 30 },
    { off: -60, status: 'Ongoing', source: 'website', prepaid: true },
    { off: -30, status: 'Ongoing', source: 'walk_in' },
    { off: 0, status: 'Hold', source: 'phone', note: 'Client called — running 15 mins late' },
    { off: 30, status: 'Pending', source: 'website', unassigned: true, fresh: true },
    { off: 60, status: 'Cancelled', source: 'facebook', note: 'Client cancelled via Messenger' },
    { off: 120, status: 'Pending', source: 'phone' },
  ],
  'Sabbath Pulilan': [
    { off: -210, status: 'Completed', source: 'walk_in' },
    { off: -120, status: 'Completed', source: 'website', nails: true },
    { off: -90, status: 'Completed', source: 'phone' },
    { off: -30, status: 'Ongoing', source: 'walk_in' },
    { off: 60, status: 'Pending', source: 'facebook', nails: true },
    { off: 150, status: 'Pending', source: 'website', unassigned: true, fresh: true },
  ],
}

const TODAY_BOOKING_STATUS: Record<LegacyStatus, string> = {
  Completed: 'completed',
  Ongoing: 'in_progress',
  Hold: 'pending',
  Pending: 'confirmed',
  Cancelled: 'cancelled',
}

function seedToday(r: Rng): Row[] {
  const date = TODAY
  const open = openMin(date)
  // Anchor = now on a 30-min grid, kept late enough that the earliest slot is
  // after opening and early enough that the latest one ends by midnight.
  const anchor = Math.min(Math.max(Math.floor(manilaNowMinutes() / 30) * 30, open + 240), 20 * 60 + 30)
  const plan = newPlan(date)
  const rows: Row[] = []
  let n = 5000

  for (const branch of BRANCHES) {
    const offered = offeredServices(date, branch)
    for (const slot of TODAY_SCRIPT[branch]) {
      const start = anchor + slot.off
      const addMins = slot.addMins ?? 0
      const fits = (s: DemoService) => {
        const end = start + s.duration_minutes + addMins
        if (end > CLOSE) return false
        if (slot.status === 'Completed') return end <= anchor
        if (slot.status === 'Ongoing') return end > anchor
        return true
      }
      const wantNails = offered.filter((s) => isNail(s) && fits(s))
      let candidates = slot.nails && wantNails.length ? wantNails : offered.filter((s) => !isNail(s) && fits(s))
      if (!candidates.length) candidates = offered.filter((s) => !isNail(s))
      const service = weighted(r, candidates, (s) => SERVICE_WEIGHT[s.name] ?? 5)
      const end = start + service.duration_minutes + addMins

      const therapist = slot.unassigned ? null : freeTherapist(r, plan, branch, service, start, end)
      if (therapist) reserve(plan, therapist.id, start, end)

      const client = pickClient(r, plan, branch)
      const paid = slot.status === 'Completed' || Boolean(slot.prepaid)
      let bookingStatus = TODAY_BOOKING_STATUS[slot.status]
      if (slot.status === 'Pending' && slot.source === 'website') bookingStatus = 'pending'

      const createdAt = slot.source === 'walk_in'
        ? isoAtMins(date, start - r.int(5, 20))
        : slot.fresh
          ? isoAtMins(date, anchor - r.int(10, 45))
          : isoAtMins(dayOffset(-r.int(1, 3)), r.int(9 * 60, 22 * 60))

      rows.push(buildBooking({
        n: ++n,
        date,
        branch,
        start,
        service,
        therapist,
        client,
        status: slot.status,
        bookingStatus,
        source: slot.source,
        paid,
        method: slot.prepaid ? 'GCASH' : pickPair(r, PAID_METHODS),
        discountPct: slot.discount?.[0] ?? 0,
        addMins,
        createdAt,
        notes: joinNotes(slot.note ?? (r.chance(0.3) ? r.pick(NOTE_POOL) : ''), slot.discount?.[1] ?? ''),
        reminderSent: start <= anchor + 60,
      }, r))
    }
  }
  return rows
}

// ─────────────────────────────────────────────────────────────
// booking_products — F&B / retail add-ons on some completed visits
// ─────────────────────────────────────────────────────────────
function seedBookingProducts(r: Rng, bookings: Row[]): Row[] {
  const rows: Row[] = []
  let n = 0
  for (const b of bookings) {
    if (b.status !== 'Completed' || !r.chance(0.18)) continue
    const picks = new Set<number>()
    const count = r.chance(0.35) ? 2 : 1
    while (picks.size < count) picks.add(r.int(0, PRODUCTS.length - 1))
    for (const idx of picks) {
      const p = PRODUCTS[idx]
      rows.push({
        id: uuid(NS_BOOKING_PRODUCT, ++n),
        booking_id: b.id,
        product_id: p.id,
        quantity: p.category === 'Beverage' && r.chance(0.4) ? 2 : 1,
        unit_price: p.price,
        created_at: b.completed_at ?? b.created_at,
        products: { id: p.id, name: p.name, category: p.category, price: p.price },
      })
    }
  }
  return rows
}

// ─────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────
export function seedBookings(): Record<string, Row[]> {
  // Separate generators: other days never shift with the time-of-day script.
  const other = seedOtherDays(makeRng(20261006))
  const today = seedToday(makeRng(20261007))

  const bookings = [...other, ...today].sort((a, b) =>
    `${a.booking_date} ${a.booking_time}`.localeCompare(`${b.booking_date} ${b.booking_time}`))

  // First visit in the window = 'new', the rest 'returning' (lib/actions/sales.ts)
  const seen = new Set<string>()
  for (const b of bookings) {
    b.customer_type = seen.has(b.client_id) ? 'returning' : 'new'
    seen.add(b.client_id)
  }

  const productRng = makeRng(20261008)
  const booking_products = [
    ...seedBookingProducts(productRng, bookings.filter((b) => b.booking_date !== TODAY)),
    ...seedBookingProducts(productRng, bookings.filter((b) => b.booking_date === TODAY)),
  ]

  const seededAt = isoAt(dayOffset(-365), '09:00')

  const services = SERVICES.map((s) => ({
    id: s.id,
    service_name: s.name,
    name: s.name,
    category: CATEGORY_LABEL[s.category] ?? s.category,
    description: SERVICE_BLURB[s.name] ?? null,
    duration_minutes: s.duration_minutes,
    duration: `${s.duration_minutes} min`,
    price: s.price,
    promo_price: null,
    active: true,
    created_at: seededAt,
    updated_at: seededAt,
  }))

  const staff = STAFF.map((s, i) => ({
    id: s.id,
    name: s.full_name,
    full_name: s.full_name,
    role: s.role,
    specialty: specialtyOf(s, i),
    status: 'Available',
    branch: s.branch,
    off_days: OFF_DAY_BY_ID.get(s.id) ?? '',
    phone: s.phone,
    email: s.email,
    created_at: isoAt(dayOffset(-300 + i * 17), '09:00'),
  }))

  const therapists = THERAPISTS.map((t) => {
    const i = STAFF.findIndex((s) => s.id === t.id)
    return {
      id: t.id,
      full_name: t.full_name,
      name: t.full_name,
      specialty: specialtyOf(t, i),
      status: 'active',
      branch: t.branch,
      phone: t.phone,
      email: t.email,
      created_at: isoAt(dayOffset(-300 + i * 17), '09:00'),
    }
  })

  const products = PRODUCTS.map((p) => ({ ...p, active: true, created_at: seededAt }))

  return { bookings, booking_products, services, staff, therapists, products }
}
