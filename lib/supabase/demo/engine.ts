// lib/supabase/demo/engine.ts
// DEMO MODE ONLY — an in-memory stand-in for the Supabase client.
//
// next.config.ts aliases '@supabase/supabase-js' and '@supabase/ssr' to the
// small wrappers next to this file when NEXT_PUBLIC_DEMO_MODE=1, so every page,
// server action, route handler and the middleware get this fake client without
// any code changes. Data comes from the seed-*.ts modules; writes only live in
// memory (per browser tab / per dev-server process) and vanish on reload.

import { DEMO_USER } from './fixtures'
import { seedBookings } from './seed-bookings'
import { seedMoney } from './seed-money'
import { seedPeople } from './seed-people'

type Row = Record<string, any>
type Pred = (row: Row) => boolean

// ─────────────────────────────────────────────────────────────
// Store (built lazily — the middleware only needs auth)
// ─────────────────────────────────────────────────────────────
let store: Record<string, Row[]> | null = null

function tableRows(name: string): Row[] {
  if (!store) store = { ...seedBookings(), ...seedMoney(), ...seedPeople() }
  return (store[name] ??= [])
}

const clone = <T,>(v: T): T =>
  typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v))

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `demo-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`

// ─────────────────────────────────────────────────────────────
// Value helpers
// ─────────────────────────────────────────────────────────────
/** Reads 'a', 'a.b' (embedded relation) or 'a->b' / 'a->>b' (JSON column). */
function getPath(row: Row, path: string): any {
  return path.split(/->>|->|\./).reduce<any>((v, key) => (v == null ? undefined : v[key]), row)
}

function sameValue(a: any, b: any): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  return String(a) === String(b)
}

function compare(a: any, b: any): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  const na = Number(a), nb = Number(b)
  if (typeof a === 'number' || typeof b === 'number') {
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') return Number(Boolean(a)) - Number(Boolean(b))
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0
}

function likeToRegex(pattern: string, insensitive: boolean): RegExp {
  const src = String(pattern)
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/[%*]/g, '.*')
    .replace(/_/g, '.')
  return new RegExp(`^${src}$`, insensitive ? 'is' : 's')
}

/** PostgREST literal → JS value ('null', 'true', '"quoted"', '(a,b)' lists). */
function parseLiteral(raw: string): any {
  const v = raw.trim()
  if (v === 'null') return null
  if (v === 'true') return true
  if (v === 'false') return false
  if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1)
  return v
}

function parseList(raw: any): any[] {
  if (Array.isArray(raw)) return raw
  return String(raw).replace(/^\(|\)$/g, '').split(',').map(parseLiteral)
}

/** One PostgREST operator applied to a row value. */
function applyOp(op: string, actual: any, expected: any): boolean {
  switch (op) {
    case 'eq': return sameValue(actual, expected)
    case 'neq': return !sameValue(actual, expected)
    case 'gt': return actual != null && compare(actual, expected) > 0
    case 'gte': return actual != null && compare(actual, expected) >= 0
    case 'lt': return actual != null && compare(actual, expected) < 0
    case 'lte': return actual != null && compare(actual, expected) <= 0
    case 'like': return actual != null && likeToRegex(expected, false).test(String(actual))
    case 'ilike': return actual != null && likeToRegex(expected, true).test(String(actual))
    case 'is':
      if (expected === null || expected === 'null') return actual == null
      return Boolean(actual) === (expected === true || expected === 'true')
    case 'in': return parseList(expected).some((e) => sameValue(actual, e))
    case 'cs': {
      if (Array.isArray(actual)) return parseList(expected).every((e) => actual.some((a) => sameValue(a, e)))
      if (actual && typeof actual === 'object' && expected && typeof expected === 'object')
        return Object.entries(expected).every(([k, v]) => sameValue(actual[k], v))
      return false
    }
    case 'cd': return Array.isArray(actual) && actual.every((a) => parseList(expected).some((e) => sameValue(a, e)))
    case 'ov': return Array.isArray(actual) && parseList(expected).some((e) => actual.some((a) => sameValue(a, e)))
    case 'fts': case 'plfts': case 'phfts': case 'wfts':
      return actual != null && String(expected).toLowerCase().split(/\s+/).every((w) => String(actual).toLowerCase().includes(w))
    default: return true // unknown operator: don't hide rows
  }
}

const OPS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'cs', 'cd', 'ov',
  'fts', 'plfts', 'phfts', 'wfts', 'match', 'imatch'])

/** Splits on commas that aren't inside parentheses or quotes. */
function splitTopLevel(s: string): string[] {
  const parts: string[] = []
  let depth = 0, quoted = false, cur = ''
  for (const ch of s) {
    if (ch === '"') quoted = !quoted
    if (!quoted && ch === '(') depth++
    if (!quoted && ch === ')') depth--
    if (!quoted && depth === 0 && ch === ',') { parts.push(cur); cur = ''; continue }
    cur += ch
  }
  if (cur.trim()) parts.push(cur)
  return parts.map((p) => p.trim())
}

/** Parses an .or()/.and() filter string such as 'name.ilike.%ana%,phone.eq.0917'. */
function parseLogic(expr: string, mode: 'or' | 'and'): Pred {
  const preds = splitTopLevel(expr).map(parseCondition)
  return mode === 'or' ? (r) => preds.some((p) => p(r)) : (r) => preds.every((p) => p(r))
}

function parseCondition(cond: string): Pred {
  const group = cond.match(/^(not\.)?(and|or)\((.*)\)$/s)
  if (group) {
    const inner = parseLogic(group[3], group[2] as 'and' | 'or')
    return group[1] ? (r) => !inner(r) : inner
  }
  const segs = cond.split('.')
  for (let i = 1; i < segs.length; i++) {
    const negate = segs[i] === 'not'
    const op = negate ? segs[i + 1] : segs[i]
    if (op && OPS.has(op)) {
      const col = segs.slice(0, i).join('.')
      const rawVal = segs.slice(i + (negate ? 2 : 1)).join('.')
      const val = op === 'in' || op === 'cs' || op === 'cd' || op === 'ov' ? rawVal : parseLiteral(rawVal)
      const realOp = op === 'match' ? 'like' : op === 'imatch' ? 'ilike' : op
      return (r) => applyOp(realOp, getPath(r, col), val) !== negate
    }
  }
  return () => true
}

// ─────────────────────────────────────────────────────────────
// Query builder (thenable, like PostgrestFilterBuilder)
// ─────────────────────────────────────────────────────────────
type Mode = 'select' | 'insert' | 'upsert' | 'update' | 'delete'

class DemoQuery {
  private filters: Pred[] = []
  private orders: { col: string; asc: boolean; nullsFirst: boolean }[] = []
  private mode: Mode = 'select'
  private payload: any = null
  private onConflict = 'id'
  private returning = false
  private countMode: string | null = null
  private headOnly = false
  private limitN: number | null = null
  private rangeFrom: number | null = null
  private rangeTo: number | null = null
  private singleMode: 'single' | 'maybe' | null = null

  constructor(private table: string) {}

  // ── verbs ──
  select(_columns?: string, opts?: { count?: string; head?: boolean }) {
    if (this.mode === 'select') {
      this.countMode = opts?.count ?? null
      this.headOnly = Boolean(opts?.head)
    } else {
      this.returning = true
    }
    return this
  }
  insert(values: any, opts?: { count?: string }) { this.mode = 'insert'; this.payload = values; this.countMode = opts?.count ?? null; return this }
  upsert(values: any, opts?: { onConflict?: string }) { this.mode = 'upsert'; this.payload = values; this.onConflict = opts?.onConflict || 'id'; return this }
  update(values: any, opts?: { count?: string }) { this.mode = 'update'; this.payload = values; this.countMode = opts?.count ?? null; return this }
  delete(opts?: { count?: string }) { this.mode = 'delete'; this.countMode = opts?.count ?? null; return this }

  // ── filters ──
  private where(col: string, op: string, val: any) { this.filters.push((r) => applyOp(op, getPath(r, col), val)); return this }
  eq(c: string, v: any) { return this.where(c, 'eq', v) }
  neq(c: string, v: any) { return this.where(c, 'neq', v) }
  gt(c: string, v: any) { return this.where(c, 'gt', v) }
  gte(c: string, v: any) { return this.where(c, 'gte', v) }
  lt(c: string, v: any) { return this.where(c, 'lt', v) }
  lte(c: string, v: any) { return this.where(c, 'lte', v) }
  like(c: string, v: any) { return this.where(c, 'like', v) }
  ilike(c: string, v: any) { return this.where(c, 'ilike', v) }
  is(c: string, v: any) { return this.where(c, 'is', v) }
  in(c: string, v: any[]) { return this.where(c, 'in', v) }
  contains(c: string, v: any) { return this.where(c, 'cs', v) }
  containedBy(c: string, v: any) { return this.where(c, 'cd', v) }
  overlaps(c: string, v: any) { return this.where(c, 'ov', v) }
  textSearch(c: string, v: any) { return this.where(c, 'fts', v) }
  likeAnyOf(c: string, pats: string[]) { this.filters.push((r) => pats.some((p) => applyOp('like', getPath(r, c), p))); return this }
  ilikeAnyOf(c: string, pats: string[]) { this.filters.push((r) => pats.some((p) => applyOp('ilike', getPath(r, c), p))); return this }
  filter(c: string, op: string, v: any) {
    const negate = op.startsWith('not.')
    const realOp = negate ? op.slice(4) : op
    this.filters.push((r) => applyOp(realOp, getPath(r, c), typeof v === 'string' && realOp !== 'in' ? parseLiteral(v) : v) !== negate)
    return this
  }
  not(c: string, op: string, v: any) {
    this.filters.push((r) => !applyOp(op, getPath(r, c), typeof v === 'string' && op !== 'in' ? parseLiteral(v) : v))
    return this
  }
  match(obj: Record<string, any>) { for (const [k, v] of Object.entries(obj)) this.eq(k, v); return this }
  or(expr: string, opts?: { foreignTable?: string; referencedTable?: string }) {
    if (!opts?.foreignTable && !opts?.referencedTable) this.filters.push(parseLogic(expr, 'or'))
    return this
  }

  // ── modifiers ──
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean; foreignTable?: string; referencedTable?: string }) {
    if (opts?.foreignTable || opts?.referencedTable) return this
    const asc = opts?.ascending ?? true
    this.orders.push({ col, asc, nullsFirst: opts?.nullsFirst ?? !asc })
    return this
  }
  limit(n: number, opts?: { foreignTable?: string; referencedTable?: string }) {
    if (!opts?.foreignTable && !opts?.referencedTable) this.limitN = n
    return this
  }
  range(from: number, to: number) { this.rangeFrom = from; this.rangeTo = to; return this }
  single() { this.singleMode = 'single'; return this }
  maybeSingle() { this.singleMode = 'maybe'; return this }
  // No-ops that only change typing / transport in the real client.
  returns() { return this }
  overrideTypes() { return this }
  abortSignal() { return this }
  throwOnError() { return this }
  setHeader() { return this }
  csv() { return this }
  geojson() { return this }
  explain() { return this }
  rollback() { return this }

  then<A = any, B = never>(onOk?: ((v: any) => A | PromiseLike<A>) | null, onErr?: ((e: any) => B | PromiseLike<B>) | null) {
    return Promise.resolve().then(() => this.run()).then(onOk, onErr)
  }
  catch<B = never>(onErr?: ((e: any) => B | PromiseLike<B>) | null) { return this.then(undefined, onErr) }
  finally(fn?: (() => void) | null) { return Promise.resolve(this).finally(fn) }

  // ── execution ──
  private matching(rows: Row[]) { return rows.filter((r) => this.filters.every((f) => f(r))) }

  private sorted(rows: Row[]) {
    if (!this.orders.length) return rows
    return [...rows].sort((a, b) => {
      for (const o of this.orders) {
        const va = getPath(a, o.col), vb = getPath(b, o.col)
        if (va == null || vb == null) {
          if (va == null && vb == null) continue
          return (va == null) === o.nullsFirst ? -1 : 1
        }
        const c = compare(va, vb)
        if (c !== 0) return o.asc ? c : -c
      }
      return 0
    })
  }

  private paged(rows: Row[]) {
    let out = rows
    if (this.rangeFrom != null && this.rangeTo != null) out = out.slice(this.rangeFrom, this.rangeTo + 1)
    if (this.limitN != null) out = out.slice(0, this.limitN)
    return out
  }

  private finish(rows: Row[] | null, count: number | null, status = 200) {
    if (this.headOnly) return { data: null, error: null, count, status, statusText: 'OK' }
    if (rows && this.singleMode) {
      if (rows.length === 1) return { data: rows[0], error: null, count, status, statusText: 'OK' }
      if (rows.length === 0 && this.singleMode === 'maybe') return { data: null, error: null, count, status, statusText: 'OK' }
      return {
        data: null,
        count,
        status: 406,
        statusText: 'Not Acceptable',
        error: {
          code: 'PGRST116',
          message: 'JSON object requested, multiple (or no) rows returned',
          details: `The result contains ${rows.length} rows`,
          hint: null,
        },
      }
    }
    return { data: rows, error: null, count, status, statusText: 'OK' }
  }

  private run() {
    const rows = tableRows(this.table)
    const now = new Date().toISOString()

    if (this.mode === 'select') {
      const found = this.sorted(this.matching(rows))
      const count = this.countMode ? found.length : null
      return this.finish(clone(this.paged(found)), count)
    }

    if (this.mode === 'insert' || this.mode === 'upsert') {
      const values: Row[] = Array.isArray(this.payload) ? this.payload : [this.payload]
      const keys = this.onConflict.split(',').map((k) => k.trim())
      const written = values.map((v) => {
        if (this.mode === 'upsert') {
          const existing = rows.find((r) => keys.every((k) => v[k] != null && sameValue(r[k], v[k])))
          if (existing) return Object.assign(existing, clone(v), { updated_at: now })
        }
        const row = { id: newId(), created_at: now, ...clone(v) }
        rows.push(row)
        return row
      })
      return this.finish(this.returning ? clone(written) : null, this.countMode ? written.length : null, 201)
    }

    const targets = this.matching(rows)
    if (this.mode === 'update') {
      for (const r of targets) Object.assign(r, clone(this.payload))
      return this.finish(this.returning ? clone(targets) : null, this.countMode ? targets.length : null)
    }

    // delete
    for (const r of targets) rows.splice(rows.indexOf(r), 1)
    return this.finish(this.returning ? clone(targets) : null, this.countMode ? targets.length : null)
  }
}

/** Unknown builder methods become harmless no-ops instead of crashing a page. */
function tolerant<T extends object>(target: T): T {
  const proxy: T = new Proxy(target, {
    get(t, prop, receiver) {
      if (prop in t) {
        const v = Reflect.get(t, prop, receiver)
        return typeof v === 'function' ? (...args: any[]) => {
          const out = v.apply(t, args)
          return out === t ? proxy : out
        } : v
      }
      if (typeof prop === 'symbol') return undefined
      return () => proxy
    },
  })
  return proxy
}

// ─────────────────────────────────────────────────────────────
// Auth, storage, realtime
// ─────────────────────────────────────────────────────────────
const demoAuthUser = {
  id: DEMO_USER.id,
  email: DEMO_USER.email,
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: DEMO_USER.full_name, role: DEMO_USER.role },
  created_at: '2026-01-01T00:00:00.000Z',
  last_sign_in_at: new Date().toISOString(),
}

const demoSession = {
  access_token: 'demo-access-token',
  refresh_token: 'demo-refresh-token',
  token_type: 'bearer',
  expires_in: 60 * 60 * 24 * 365,
  expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
  user: demoAuthUser,
}

const ok = <T,>(data: T) => Promise.resolve({ data, error: null })

function demoAuth() {
  const auth = {
    getUser: () => ok({ user: demoAuthUser }),
    getSession: () => ok({ session: demoSession }),
    getClaims: () => ok({ claims: { sub: demoAuthUser.id, email: demoAuthUser.email, role: 'authenticated' } }),
    refreshSession: () => ok({ user: demoAuthUser, session: demoSession }),
    setSession: () => ok({ user: demoAuthUser, session: demoSession }),
    signInWithPassword: () => ok({ user: demoAuthUser, session: demoSession }),
    signInWithOtp: () => ok({ user: null, session: null }),
    signUp: () => ok({ user: demoAuthUser, session: demoSession }),
    exchangeCodeForSession: () => ok({ user: demoAuthUser, session: demoSession }),
    updateUser: () => ok({ user: demoAuthUser }),
    resetPasswordForEmail: () => ok({}),
    signOut: () => Promise.resolve({ error: null }),
    onAuthStateChange: (cb: (event: string, session: any) => void) => {
      setTimeout(() => cb('INITIAL_SESSION', demoSession), 0)
      return { data: { subscription: { id: 'demo', callback: cb, unsubscribe() {} } } }
    },
  }
  return new Proxy(auth, {
    get: (t, prop) => (prop in t ? (t as any)[prop] : typeof prop === 'symbol' ? undefined : () => ok({})),
  })
}

function demoStorage() {
  const placeholder = '/sabbath-logo.png'
  return {
    from: (bucket: string) => ({
      upload: (path: string) => ok({ id: newId(), path, fullPath: `${bucket}/${path}` }),
      update: (path: string) => ok({ id: newId(), path, fullPath: `${bucket}/${path}` }),
      remove: (paths: string[]) => ok(paths.map((name) => ({ name }))),
      list: () => ok([]),
      download: () => ok(new Blob()),
      getPublicUrl: () => ({ data: { publicUrl: placeholder } }),
      createSignedUrl: () => ok({ signedUrl: placeholder }),
      createSignedUrls: (paths: string[]) => ok(paths.map((path) => ({ path, signedUrl: placeholder, error: null }))),
    }),
  }
}

function demoChannel(name: string) {
  const channel: any = {
    topic: `realtime:${name}`,
    on: () => channel,
    subscribe: (cb?: (status: string) => void) => { setTimeout(() => cb?.('SUBSCRIBED'), 0); return channel },
    unsubscribe: () => Promise.resolve('ok'),
    send: () => Promise.resolve('ok'),
    track: () => Promise.resolve('ok'),
    untrack: () => Promise.resolve('ok'),
    presenceState: () => ({}),
  }
  return channel
}

// ─────────────────────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────────────────────
let announced = false

export function createDemoClient(): any {
  if (!announced) {
    announced = true
    console.info('[demo-mode] using in-memory Supabase stand-in (fake data)')
  }
  return {
    from: (table: string) => tolerant(new DemoQuery(table)),
    schema: () => ({ from: (table: string) => tolerant(new DemoQuery(table)) }),
    rpc: () => tolerant(new DemoQuery('__rpc__')),
    auth: demoAuth(),
    storage: demoStorage(),
    channel: demoChannel,
    getChannels: () => [],
    removeChannel: () => Promise.resolve('ok'),
    removeAllChannels: () => Promise.resolve([]),
    functions: { invoke: () => ok(null) },
    realtime: { setAuth: () => {} },
  }
}
