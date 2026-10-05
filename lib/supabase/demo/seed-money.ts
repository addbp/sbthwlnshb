// lib/supabase/demo/seed-money.ts
// DEMO MODE ONLY — fake sales, payments, discounts and café orders.
// Owns: transactions, payments, discounts, bookings_import, sabasu_orders.
// ('receipts' is only ever a storage bucket in this codebase, never a table.)
// Every name and number here is invented.

import {
  BRANCHES,
  CLIENTS,
  DEMO_USER,
  SERVICES,
  THERAPISTS,
  TODAY,
  dayOffset,
  isoAt,
  makeRng,
  uuid,
  type DemoClient,
  type DemoService,
} from './fixtures'

type Rng = ReturnType<typeof makeRng>
type Row = Record<string, any>

// ─────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────
function weighted<T>(r: Rng, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((s, [, w]) => s + w, 0)
  let x = r.next() * total
  for (const [item, w] of items) {
    x -= w
    if (x < 0) return item
  }
  return items[items.length - 1][0]
}

function digits(r: Rng, n: number): string {
  let s = String(r.int(1, 9))
  while (s.length < n) s += String(r.int(0, 9))
  return s
}

const pad = (n: number) => String(n).padStart(2, '0')

/** 'h:mm AM' — the format the overview/bookings pages parse with /(\d+):(\d+)\s*(AM|PM)/. */
function slotLabel(h: number, m: number): string {
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`
}

function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

/**
 * `count` ascending ISO timestamps for today that never sit in the future:
 * spread from opening (11:00, or midnight if the spa hasn't opened yet) to now.
 */
function todayTimes(r: Rng, count: number): string[] {
  const now = Date.now()
  const open = Date.parse(`${TODAY}T11:00:00+08:00`)
  const start = now - open >= 30 * 60000 ? open : Date.parse(`${TODAY}T00:00:00+08:00`)
  const end = Math.max(start + 60000, now - 3 * 60000)
  const step = (end - start) / count
  return Array.from({ length: count }, (_, k) =>
    new Date(Math.round(start + step * (k + 0.2 + r.next() * 0.6))).toISOString(),
  )
}

// Spa hours 11 AM – 11 PM; afternoons and evenings are busiest.
const SLOTS: [[number, number], number][] = []
for (let h = 11; h <= 22; h++) {
  for (const m of [0, 30]) {
    const w = h < 14 ? 1 : h < 18 ? 2 : h < 22 ? 3 : 1
    SLOTS.push([[h, m], w])
  }
}

// Service mix (by fixtures index): Swedish, Deep Tissue, Hilot, Hot Stone, Ventosa,
// Foot Reflexology, Facial, Body Scrub, Mani-Pedi, Wellness Suite.
const SERVICE_WEIGHTS: [DemoService, number][] = SERVICES.map((s, i) => [
  s,
  [22, 14, 14, 7, 6, 12, 6, 5, 10, 4][i] ?? 1,
])

// Same keyword test app/dashboard/bookings/page.tsx uses to split SPA vs NAILS.
const NAIL_WORDS = ['MANICURE', 'PEDICURE', 'FOOT SPA', 'FOOT MASSAGE', 'POLISH', 'NAILS']
const isNail = (svc: string) => NAIL_WORDS.some((k) => svc.toUpperCase().includes(k))

const NAIL_TECH = THERAPISTS.find((t) => t.role === 'Nail Technician') ?? THERAPISTS[0]
const MASSEURS = THERAPISTS.filter((t) => t.role === 'Massage Therapist')

function therapistFor(r: Rng, svc: DemoService, branch: string) {
  if (isNail(svc.name)) return NAIL_TECH
  const local = MASSEURS.filter((t) => t.branch === branch)
  return r.pick(local.length ? local : MASSEURS)
}

// Membership tiers match app/dashboard/memberships/page.tsx ('Basic' | 'Gold' | 'Platinum' | 'VIP').
function tierFor(i: number): string {
  if (i % 9 === 0) return ['Gold', 'Platinum', 'Basic', 'VIP', 'Gold'][i / 9] ?? 'Gold'
  if (i % 13 === 5) return 'Basic'
  return 'Non-Member'
}
const CLIENT_TIER = new Map(CLIENTS.map((c, i) => [c.id, tierFor(i)]))

// Regulars: the first clients visit far more often than the tail.
const CLIENT_WEIGHTS: [DemoClient, number][] = CLIENTS.map((c, i) => [c, i < 10 ? 4 : i < 25 ? 2 : 1])

function pickClient(r: Rng, branch?: string): DemoClient {
  const pool = branch && r.chance(0.85)
    ? CLIENT_WEIGHTS.filter(([c]) => c.branch === branch)
    : CLIENT_WEIGHTS
  return weighted(r, pool)
}

// One-off walk-in names for imported history (invented; not in CLIENTS).
const EXTRA_FIRST = ['Aileen', 'Bryan', 'Celine', 'Dennis', 'Erika', 'Francis', 'Gemma', 'Hazel',
  'Ivan', 'Jasmine', 'Kevin', 'Lea', 'Marvin', 'Nina', 'Oscar', 'Pia', 'Ramon', 'Shiela',
  'Tonette', 'Vince', 'Wendy', 'Xandra', 'Yuri', 'Zaldy']
const EXTRA_LAST = ['Agustin', 'Bernardo', 'Cabrera', 'Domingo', 'Estrada', 'Fajardo', 'Ignacio',
  'Javier', 'Lacson', 'Morales', 'Nepomuceno', 'Pineda', 'Quiambao', 'Rivera', 'Soriano',
  'Tolentino', 'Umali', 'Valdez', 'Yap', 'Zamora']
const WALK_INS: string[] = (() => {
  const taken = new Set(CLIENTS.map((c) => c.full_name))
  const out = new Set<string>()
  for (let j = 0; out.size < 90 && j < 500; j++) {
    const name = `${EXTRA_FIRST[j % EXTRA_FIRST.length]} ${EXTRA_LAST[(j * 7 + Math.floor(j / 24)) % EXTRA_LAST.length]}`
    if (!taken.has(name)) out.add(name)
  }
  return [...out]
})()

const SERVICE_NOTES = ['Prefers firm pressure', 'Focus on shoulders and lower back', 'Light pressure only',
  'Requested female therapist', 'Referred by a friend', 'Add-on: hot compress', 'Avoid left knee (old injury)',
  'Unscented oil please']

// ─────────────────────────────────────────────────────────────
// discounts — id, name, discount_percentage (number), category, notes, active
// Names 'Basic' | 'Gold' | 'Platinum' | 'VIP' are looked up by name.toUpperCase()
// in app/membership/page.tsx.
// ─────────────────────────────────────────────────────────────
const DISCOUNT_DEFS = [
  ['senior', 'Senior Citizen', 20, 'Government', 'SENIOR', 'Valid senior citizen ID required (RA 9994)', true],
  ['pwd', 'PWD', 20, 'Government', 'PWD', 'Valid PWD ID required (RA 10754)', true],
  ['basic', 'Basic', 5, 'Membership', 'BASIC', '5% off nail services for Basic members', true],
  ['gold', 'Gold', 5, 'Membership', 'GOLD', '5% off nail services for Gold members', true],
  ['platinum', 'Platinum', 10, 'Membership', 'PLATINUM', '10% off nails for Platinum members', true],
  ['vip', 'VIP', 10, 'Membership', 'VIP', '10% off nails & wet floor for VIP members', true],
  ['birthday', 'Birthday Month', 15, 'Promo', 'BDAY15', 'Celebrant only, valid ID showing birth month', true],
  ['rainy', 'Rainy Day Promo', 10, 'Promo', 'RAINY10', 'Seasonal promo (ended)', false],
] as const

/** Stable discount ids so other seed modules can set clients.discount_id. */
export const DISCOUNT_IDS: Record<string, string> = Object.fromEntries(
  DISCOUNT_DEFS.map(([key], i) => [key, uuid(0x7a03, i + 1)]),
)

function buildDiscounts(): Row[] {
  return DISCOUNT_DEFS.map(([key, name, pct, category, code, notes, active], i) => ({
    id: DISCOUNT_IDS[key],
    name,
    discount_percentage: pct,
    category,
    code,
    notes,
    active,
    created_at: isoAt(dayOffset(-200 + i * 3), '09:00'),
    updated_at: isoAt(dayOffset(-200 + i * 3), '09:00'),
  }))
}
const DISCOUNT_BY_KEY = new Map(buildDiscounts().map((d, i) => [DISCOUNT_DEFS[i][0], d]))

// ─────────────────────────────────────────────────────────────
// bookings_import — historical services sales (read with select('*') by the
// overview, bookings, payments, clients, memberships, reports & waiver-lookup).
// Code reads: id, date 'YYYY-MM-DD', time 'h:mm AM', client_name, service, therapist,
// branch, amount, service_amount, received_payment, discount_pct, therapist_comm_pct,
// payment_method (CASH/GCASH/BANK TRANSFER/QRPH/MASTERCARD), payment_status 'PAID',
// status 'Completed', ref_no, receipt_url, additional_mins, additional_price, notes, created_at.
// Also carries the PERFECT_services_history.csv columns (booking_date, *_text, category...).
// ─────────────────────────────────────────────────────────────
function buildBookingsImport(): Row[] {
  const r = makeRng(7104)
  const rows: Row[] = []
  const seen = new Set<string>()
  let n = 0

  for (let off = -90; off <= -1; off++) {
    const date = dayOffset(off)
    const wd = weekday(date)
    const count = wd === 0 || wd === 6 ? r.int(6, 9) : wd === 5 ? r.int(5, 8) : r.int(3, 6)

    for (let k = 0; k < count; k++) {
      n++
      const branch = r.chance(0.55) ? BRANCHES[1] : BRANCHES[0]
      const svc = weighted(r, SERVICE_WEIGHTS)
      const nail = isNail(svc.name)
      const therapist = therapistFor(r, svc, branch)
      const [h, m] = weighted(r, SLOTS)

      let client: DemoClient | null = null
      let clientName: string
      const who = r.next()
      if (who < 0.62) {
        client = pickClient(r, branch)
        clientName = client.full_name
      } else if (who < 0.96) {
        clientName = r.pick(WALK_INS)
      } else {
        clientName = 'Guest'
      }
      const tier = client ? CLIENT_TIER.get(client.id) ?? 'Non-Member' : 'Non-Member'

      const amount = svc.price
      const extend = !nail && svc.category !== 'Wellness Suite' && r.chance(0.1)
      const additionalMins = extend ? 30 : 0
      const additionalPrice = extend ? Math.round(svc.price / 2 / 50) * 50 : 0

      let discountPct = 0
      if (tier !== 'Non-Member' && nail) discountPct = tier === 'Basic' || tier === 'Gold' ? 5 : 10
      else if (r.chance(0.07)) discountPct = 20
      else if (r.chance(0.03)) discountPct = 15

      const gross = amount + additionalPrice
      const discountAmount = Math.round(gross * discountPct / 100)
      const net = gross - discountAmount

      const method = weighted(r, [['CASH', 45], ['GCASH', 30], ['MASTERCARD', 10], ['QRPH', 8], ['BANK TRANSFER', 7]] as const)
      const refNo = method === 'CASH' ? ''
        : method === 'GCASH' ? digits(r, 13)
        : method === 'QRPH' ? `QR${digits(r, 10)}`
        : method === 'MASTERCARD' ? `APPR-${digits(r, 6)}`
        : `BT${digits(r, 10)}`

      const key = clientName.toLowerCase()
      const customerType = clientName === 'Guest' ? 'walk_in' : seen.has(key) ? 'returning' : 'new'
      seen.add(key)

      const hhmm = `${pad(h)}:${pad(m)}`
      const createdAt = isoAt(date, hhmm)

      rows.push({
        id: uuid(0x7a04, n),
        date,
        time: slotLabel(h, m),
        client_name: clientName,
        service: svc.name,
        therapist: therapist.full_name,
        branch,
        amount,
        service_amount: amount,
        received_payment: net,
        discount_pct: discountPct,
        therapist_comm_pct: nail ? 20 : 30,
        payment_method: method,
        payment_status: 'PAID',
        status: 'Completed',
        ref_no: refNo,
        receipt_url: null,
        additional_mins: additionalMins,
        additional_price: additionalPrice,
        notes: r.chance(0.15) ? r.pick(SERVICE_NOTES) : '',
        created_at: createdAt,
        // PERFECT_services_history.csv columns
        booking_date: date,
        booking_time: `${hhmm}:00`,
        client_name_text: clientName,
        service_name_text: svc.name,
        therapist_name_text: therapist.full_name,
        category: nail ? 'LE NAILS' : 'SABBATH',
        total_amount: gross,
        discount_amount: discountAmount,
        net_sales: net,
        customer_type: customerType,
        membership_type: tier,
        booking_status: 'completed',
      })
    }
  }
  return rows
}

// ─────────────────────────────────────────────────────────────
// transactions — lib/actions/transactions.ts (payments/[id], clients/[id]),
// lib/actions/reports.ts. Lowercase enums: payment_method
// 'cash'|'gcash'|'card'|'bank_transfer'|'other', payment_status
// 'paid'|'partial'|'unpaid'|'refunded'. Embeds under both the select aliases
// (clients/bookings/discounts/cashier) and the keys the detail page reads
// (client/service/booking/discount_rule).
// ─────────────────────────────────────────────────────────────
const TXN_NOTES = ['Paid in full after session', 'Client used gift certificate balance',
  'Split payment — balance on next visit', 'Add-on hot compress included', 'Tip given separately']

function buildTransactions(): Row[] {
  const r = makeRng(7102)
  const rows: Row[] = []
  const cashier = { id: DEMO_USER.id, full_name: DEMO_USER.full_name }
  let n = 0

  for (let off = -59; off <= 0; off++) {
    const date = dayOffset(off)
    const wd = weekday(date)
    const isToday = off === 0
    const count = isToday ? 7 : wd === 0 || wd === 6 ? r.int(3, 5) : r.int(2, 4)

    const times: string[] = isToday
      ? todayTimes(r, count)
      : Array.from({ length: count }, () =>
        isoAt(date, `${pad(r.int(11, 21))}:${pad(r.pick([0, 10, 20, 30, 40, 50]))}`)).sort()

    times.forEach((createdAt, k) => {
      n++
      const client = pickClient(r)
      const svc = weighted(r, SERVICE_WEIGHTS)
      const tier = CLIENT_TIER.get(client.id) ?? 'Non-Member'

      let discountKey: string | null = null
      if (tier !== 'Non-Member' && r.chance(0.5)) discountKey = tier.toLowerCase()
      else if (r.chance(0.1)) discountKey = r.chance(0.6) ? 'senior' : 'pwd'
      else if (r.chance(0.04)) discountKey = 'birthday'
      const disc = discountKey ? DISCOUNT_BY_KEY.get(discountKey as any) ?? null : null

      const original = svc.price + (r.chance(0.12) ? 300 : 0)
      const pct = disc ? Number(disc.discount_percentage) : 0
      const discountAmount = Math.round(original * pct) / 100
      const finalAmount = original - discountAmount

      const method = weighted(r, [['cash', 45], ['gcash', 32], ['card', 13], ['bank_transfer', 7], ['other', 3]] as const)
      const status = isToday
        ? (k === count - 1 ? 'unpaid' : k === count - 2 ? 'partial' : 'paid')
        : weighted(r, [['paid', 92], ['partial', 3], ['unpaid', 3], ['refunded', 2]] as const)
      const ref = method === 'gcash' ? digits(r, 13)
        : method === 'card' ? `AUTH-${digits(r, 6)}`
        : method === 'bank_transfer' ? `BT-${digits(r, 10)}`
        : null

      const clientEmbed = {
        id: client.id,
        full_name: client.full_name,
        mobile_number: client.phone,
        email: client.email,
        membership_type: tier,
      }
      const serviceEmbed = { id: svc.id, service_name: svc.name, price: svc.price }
      const discountEmbed = disc
        ? { id: disc.id, name: disc.name, discount_percentage: disc.discount_percentage }
        : null

      rows.push({
        id: uuid(0x7a01, n),
        client_id: client.id,
        booking_id: null,
        service_id: svc.id,
        cashier_id: cashier.id,
        subtotal: original,
        discount: discountAmount,
        total_amount: finalAmount,
        original_amount: original,
        discount_id: disc ? disc.id : null,
        discount_percentage: pct,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        payment_method: method,
        payment_status: status,
        reference_number: ref,
        notes: r.chance(0.12) ? r.pick(TXN_NOTES) : null,
        created_at: createdAt,
        updated_at: createdAt,
        // embedded relations (select aliases)
        clients: clientEmbed,
        bookings: null,
        discounts: discountEmbed,
        services: serviceEmbed,
        cashier,
        // keys app/dashboard/payments/[id] and clients/[id] read
        client: clientEmbed,
        service: serviceEmbed,
        booking: null,
        discount_rule: disc ? { discount_name: disc.name, discount_value: disc.discount_percentage } : null,
      })
    })
  }
  return rows
}

// ─────────────────────────────────────────────────────────────
// payments — only ever INSERTed (components/ui/CheckoutModal.tsx); mirror that
// payload for paid transactions in the last 30 days.
// ─────────────────────────────────────────────────────────────
const MAIN_BRANCH_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

function buildPayments(transactions: Row[]): Row[] {
  const r = makeRng(7103)
  const cutoff = dayOffset(-30)
  const methodMap: Record<string, string> = { cash: 'cash', gcash: 'gcash', card: 'card', bank_transfer: 'maya', other: 'maya' }
  return transactions
    .filter((t) => t.payment_status === 'paid' && t.created_at.slice(0, 10) >= cutoff)
    .map((t, i) => {
      const svc = SERVICES.find((s) => s.id === t.service_id) ?? SERVICES[0]
      const client = CLIENTS.find((c) => c.id === t.client_id) ?? CLIENTS[0]
      return {
        id: uuid(0x7a02, i + 1),
        booking_id: null,
        original_amount: t.original_amount,
        discount_amount: t.discount_amount > 0 ? t.discount_amount : null,
        amount: t.final_amount,
        payment_method: methodMap[t.payment_method] ?? 'cash',
        branch_id: MAIN_BRANCH_ID,
        status: 'paid',
        paid_at: t.created_at,
        service_name: svc.name,
        therapist_name: therapistFor(r, svc, client.branch).full_name,
        client_name: client.full_name,
        created_at: t.created_at,
      }
    })
}

// ─────────────────────────────────────────────────────────────
// sabasu_orders — app/sabasu/page.tsx insert shape + app/dashboard/sabasu/page.tsx:
// id, client_name, location, items (plain text '2x Name (Iced), 1x Name '),
// total_amount (number), status 'Pending'|'Preparing'|'Served'|'Cancelled', created_at.
// Menu and prices copied from the café menu in app/sabasu/page.tsx.
// ─────────────────────────────────────────────────────────────
type MenuItem = { name: string; variant: 'Hot' | 'Iced' | 'Regular'; price: number }
const CAFE_MENU: MenuItem[] = [
  ...([
    ['Sabasu Signature', 145, 165], ['Sabasu Brew', 120, 135], ['Flat White', 130, 145],
    ['Vanilla', 140, 155], ['Caramel', 140, 155], ['Hazelnut', 140, 155], ['Mocha', 145, 160],
    ['Spanish Latte', 145, 160], ['Matcha', 140, 155], ['Choco', 140, 155], ['Dirty Matcha', 150, 165],
  ] as const).flatMap(([name, hot, iced]) => [
    { name, variant: 'Hot' as const, price: hot },
    { name, variant: 'Iced' as const, price: iced },
  ]),
  { name: 'Strawberry Matcha', variant: 'Iced', price: 160 },
  { name: 'Strawberry Latte', variant: 'Iced', price: 160 },
  { name: 'Tuna Pesto', variant: 'Regular', price: 180 },
  { name: 'Spanish Sardines', variant: 'Regular', price: 180 },
  { name: 'Garlic Butter', variant: 'Regular', price: 150 },
  { name: 'Creamy Mushroom', variant: 'Regular', price: 150 },
  { name: 'Chocolate Chip Cookie', variant: 'Regular', price: 65 },
  { name: 'Fudgy Brownie', variant: 'Regular', price: 65 },
]
const DRINKS = CAFE_MENU.filter((i) => i.variant !== 'Regular')
const FOOD = CAFE_MENU.filter((i) => i.variant === 'Regular')
const LOCATIONS = ['Waiting Area', 'VIP Room 1', 'VIP Room 2', 'Massage Room 3', 'Massage Room 4',
  'Wellness Suite', 'Nail Bar', 'Foot Spa Lounge', 'Reception Lounge']

function buildSabasuOrders(): Row[] {
  const r = makeRng(7105)
  const rows: Row[] = []
  let n = 0

  for (let off = -20; off <= 0; off++) {
    const date = dayOffset(off)
    const isToday = off === 0
    const count = isToday ? 6 : r.int(1, 4)

    const times: string[] = isToday
      ? todayTimes(r, count)
      : Array.from({ length: count }, () => isoAt(date, `${pad(r.int(11, 21))}:${pad(r.int(0, 59))}`)).sort()

    times.forEach((createdAt, k) => {
      n++
      const cart = new Map<MenuItem, number>()
      const lines = r.int(1, 3)
      for (let l = 0; l < lines; l++) {
        const item = r.chance(0.6) ? r.pick(DRINKS) : r.pick(FOOD)
        cart.set(item, (cart.get(item) ?? 0) + (r.chance(0.2) ? 2 : 1))
      }
      const entries = [...cart.entries()]
      // Same string the public order form builds in app/sabasu/page.tsx (trimmed).
      const items = entries
        .map(([i, qty]) => `${qty}x ${i.name} ${i.variant !== 'Regular' ? `(${i.variant})` : ''}`.trim())
        .join(', ')
      const total = entries.reduce((s, [i, qty]) => s + i.price * qty, 0)

      const fromNewest = count - 1 - k
      const status = isToday
        ? (fromNewest === 0 || fromNewest === 1 ? 'Pending' : fromNewest === 2 ? 'Preparing' : 'Served')
        : r.chance(0.92) ? 'Served' : 'Cancelled'

      const c = r.pick(CLIENTS)

      rows.push({
        id: uuid(0x7a05, n),
        client_name: r.chance(0.6) ? c.first_name : c.full_name,
        location: r.pick(LOCATIONS),
        items,
        total_amount: total,
        status,
        created_at: createdAt,
      })
    })
  }
  return rows
}

// ─────────────────────────────────────────────────────────────
export function seedMoney(): Record<string, any[]> {
  const transactions = buildTransactions()
  return {
    transactions,
    payments: buildPayments(transactions),
    discounts: buildDiscounts(),
    bookings_import: buildBookingsImport(),
    sabasu_orders: buildSabasuOrders(),
  }
}
