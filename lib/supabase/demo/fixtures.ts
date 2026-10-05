// lib/supabase/demo/fixtures.ts
// DEMO MODE ONLY — shared fake people, services and date helpers.
// Every seed module builds its table rows from these so IDs and names line up
// across tables. All data here is invented; none of it is real customer data.

// ─────────────────────────────────────────────────────────────
// Deterministic randomness
// ─────────────────────────────────────────────────────────────
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Each seed module creates its own generator so output doesn't depend on load order. */
export function makeRng(seed: number) {
  const next = mulberry32(seed)
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
  }
}

/** Deterministic, valid-looking v4 UUID. `ns` keeps tables apart, `n` is the row number. */
export function uuid(ns: number, n: number): string {
  const hex = (v: number, len: number) => v.toString(16).padStart(len, '0').slice(-len)
  return `${hex(ns, 8)}-0000-4000-8000-${hex(n, 12)}`
}

// ─────────────────────────────────────────────────────────────
// Dates — the spa runs on Philippine time (UTC+8)
// ─────────────────────────────────────────────────────────────
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

/** 'YYYY-MM-DD' for the given instant in Manila time. */
export function manilaDate(d: Date = new Date()): string {
  return new Date(d.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10)
}

export const TODAY = manilaDate()

/** TODAY shifted by n days (negative = past), as 'YYYY-MM-DD'. */
export function dayOffset(n: number): string {
  const [y, m, d] = TODAY.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** ISO timestamp for a Manila wall-clock time, e.g. isoAt('2026-10-06', '14:30'). */
export function isoAt(date: string, hhmm: string): string {
  return new Date(`${date}T${hhmm}:00+08:00`).toISOString()
}

// ─────────────────────────────────────────────────────────────
// Canonical entities (map these into each table's real columns)
// ─────────────────────────────────────────────────────────────
export const BRANCHES = ['Sabbath Pulilan', 'Sabbath Malolos'] as const

export const DEMO_USER = {
  id: uuid(0xd0, 1),
  email: 'demo@sabbath-demo.local',
  full_name: 'Demo Manager',
  role: 'owner',
}

const FIRST = ['Maria', 'Jose', 'Ana', 'Mark', 'Kristine', 'Paolo', 'Liza', 'Carlo', 'Joy', 'Miguel',
  'Bea', 'Rafael', 'Camille', 'Enzo', 'Patricia', 'Andrei', 'Nicole', 'Gabriel', 'Trisha', 'Luis']
const LAST = ['Santos', 'Reyes', 'Cruz', 'Bautista', 'Garcia', 'Mendoza', 'Torres', 'Villanueva',
  'Ramos', 'Aquino', 'Castillo', 'Navarro', 'Flores', 'Dela Cruz', 'Gonzales', 'Pascual']

export type DemoClient = {
  id: string; first_name: string; last_name: string; full_name: string
  phone: string; email: string; gender: 'Female' | 'Male'; branch: string; created_at: string
}

export const CLIENTS: DemoClient[] = (() => {
  const r = makeRng(101)
  return Array.from({ length: 40 }, (_, i) => {
    const first = FIRST[i % FIRST.length]
    const last = LAST[(i * 7) % LAST.length]
    return {
      id: uuid(0xc1, i + 1),
      first_name: first,
      last_name: last,
      full_name: `${first} ${last}`,
      phone: `0917${String(1000000 + i * 7919).slice(-7)}`,
      email: `${first}.${last}`.toLowerCase().replace(/\s+/g, '') + `${i}@example.com`,
      gender: i % 3 === 0 ? 'Male' : 'Female',
      branch: BRANCHES[i % 2],
      created_at: isoAt(dayOffset(-r.int(30, 240)), '10:00'),
    }
  })
})()

export type DemoService = {
  id: string; name: string; category: string; price: number; duration_minutes: number
}

export const SERVICES: DemoService[] = [
  ['Swedish Massage', 'Massage', 900, 60],
  ['Deep Tissue Massage', 'Massage', 1100, 60],
  ['Hilot Traditional Massage', 'Massage', 1000, 75],
  ['Hot Stone Massage', 'Massage', 1400, 90],
  ['Ventosa Cupping', 'Massage', 1200, 60],
  ['Foot Reflexology', 'Foot Spa', 600, 45],
  ['Classic Facial', 'Facial', 850, 45],
  ['Body Scrub & Wrap', 'Body Scrub', 1300, 60],
  ['Manicure & Pedicure', 'Nails', 500, 60],
  ['Wellness Suite (2 hrs)', 'Wellness Suite', 2500, 120],
].map(([name, category, price, duration], i) => ({
  id: uuid(0x5e, i + 1),
  name: name as string,
  category: category as string,
  price: price as number,
  duration_minutes: duration as number,
}))

export type DemoStaff = {
  id: string; full_name: string; role: string; branch: string; phone: string; email: string
}

export const STAFF: DemoStaff[] = [
  ['Rowena Lim', 'Massage Therapist'],
  ['Jessa Manalo', 'Massage Therapist'],
  ['Arnel Tan', 'Massage Therapist'],
  ['Grace Dizon', 'Massage Therapist'],
  ['Mylene Ocampo', 'Massage Therapist'],
  ['Ronnie Salazar', 'Massage Therapist'],
  ['Cherry Abad', 'Nail Technician'],
  ['Lovely Perez', 'Receptionist'],
].map(([full_name, role], i) => ({
  id: uuid(0x57, i + 1),
  full_name: full_name as string,
  role: role as string,
  branch: BRANCHES[i % 2],
  phone: `0918${String(2000000 + i * 3571).slice(-7)}`,
  email: (full_name as string).toLowerCase().replace(/\s+/g, '.') + '@sabbath-demo.local',
}))

export const THERAPISTS = STAFF.filter((s) => s.role !== 'Receptionist')

export const PAYMENT_METHODS = ['Cash', 'GCash', 'Maya', 'Card', 'Bank Transfer'] as const
