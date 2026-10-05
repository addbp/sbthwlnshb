// lib/supabase/demo/seed-people.ts
// DEMO MODE ONLY — fake clients, waivers, memberships, audit trail and staff profiles.
// Every row is invented. Column names and value formats mirror what the app
// reads; the file:line notes point at the code that drove each choice.

import {
  BRANCHES, CLIENTS, DEMO_USER, SERVICES, STAFF, THERAPISTS, TODAY,
  dayOffset, isoAt, makeRng, manilaDate, uuid,
  type DemoClient, type DemoService,
} from './fixtures'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
type Rng = ReturnType<typeof makeRng>

const DAY_MS = 86_400_000

// ─────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────
function daysBetween(fromDate: string, toDate: string): number {
  return Math.round((Date.parse(toDate) - Date.parse(fromDate)) / DAY_MS)
}

function addMonths(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, d)).toISOString().slice(0, 10)
}

/** Random 'HH:MM' between two whole hours (Manila wall clock), 5-minute steps. */
function clock(r: Rng, fromHour: number, toHour: number): string {
  return `${String(r.int(fromHour, toHour)).padStart(2, '0')}:${String(r.int(0, 11) * 5).padStart(2, '0')}`
}

function pickSome<T>(r: Rng, arr: readonly T[], min: number, max: number): T[] {
  const pool = [...arr]
  const out: T[] = []
  const n = Math.min(r.int(min, max), pool.length)
  while (out.length < n) out.push(pool.splice(Math.floor(r.next() * pool.length), 1)[0])
  return out
}

function mobile(r: Rng): string {
  return `09${r.pick(['17', '18', '19', '20', '27', '55', '66', '95'])}${String(r.int(0, 9999999)).padStart(7, '0')}`
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Waiver list columns are read three different ways:
 *   components/waivers/WaiverCard.tsx:106,122       → arr.join(', ')  (needs an array)
 *   app/dashboard/reports/page.tsx:87-88            → String(arr)     (joins with ',')
 *   app/dashboard/clients/page.tsx:243,333,337      → rendered as React children
 * Arrays satisfy all three without crashing. Items after the first carry a
 * leading space so String() reads "A, B"; the double space join(', ') then
 * produces collapses in HTML.
 */
function listCol(items: string[]): string[] {
  return items.map((s, i) => (i === 0 ? s : ` ${s}`))
}

/** Tiny hand-drawn-looking signature as an inline SVG data URL (renders in <img>). */
function signatureDataUrl(seed: number): string {
  const r = makeRng(seed)
  let x = r.int(10, 22)
  let d = `M${x} ${r.int(34, 46)}`
  for (let k = 0; k < 5; k++) {
    const nx = x + r.int(24, 38)
    d += ` C${x + r.int(4, 12)} ${r.int(4, 22)} ${nx - r.int(4, 12)} ${r.int(48, 66)} ${nx} ${r.int(28, 44)}`
    x = nx
  }
  d += ` M${r.int(16, 40)} ${r.int(54, 60)} Q${Math.round(x / 2)} ${r.int(62, 70)} ${x + r.int(2, 10)} ${r.int(50, 56)}`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="72" viewBox="0 0 240 72"><path d="${d}" fill="none" stroke="#1A1A1A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** Stand-in for a phone photo of a signed paper waiver (photo_attachment_url). */
function paperWaiverPhoto(name: string, date: string): string {
  const lines = Array.from({ length: 9 }, (_, i) =>
    `<rect x="30" y="${98 + i * 18}" width="${i % 3 === 2 ? 110 : 176}" height="5" rx="2" fill="#D3CABC"/>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320" viewBox="0 0 240 320"><rect width="240" height="320" fill="#CFC7B9"/><g transform="rotate(-1.5 120 160)"><rect x="14" y="12" width="212" height="296" rx="3" fill="#FBF8F2"/><text x="30" y="50" font-family="Georgia,serif" font-size="16" fill="#1A1A1A">Sabbath Spa</text><text x="30" y="70" font-family="Arial,sans-serif" font-size="8" letter-spacing="1.4" fill="#C58F3B">HEALTH &amp; LIABILITY WAIVER</text>${lines}<text x="30" y="276" font-family="cursive" font-size="15" fill="#1F3A68">${escapeXml(name)}</text><text x="150" y="296" font-family="Arial,sans-serif" font-size="8" fill="#6B6257">${date}</text></g></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// ─────────────────────────────────────────────────────────────
// Reference vocab (taken from the forms that write these tables)
// ─────────────────────────────────────────────────────────────

// app/waiver/page.tsx:54-65 (body-map zone ids the public form stores)
const ZONES = [
  'Neck & Cervical', 'Pectorals (Chest)', 'Biceps & Triceps (Arms)', 'Forearms & Hands',
  'Trapezius (Upper Back)', 'Deltoids (Shoulders)', 'Lats & Rhomboids (Upper Back)',
  'Lumbar (Lower Back)', 'Calves', 'Feet & Ankles',
] as const
const COMMON_ZONES = ['Neck & Cervical', 'Trapezius (Upper Back)', 'Deltoids (Shoulders)',
  'Lumbar (Lower Back)', 'Lats & Rhomboids (Upper Back)', 'Calves'] as const

// app/waiver/page.tsx:67-71
const CONDITIONS = ['Stress', 'High Blood Pressure', 'Arthritis', 'Diabetes', 'Allergies',
  'Joint Swelling', 'Numbness', 'Osteoporosis'] as const
const NO_CONDITIONS = 'None of the above'

const MEDS: Record<string, string> = {
  'High Blood Pressure': 'Losartan 50mg once daily',
  Diabetes: 'Metformin 500mg twice daily',
  Allergies: 'Cetirizine as needed',
  Arthritis: 'Celecoxib as needed',
  Osteoporosis: 'Calcium + Vitamin D',
}

const CONCERNS = [
  'Mild lower back pain from long hours at a desk',
  'Recovering from an ankle sprain three weeks ago',
  'Stiff neck after a long drive',
  'Sensitive skin — please avoid strong oils',
  'Prefers no pressure on the calves (varicose veins)',
]

// components/waivers/WaiverForm.tsx:24
const PRESSURES = ['Light', 'Medium', 'Firm', 'Deep Tissue'] as const

const TOWNS: Record<string, Record<string, string[]>> = {
  'Sabbath Pulilan': {
    Pulilan: ['Poblacion', 'Longos', 'Dampol 1st', 'Tibag', 'Lumbac', 'Paltao', 'Cutcut', 'Inaon'],
    Plaridel: ['Poblacion', 'Banga 1st', 'Bulihan', 'Lalangan'],
    Baliuag: ['Poblacion', 'Sabang', 'Tangos', 'Concepcion'],
  },
  'Sabbath Malolos': {
    'Malolos City': ['Bulihan', 'Santo Rosario', 'Mojon', 'Tikay', 'Sumapang Matanda', 'Guinhawa', 'Atlag', 'Longos'],
    Guiguinto: ['Poblacion', 'Tabe', 'Malis', 'Tiaong'],
    Calumpit: ['Poblacion', 'Meysulao', 'Gatbuca'],
  },
}
const STREETS = ['Rizal St.', 'Mabini St.', 'Del Pilar St.', 'Luna St.', 'Bonifacio St.',
  'Sampaguita St.', 'Acacia Ave.', 'Narra St.', 'Mac Arthur Hwy.', 'Gumamela St.']
// fixtures.ts alternates gender by index, so infer it from the first name instead.
const MALE_NAMES = new Set(['Jose', 'Mark', 'Paolo', 'Carlo', 'Miguel', 'Rafael', 'Enzo', 'Andrei', 'Gabriel', 'Luis'])
const KIN = ['Rosario', 'Eduardo', 'Teresita', 'Ramon', 'Lourdes', 'Danilo', 'Marites', 'Ernesto', 'Cecilia', 'Romeo']
const CLIENT_NOTES = [
  'Prefers a female therapist.',
  'Allergic to nuts — use unscented oil, no almond oil.',
  'Usually books Saturday afternoons.',
  'Likes the room on the cooler side.',
  'Requests minimal conversation during sessions.',
  'Senior citizen — apply SC discount when paying.',
  'Old shoulder injury (right). Avoid deep pressure there.',
]

// ─────────────────────────────────────────────────────────────
// Staff accounts (profiles) — role enum from database/migrations/001_initial_schema.sql:4
// ─────────────────────────────────────────────────────────────
const LOVELY = STAFF.find((s) => s.role === 'Receptionist')!
const EXTRA_ACCOUNTS = [
  { id: uuid(0xd0, 2), full_name: 'Celine Ferrer', role: 'admin', branch: 'Sabbath Malolos' },
  { id: uuid(0xd0, 3), full_name: 'Hazel Robles', role: 'receptionist', branch: 'Sabbath Pulilan' },
  { id: uuid(0xd0, 4), full_name: 'Janine Soriano', role: 'cashier', branch: 'Sabbath Malolos' },
].map((a) => ({ ...a, email: a.full_name.toLowerCase().replace(/\s+/g, '.') + '@sabbath-demo.local' }))
const HAZEL = EXTRA_ACCOUNTS[1]
const JANINE = EXTRA_ACCOUNTS[2]

/** Front-desk account that would have keyed something in at a branch. */
function deskEmail(r: Rng, branch: string): string {
  if (r.chance(0.3)) return DEMO_USER.email
  return branch === 'Sabbath Pulilan' ? HAZEL.email : LOVELY.email
}

// ─────────────────────────────────────────────────────────────
// Membership packages — app/dashboard/memberships/page.tsx:159-191
// ─────────────────────────────────────────────────────────────
const TIERS = {
  Basic: { disc: 5, massages: '6', months: 1, inclusions: '6 Regular Massages + 5% Off Nail Services' },
  Gold: { disc: 5, massages: '20', months: 3, inclusions: '20 Regular Massages (Valid for 3 Months) + 5% Off Nail Services' },
  Platinum: { disc: 10, massages: 'Unlimited', months: 6, inclusions: 'Unlimited Daily Massage + 10% Off Nails, 1 Free Private Suite & Coffee/Tea + Meals' },
  VIP: { disc: 10, massages: 'Unlimited', months: 12, inclusions: 'Unlimited Daily Massage + 10% Off Nails & Wet Floor, 4 Wet Floor Sessions, Coffee/Tea + Meals' },
} as const
type Tier = keyof typeof TIERS

// [client index, tier, status, started N days ago]. Active rows started recently
// enough that valid_until is still in the future; Expired ones are past it.
const MEMBERSHIP_PLAN: [number, Tier, 'Active' | 'Expired' | 'Cancelled', number][] = [
  [2, 'VIP', 'Active', 200],
  [13, 'VIP', 'Active', 45],
  [27, 'VIP', 'Active', 300],
  [6, 'Platinum', 'Active', 120],
  [17, 'Platinum', 'Active', 20],
  [31, 'Platinum', 'Active', 160],
  [9, 'Platinum', 'Expired', 230],
  [0, 'Gold', 'Active', 60],
  [4, 'Gold', 'Active', 12],
  [11, 'Gold', 'Active', 75],
  [22, 'Gold', 'Active', 30],
  [24, 'Gold', 'Active', 40],
  [35, 'Gold', 'Expired', 140],
  [4, 'Basic', 'Expired', 70], // renewed into Gold above
  [8, 'Basic', 'Active', 10],
  [15, 'Basic', 'Active', 22],
  [29, 'Basic', 'Active', 5],
  [38, 'Basic', 'Active', 18],
  [19, 'Basic', 'Cancelled', 25],
]

// Clients whose latest waiver is signed today, and the time they checked in.
const TODAY_WAIVERS: Record<number, string> = { 1: '11:05', 7: '11:40', 16: '12:20', 23: '13:10' }

// ─────────────────────────────────────────────────────────────
// Seed
// ─────────────────────────────────────────────────────────────
export function seedPeople(): Record<string, Row[]> {
  // ── 1. Per-client profile extras ──────────────────────────
  const rc = makeRng(201)
  const extras = CLIENTS.map((c) => {
    const towns = TOWNS[c.branch]
    const town = rc.pick(Object.keys(towns))
    return {
      address: `${rc.int(1, 48)} ${rc.pick(STREETS)}, Brgy. ${rc.pick(towns[town])}, ${town}, Bulacan`,
      emergency_contact_person: `${rc.pick(KIN)} ${c.last_name}`,
      emergency_contact_number: mobile(rc),
      birthday: `${rc.int(1968, 2002)}-${String(rc.int(1, 12)).padStart(2, '0')}-${String(rc.int(1, 28)).padStart(2, '0')}`,
      anniversary: rc.chance(0.3)
        ? `${rc.int(1995, 2022)}-${String(rc.int(1, 12)).padStart(2, '0')}-${String(rc.int(1, 28)).padStart(2, '0')}`
        : null,
      notes: rc.chance(0.35) ? rc.pick(CLIENT_NOTES) : null,
      conditions: rc.chance(0.55) ? [] : pickSome(rc, CONDITIONS, 1, 2),
      pressure: rc.pick(PRESSURES),
    }
  })

  // Client age in days. Pushed back when a membership predates the fixture date.
  const createdDate = CLIENTS.map((c) => manilaDate(new Date(c.created_at)))
  for (const [idx, , , started] of MEMBERSHIP_PLAN) {
    const need = dayOffset(-(started + 2))
    if (need < createdDate[idx]) createdDate[idx] = need
  }
  const clientCreatedAt = CLIENTS.map((c, i) =>
    createdDate[i] === manilaDate(new Date(c.created_at)) ? c.created_at : isoAt(createdDate[i], '10:00'))

  // ── 2. Memberships ─────────────────────────────────────────
  const rm = makeRng(203)
  const memberships: Row[] = MEMBERSHIP_PLAN.map(([idx, tier, status, started], n) => {
    const c = CLIENTS[idx]
    const pkg = TIERS[tier]
    const startDate = dayOffset(-started)
    return {
      id: uuid(0x3e, n + 1),
      created_at: isoAt(startDate, clock(rm, 11, 19)),
      client_name: c.full_name,
      client_mobile: c.phone,
      client_email: c.email,
      client_address: extras[idx].address,
      membership_tier: tier,
      discount_percentage: pkg.disc,
      status,
      valid_until: addMonths(startDate, pkg.months),
      remaining_massages: pkg.massages,
      package_inclusions: pkg.inclusions,
      receptionist_track: deskEmail(rm, c.branch),
    }
  })
  const activeTier = new Map<string, Tier>()
  MEMBERSHIP_PLAN.forEach(([idx, tier, status]) => {
    if (status === 'Active') activeTier.set(CLIENTS[idx].id, tier)
  })

  // ── 3. Waivers ─────────────────────────────────────────────
  const rw = makeRng(202)
  const SERVICE_WEIGHTS = [0, 0, 0, 0, 1, 1, 1, 2, 2, 3, 4, 5, 5, 6, 7, 8, 9]
  const waivers: Row[] = []
  const visits = new Map<string, number>()
  const lastVisit = new Map<string, string>()

  CLIENTS.forEach((c, idx) => {
    let count = rw.pick([0, 1, 1, 1, 2, 2, 2, 3, 3, 4])
    if (activeTier.has(c.id)) count = Math.max(count, 2)
    if (TODAY_WAIVERS[idx]) count = Math.max(count, 1)

    const age = daysBetween(createdDate[idx], TODAY)
    const maxBack = Math.max(1, Math.min(age - 1, 180))
    const days = new Set<number>()
    if (TODAY_WAIVERS[idx]) days.add(0)
    let guard = 0
    while (days.size < count && guard++ < 200) days.add(rw.int(1, maxBack))
    const ordered = [...days].sort((a, b) => b - a) // oldest first

    ordered.forEach((back) => {
      const n = waivers.length + 1
      const svc: DemoService = SERVICES[rw.pick(SERVICE_WEIGHTS)]
      const branch = rw.chance(0.85) ? c.branch : BRANCHES.find((b) => b !== c.branch)!
      const isNails = svc.category === 'Nails'
      const pool = isNails
        ? THERAPISTS.filter((t) => t.role === 'Nail Technician')
        : THERAPISTS.filter((t) => t.role === 'Massage Therapist' && t.branch === branch)
      const therapist = rw.pick(pool.length ? pool : THERAPISTS)

      const date = dayOffset(-back)
      const signedAt = back === 0 ? isoAt(date, TODAY_WAIVERS[idx]) : isoAt(date, clock(rw, 11, 21))

      let focus: string[]
      if (svc.category === 'Massage' || svc.category === 'Wellness Suite') {
        focus = rw.chance(0.2) ? pickSome(rw, ZONES, 1, 3) : pickSome(rw, COMMON_ZONES, 1, 3)
      } else if (svc.category === 'Foot Spa') {
        focus = rw.chance(0.5) ? ['Feet & Ankles', 'Calves'] : ['Feet & Ankles']
      } else if (isNails) {
        focus = ['Forearms & Hands', 'Feet & Ankles']
      } else {
        focus = ['None']
      }
      const conds = extras[idx].conditions.length ? extras[idx].conditions : [NO_CONDITIONS]
      const meds = extras[idx].conditions.map((x) => MEDS[x]).filter(Boolean)

      // Most are signed on the tablet; a few are photographed paper forms; a
      // couple were never completed so the MISSING / Incomplete states show.
      const kind = back === 0 ? 'digital' : n % 17 === 5 ? 'photo' : n % 31 === 12 ? 'missing' : 'digital'
      const sig = kind === 'digital' ? signatureDataUrl(9000 + idx * 7 + n) : null

      waivers.push({
        id: uuid(0xa1, n),
        client_id: c.id,
        client_name: c.full_name, // reports/page.tsx:83, clients/page.tsx:239 key on this
        booking_id: null,
        branch, // waivers/page.tsx:20
        service_availed: svc.name,
        therapist_name: therapist.full_name, // waivers/page.tsx:191
        preferred_pressure: isNails || svc.category === 'Facial' ? null : extras[idx].pressure,
        focus_areas: listCol(focus),
        health_conditions: listCol(conds),
        current_medications: meds.length ? meds.join('; ') : null,
        health_concerns: rw.chance(0.18) ? rw.pick(CONCERNS) : null,
        consent_information_accurate: true,
        consent_wellness_only: true,
        consent_liability_release: kind !== 'missing',
        consent_behavior_policy: kind !== 'missing',
        consent_data_privacy: true,
        terms_agreed: kind !== 'missing',
        signature: sig, // reports/page.tsx:89, clients/page.tsx:243
        signature_url: sig, // waivers/page.tsx:68, WaiverCard.tsx:165
        photo_attachment_url: kind === 'photo' ? paperWaiverPhoto(c.full_name, date) : '',
        device_info: kind === 'digital'
          ? { user_agent: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', platform: 'iPad', screen: '820x1180', captured_at: branch }
          : null,
        signed_at: signedAt, // waivers.ts:119,137 order by this
        date_signed: signedAt, // reports/page.tsx:77 orders by this
        created_at: signedAt,
      })
      visits.set(c.id, (visits.get(c.id) ?? 0) + 1)
      lastVisit.set(c.id, signedAt)
    })
  })

  // ── 4. Clients ─────────────────────────────────────────────
  const clients: Row[] = CLIENTS.map((c: DemoClient, i) => {
    const x = extras[i]
    const v = visits.get(c.id) ?? 0
    const tier = activeTier.get(c.id) ?? null
    // client_type enum — lib/actions/clients.ts:60, ClientForm.tsx:221-225
    const clientType = tier ? 'member' : v >= 3 ? 'regular' : v === 2 ? 'returning' : 'first_time'
    const last = lastVisit.get(c.id) ?? null
    return {
      id: c.id,
      full_name: c.full_name,
      mobile_number: c.phone,
      email: c.email,
      address: x.address,
      emergency_contact_person: x.emergency_contact_person,
      emergency_contact_number: x.emergency_contact_number,
      gender: MALE_NAMES.has(c.first_name) ? 'male' : 'female', // ClientForm.tsx:185-188 option values
      birthday: x.birthday,
      anniversary: x.anniversary,
      client_type: clientType,
      membership_type: tier, // ClientList.tsx:101, transactions.ts:294
      membership_tier: tier, // clients/[id]/page.tsx:37,146
      discount_id: null, // discounts rows belong to the money seed
      notes: x.notes,
      branch: c.branch,
      last_visit_at: last,
      created_at: clientCreatedAt[i],
      updated_at: last && last > clientCreatedAt[i] ? last : clientCreatedAt[i],
    }
  })
  const clientById = new Map(clients.map((c) => [c.id, c]))

  // ── 5. Audit trail ─────────────────────────────────────────
  // Columns: app/dashboard/audit/page.tsx:13-25. Action colour keys off
  // action.includes('NEW') / includes('DELETED') (:33-37). Restore reads
  // old_data.booking_id for bookings, old_data.id otherwise (:84).
  const ra = makeRng(204)
  const audit: Omit<Row, 'id'>[] = []
  const WINDOW = 12
  const fmtDay = (d: string) =>
    new Date(`${d}T12:00:00+08:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })
  const SLOTS = ['11:00 AM', '12:30 PM', '1:00 PM', '2:00 PM', '3:30 PM', '4:00 PM', '5:30 PM', '6:00 PM', '7:00 PM', '8:30 PM']
  const stamp = (back: number) => isoAt(dayOffset(-back), back === 0 ? clock(ra, 11, 12) : clock(ra, 11, 21))

  // Bookings activity (snapshots shaped like app/booking/page.tsx:684-697)
  for (let n = 0; n < 26; n++) {
    const c = ra.pick(CLIENTS)
    const svc = SERVICES[ra.pick(SERVICE_WEIGHTS)]
    const branch = ra.chance(0.85) ? c.branch : BRANCHES.find((b) => b !== c.branch)!
    const pool = THERAPISTS.filter((t) => t.branch === branch && t.role === 'Massage Therapist')
    const therapist = ra.pick(pool)
    const back = n < 4 ? 0 : ra.int(1, WINDOW)
    const createdAt = stamp(back)
    const roll = n === 9 || n === 20 ? 0.95 : ra.next() * 0.92 // two guaranteed deletions
    const apptDate = roll >= 0.38 && roll < 0.68 ? dayOffset(-back) : dayOffset(-back + ra.int(0, 3))
    const email = deskEmail(ra, branch)
    const base = {
      booking_id: uuid(0xab, n + 1),
      branch,
      client_name: c.full_name,
      client_mobile: c.phone,
      client_email: c.email,
      service_name: svc.name,
      price: svc.price,
      therapist_name: therapist.full_name,
      appointment_date: apptDate,
      appointment_time: ra.pick(SLOTS),
      payment_method: 'PAY AT COUNTER',
      status: 'Confirmed',
      notes: '',
      receptionist_track: email,
      created_at: createdAt,
    }
    if (roll < 0.38) {
      audit.push({
        created_at: createdAt, receptionist_email: email, action: 'NEW BOOKING', table_name: 'bookings',
        record_id: base.booking_id,
        description: `Booked ${c.full_name} for ${svc.name} on ${fmtDay(apptDate)}, ${base.appointment_time} (${branch.replace('Sabbath ', '')})`,
        old_data: null, new_data: { ...base, status: 'Pending' },
      })
    } else if (roll < 0.68) {
      const by = ra.chance(0.4) ? JANINE.email : email
      audit.push({
        created_at: createdAt, receptionist_email: by, action: 'UPDATED BOOKING', table_name: 'bookings',
        record_id: base.booking_id,
        description: `Marked ${c.full_name}'s ${svc.name} as Completed`,
        old_data: base, new_data: { ...base, status: 'Completed', receptionist_track: by },
      })
    } else if (roll < 0.84) {
      const other = ra.pick(pool.filter((t) => t.id !== therapist.id))
      audit.push({
        created_at: createdAt, receptionist_email: email, action: 'UPDATED BOOKING', table_name: 'bookings',
        record_id: base.booking_id,
        description: `Reassigned ${c.full_name}'s ${svc.name} from ${therapist.full_name} to ${other.full_name}`,
        old_data: base, new_data: { ...base, therapist_name: other.full_name },
      })
    } else if (roll < 0.92) {
      const moved = dayOffset(-back + ra.int(4, 7))
      audit.push({
        created_at: createdAt, receptionist_email: email, action: 'UPDATED BOOKING', table_name: 'bookings',
        record_id: base.booking_id,
        description: `Rescheduled ${c.full_name} from ${fmtDay(apptDate)} to ${fmtDay(moved)} (client request)`,
        old_data: base, new_data: { ...base, appointment_date: moved },
      })
    } else {
      audit.push({
        created_at: createdAt, receptionist_email: email, action: 'DELETED BOOKING', table_name: 'bookings',
        record_id: base.booking_id,
        description: `Deleted duplicate booking for ${c.full_name} (${svc.name}, ${fmtDay(apptDate)})`,
        old_data: { ...base, status: 'Pending' }, new_data: null,
      })
    }
  }

  // Memberships registered inside the window
  memberships.forEach((m) => {
    const back = daysBetween(manilaDate(new Date(m.created_at)), TODAY)
    if (back > WINDOW) return
    audit.push({
      created_at: m.created_at, receptionist_email: m.receptionist_track, action: 'NEW MEMBERSHIP',
      table_name: 'memberships', record_id: m.id,
      description: `Registered ${m.membership_tier} membership for ${m.client_name} (valid until ${m.valid_until})`,
      old_data: null, new_data: m,
    })
  })

  // Membership edits
  const cancelled = memberships.find((m) => m.status === 'Cancelled')!
  const vip = memberships.find((m) => m.membership_tier === 'VIP' && m.status === 'Active')!
  const gold = memberships.filter((m) => m.membership_tier === 'Gold' && m.status === 'Active')[2]
  const memberEdits: [Row, Row, string, number][] = [
    [cancelled, { ...cancelled, status: 'Active' }, `Cancelled ${cancelled.membership_tier} membership for ${cancelled.client_name} — moving out of Bulacan`, 9],
    [vip, { ...vip, client_mobile: mobile(ra) }, `Updated mobile number on ${vip.client_name}'s VIP membership`, 6],
    [gold, { ...gold, valid_until: dayOffset(daysBetween(TODAY, gold.valid_until) - 7) }, `Extended ${gold.client_name}'s Gold validity by 7 days (spa closure goodwill)`, 3],
  ]
  memberEdits.forEach(([now, before, description, back]) => {
    audit.push({
      created_at: stamp(back), receptionist_email: ra.chance(0.5) ? DEMO_USER.email : EXTRA_ACCOUNTS[0].email,
      action: 'UPDATED MEMBERSHIP', table_name: 'memberships', record_id: now.id,
      description, old_data: before, new_data: now,
    })
  })

  // Client profile edits
  const editable = clients.filter((_, i) => i % 6 === 3).slice(0, 5)
  editable.forEach((now, k) => {
    const back = ra.int(1, WINDOW)
    let before: Row
    let description: string
    if (k % 3 === 0) {
      before = { ...now, mobile_number: mobile(ra) }
      description = `Updated mobile number for ${now.full_name}`
    } else if (k % 3 === 1) {
      before = { ...now, address: null }
      description = `Added home address for ${now.full_name}`
    } else {
      before = { ...now, notes: null }
      description = `Added preference notes for ${now.full_name}`
    }
    if (k % 3 === 2 && !now.notes) now.notes = 'Prefers a female therapist.'
    audit.push({
      created_at: stamp(back), receptionist_email: deskEmail(ra, now.branch), action: 'UPDATED CLIENT',
      table_name: 'clients', record_id: now.id, description, old_data: before, new_data: { ...now },
    })
  })

  // Recent waivers (signature images left out of the snapshot to keep it readable)
  waivers
    .filter((w) => daysBetween(manilaDate(new Date(w.signed_at)), TODAY) <= 4)
    .slice(-10)
    .forEach((w) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { signature, signature_url, photo_attachment_url, device_info, ...snap } = w
      audit.push({
        created_at: w.signed_at, receptionist_email: w.branch === 'Sabbath Pulilan' ? HAZEL.email : LOVELY.email,
        action: 'NEW WAIVER', table_name: 'waivers', record_id: w.id,
        description: `${w.client_name} signed a health waiver for ${w.service_availed} (${String(w.branch).replace('Sabbath ', '')})`,
        old_data: null, new_data: snap,
      })
    })

  const audit_logs: Row[] = audit
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    .map((row, n) => ({ id: uuid(0xa7, n + 1), ...row }))

  // ── 6. Profiles ────────────────────────────────────────────
  // Nothing in app/ reads profiles today; rows exist so auth-adjacent code and
  // bookings.therapist_id (001_initial_schema.sql:58) have something to point at.
  const longAgo = isoAt(dayOffset(-420), '09:00')
  const profiles: Row[] = [
    { id: DEMO_USER.id, email: DEMO_USER.email, full_name: DEMO_USER.full_name, role: 'owner', branch: null },
    ...EXTRA_ACCOUNTS.map((a) => ({ id: a.id, email: a.email, full_name: a.full_name, role: a.role, branch: a.branch })),
    ...STAFF.map((s) => ({
      id: s.id, email: s.email, full_name: s.full_name,
      role: s.role === 'Receptionist' ? 'receptionist' : 'therapist', branch: s.branch,
    })),
  ].map((p) => ({ ...p, status: 'active', created_at: longAgo, updated_at: longAgo }))

  // Sanity: every client referenced by a waiver exists.
  for (const w of waivers) if (!clientById.has(w.client_id)) throw new Error(`orphan waiver ${w.id}`)

  return { clients, waivers, memberships, audit_logs, profiles }
}
