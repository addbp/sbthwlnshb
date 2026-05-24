'use client'

// app/dashboard/page.tsx — Phase 4 Overview
// · Fixed "Session Expired" by using createBrowserClient (Cookie-based auth)
// · Real Supabase data — today's bookings only, filtered by created_at

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { type SupabaseClient } from '@supabase/supabase-js'
import CheckoutModal, { type CheckoutBooking } from '@/components/ui/CheckoutModal'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type SaleStatus = 'completed' | 'in_progress' | 'confirmed' | 'upcoming' | 'cancelled'

interface Sale {
  id: string
  time: string
  service: string
  therapist: string
  client: string
  amount: number
  status: SaleStatus
}

interface Summary {
  gross: number
  commission: number
  net: number
  active: number
}

interface ServiceStat {
  name: string
  count: number
  revenue: number
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const COMMISSION_RATE = 0.30
const AUTO_REFRESH_MS = 60_000
const CACHE_TTL_MS = 30_000

const STATUS_CFG: Record<SaleStatus, { label: string; color: string; bg: string; border: string }> = {
  completed: { label: 'Completed', color: '#3D7A4A', bg: 'rgba(61,122,74,0.12)', border: 'rgba(61,122,74,0.28)' },
  in_progress: { label: 'In Progress', color: '#2A6A8A', bg: 'rgba(42,106,138,0.13)', border: 'rgba(42,106,138,0.30)' },
  confirmed: { label: 'Confirmed', color: '#A07530', bg: 'rgba(197,143,59,0.14)', border: 'rgba(197,143,59,0.35)' },
  upcoming: { label: 'Upcoming', color: '#7A6A50', bg: 'rgba(122,106,80,0.10)', border: 'rgba(122,106,80,0.25)' },
  cancelled: { label: 'Cancelled', color: '#8B3A3A', bg: 'rgba(139,58,58,0.12)', border: 'rgba(139,58,58,0.28)' },
}

const FILTER_TABS: { key: string; label: string; match: SaleStatus[] }[] = [
  { key: 'all', label: 'All', match: ['completed', 'in_progress', 'confirmed', 'upcoming', 'cancelled'] },
  { key: 'active', label: 'Active ↑', match: ['in_progress', 'confirmed'] },
  { key: 'done', label: 'Completed', match: ['completed'] },
  { key: 'next', label: 'Upcoming', match: ['upcoming'] },
]

const DEMO_SALES: Sale[] = [] // Removed fake data to enforce live data

// ─────────────────────────────────────────────────────────────
// TIME-BASED GREETING
// ─────────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'Good morning'
  if (h >= 12 && h < 17) return 'Good afternoon'
  if (h >= 17 && h < 21) return 'Good evening'
  return 'Good night'
}

// ─────────────────────────────────────────────────────────────
// CLIENT-SIDE CACHE
// ─────────────────────────────────────────────────────────────
const _cache = {
  data: null as Sale[] | null,
  ts: 0,
  isValid: () => _cache.data !== null && Date.now() - _cache.ts < CACHE_TTL_MS,
  set: (d: Sale[]) => { _cache.data = d; _cache.ts = Date.now() },
  bust: () => { _cache.data = null; _cache.ts = 0 },
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const VALID_STATUSES: SaleStatus[] = ['completed', 'in_progress', 'confirmed', 'upcoming', 'cancelled']

function mapRow(row: Record<string, unknown>): Sale {
  let time = '--:--'
  try {
    if (row.appointment_time) {
      time = String(row.appointment_time).slice(0, 5)
    } else if (row.created_at) {
      const d = new Date(String(row.created_at))
      if (!isNaN(d.getTime())) time = d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: false })
    }
  } catch { /* silent */ }

  const rawAmount = Number(row.amount)
  const rawStatus = String(row.status ?? '')

  return {
    id: String(row.id ?? `r-${Math.random()}`),
    time,
    service: String(row.service_name ?? row.service ?? 'Standard Service'),
    therapist: String(row.therapist_name ?? row.therapist ?? 'Staff'),
    client: String(row.client_name ?? row.client ?? 'Guest'),
    amount: isFinite(rawAmount) && rawAmount >= 0 ? rawAmount : 0,
    status: VALID_STATUSES.includes(rawStatus as SaleStatus) ? (rawStatus as SaleStatus) : 'upcoming',
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

const fmt = (n: number) => '₱' + n.toLocaleString('en-PH')

// ─────────────────────────────────────────────────────────────
// FETCH (with SSR guard, auth check, retry)
// ─────────────────────────────────────────────────────────────
async function fetchSalesData(
  supabase: SupabaseClient,
  force = false,
): Promise<Sale[]> {
  if (typeof window === 'undefined') return []

  if (!force && _cache.isValid()) return _cache.data!

  // CRITICAL: Checks the cookie session
  const { data: { session }, error: sessionErr } = await supabase.auth.getSession()

  if (sessionErr || !session) {
    throw new Error('AUTH_REQUIRED: Please log in.')
  }

  let lastErr: Error | null = null

  for (let attempt = 0; attempt <= 3; attempt++) {
    if (attempt > 0) await sleep(1000 * Math.pow(2, attempt - 1))

    try {
      const todayISO = new Date().toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('bookings')
        .select('id, service_name, therapist_name, client_name, amount, status, created_at, appointment_time')
        .gte('created_at', `${todayISO}T00:00:00.000Z`)
        .lte('created_at', `${todayISO}T23:59:59.999Z`)
        .order('created_at', { ascending: true })

      if (error) {
        throw new Error(error.message)
      }

      const sales = data && data.length > 0 ? data.map(mapRow) : []
      _cache.set(sales)
      return sales
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error('Network error')
    }
  }

  throw lastErr ?? new Error('Failed to load data.')
}

// ─────────────────────────────────────────────────────────────
// COMPUTATIONS
// ─────────────────────────────────────────────────────────────
function computeSummary(sales: Sale[]): Summary {
  const completed = sales.filter(s => s.status === 'completed')
  const gross = completed.reduce((a, s) => a + s.amount, 0)
  const commission = Math.round(gross * COMMISSION_RATE)

  return {
    gross,
    commission,
    net: gross - commission,
    active: sales.filter(s => s.status === 'in_progress' || s.status === 'confirmed').length,
  }
}

function computeBreakdown(sales: Sale[]): ServiceStat[] {
  const map: Record<string, ServiceStat> = {}

  for (const s of sales.filter(x => x.status === 'completed')) {
    if (!map[s.service]) map[s.service] = { name: s.service, count: 0, revenue: 0 }

    map[s.service].count++
    map[s.service].revenue += s.amount
  }

  return Object.values(map).sort((a, b) => b.revenue - a.revenue)
}

// ─────────────────────────────────────────────────────────────
// SKELETONS
// ─────────────────────────────────────────────────────────────
function Shim({ w = '100%', h = 20, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, background: 'linear-gradient(90deg,#EDE8E0 0%,#E0D8CE 50%,#EDE8E0 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite', flexShrink: 0 }} />
  )
}

function PageSkeleton() {
  return (
    <>
      <style>{`@keyframes shimmer{from{background-position:-200% center}to{background-position:200% center}}`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><Shim w={100} h={10} /><Shim w={220} h={34} /></div>
          <Shim w={110} h={40} r={10} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(180px,100%),1fr))', gap: 14 }}>
          {[1, 2, 3, 4].map(i => <div key={i} style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}><Shim w={80} h={10} /><Shim w="70%" h={36} /><Shim w={120} h={10} /></div>)}
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// ERROR UI
// ─────────────────────────────────────────────────────────────
function ErrorUI({ error, onRetry }: { error: string; onRetry: () => void }) {
  const isAuth = error.startsWith('AUTH_REQUIRED')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: 'clamp(40px,8vh,72px) 24px', textAlign: 'center' }}>
      <div style={{ width: 60, height: 60, borderRadius: '50%', backgroundColor: 'rgba(139,58,58,0.10)', border: '1.5px solid rgba(139,58,58,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 8v5M12 16h.01" stroke="#8B3A3A" strokeWidth="2" strokeLinecap="round" />
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="#8B3A3A" strokeWidth="1.6" />
        </svg>
      </div>

      <div>
        <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 22, fontWeight: 400, color: '#1A1A1A', margin: '0 0 6px' }}>
          {isAuth ? 'Session expired' : 'Connection interrupted'}
        </p>
        <p style={{ fontFamily: "'Inter',system-ui,sans-serif", fontSize: 14, color: 'rgba(26,26,26,0.50)', margin: 0, maxWidth: 360 }}>
          {isAuth ? 'Your login session has expired. Please log in again.' : error}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onRetry} style={{ padding: '0 22px', height: 44, backgroundColor: '#1A1A1A', color: '#C58F3B', border: '1px solid rgba(197,143,59,0.40)', borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'Inter',system-ui,sans-serif" }}>
          Try Again
        </button>

        {isAuth && (
          <a href="/login" style={{ padding: '0 22px', height: 44, backgroundColor: '#C58F3B', color: '#1A1A1A', border: '1px solid #A07530', borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', textDecoration: 'none', fontFamily: "'Inter',system-ui,sans-serif", display: 'inline-flex', alignItems: 'center' }}>
            Log In
          </a>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SUMMARY TILES
// ─────────────────────────────────────────────────────────────
function SummaryTiles({ summary, completedCount }: { summary: Summary; completedCount: number }) {
  const tiles = [
    { label: 'Gross Sales', value: fmt(summary.gross), sub: `${completedCount} completed`, variant: 'light' as const },
    { label: `Commission (${Math.round(COMMISSION_RATE * 100)}%)`, value: fmt(summary.commission), sub: 'Therapist cuts', variant: 'light' as const },
    { label: 'Net Sales', value: fmt(summary.net), sub: 'After commission', variant: 'dark' as const },
    { label: 'Active Sessions', value: String(summary.active), sub: summary.active > 0 ? `${summary.active} need check-out` : 'None active', variant: summary.active > 0 ? 'gold' as const : 'light' as const },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(190px,100%),1fr))', gap: 14 }}>
      {tiles.map(t => {
        const isG = t.variant === 'gold', isD = t.variant === 'dark'
        const bg = isG ? '#C58F3B' : isD ? '#1A1A1A' : '#FFFFFF'
        const vCol = isG ? '#1A1A1A' : isD ? '#F3E9E0' : '#1A1A1A'
        const lCol = isG ? 'rgba(26,26,26,0.65)' : isD ? 'rgba(243,233,224,0.50)' : '#7A6E65'
        const sCol = isG ? 'rgba(26,26,26,0.55)' : isD ? 'rgba(243,233,224,0.38)' : '#9A8E85'
        const bdr = isG ? '#A07530' : isD ? 'rgba(197,143,59,0.20)' : 'rgba(26,26,26,0.09)'

        return (
          <div key={t.label} style={{ position: 'relative', overflow: 'hidden', backgroundColor: bg, backgroundImage: 'none', border: `1px solid ${bdr}`, borderRadius: 16, padding: '20px 22px', boxShadow: (isG || isD) ? '0 6px 20px rgba(0,0,0,0.18)' : '0 2px 10px rgba(0,0,0,0.06)', transition: 'transform 240ms ease' }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = ''}
          >
            {!isG && <div style={{ position: 'absolute', top: 0, left: 16, right: 16, height: 2, backgroundColor: '#C58F3B', opacity: isD ? 0.65 : 0.40, borderRadius: '0 0 2px 2px' }} />}

            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: lCol, margin: '0 0 10px', fontFamily: "'Inter',system-ui,sans-serif" }}>{t.label}</p>
            <p style={{ fontFamily: "'Inter',system-ui,sans-serif", fontSize: 'clamp(1.6rem,2.8vw,2.2rem)', fontWeight: 700, lineHeight: 1, color: vCol, margin: '0 0 6px' }}>{t.value}</p>
            <p style={{ fontSize: 12, color: sCol, margin: 0, fontFamily: "'Inter',system-ui,sans-serif" }}>{t.sub}</p>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SERVICE BREAKDOWN STRIP
// ─────────────────────────────────────────────────────────────
function ServiceBreakdownStrip({ stats }: { stats: ServiceStat[] }) {
  if (stats.length === 0) return (
    <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.38)', fontStyle: 'italic', fontFamily: "'Inter',system-ui,sans-serif", margin: 0 }}>
      No completed sessions yet today.
    </p>
  )

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {stats.map(s => (
        <div key={s.name} style={{ backgroundColor: '#FFFFFF', backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 12, padding: '12px 16px', minWidth: 160, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 6px', fontFamily: "'Inter',system-ui,sans-serif" }}>
            {s.count} session{s.count !== 1 ? 's' : ''}
          </p>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', margin: '0 0 2px', fontFamily: "'Inter',system-ui,sans-serif", lineHeight: 1.3 }}>{s.name}</p>
          <p style={{ fontSize: 12, color: '#9A8E85', margin: 0, fontFamily: "'Inter',system-ui,sans-serif" }}>{fmt(s.revenue)}</p>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SESSIONS TABLE
// ─────────────────────────────────────────────────────────────
function SessionsTable({
  sales,
  onCheckout,
}: {
  sales: Sale[]
  onCheckout: (b: CheckoutBooking) => void
}) {
  const [filter, setFilter] = useState('all')

  const filterDef = FILTER_TABS.find(t => t.key === filter) ?? FILTER_TABS[0]
  const rows = sales.filter(s => filterDef.match.includes(s.status))
  const totalPaid = sales.filter(s => s.status === 'completed').reduce((a, s) => a + s.amount, 0)
  const pendingCount = sales.filter(s => s.status === 'in_progress' || s.status === 'confirmed').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {pendingCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', backgroundColor: 'rgba(197,143,59,0.10)', border: '1px solid rgba(197,143,59,0.35)', borderRadius: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: '#C58F3B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x=".75" y="3" width="13.5" height="9" rx="1.5" stroke="#1A1A1A" strokeWidth="1.4" />
              <path d="M.75 6.5h13.5" stroke="#1A1A1A" strokeWidth="1.2" />
              <circle cx="4" cy="9.5" r=".9" fill="#1A1A1A" />
            </svg>
          </div>
          <p style={{ flex: 1, fontSize: 13, color: '#1A1A1A', margin: 0, fontFamily: "'Inter',system-ui,sans-serif" }}>
            <strong>{pendingCount} session{pendingCount > 1 ? 's' : ''}</strong> ready for check-out. Tap the <strong>Check-out</strong> button below.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(197,143,59,0.65)', margin: '0 0 4px', fontFamily: "'Inter',system-ui,sans-serif" }}>Today's Sessions</p>
          <div style={{ fontFamily: "'Inter',system-ui,sans-serif", fontSize: 20, fontWeight: 700, color: '#1A1A1A', display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            Daily Sales Overview
            <span style={{ fontSize: 14, color: '#C58F3B', fontWeight: 700 }}>{fmt(totalPaid)} collected</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTER_TABS.map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)} style={{ padding: '0 14px', height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', fontFamily: "'Inter',system-ui,sans-serif", border: '1px solid', transition: 'all 150ms ease', backgroundColor: filter === tab.key ? '#1A1A1A' : 'transparent', borderColor: filter === tab.key ? '#1A1A1A' : 'rgba(26,26,26,0.16)', color: filter === tab.key ? '#C58F3B' : 'rgba(26,26,26,0.42)' }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ backgroundColor: '#FFFFFF', backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, boxShadow: '0 3px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)' }}>
                {['Time', 'Service', 'Therapist', 'Client', 'Amount', 'Status', 'Action'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontFamily: "'Inter',system-ui,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C58F3B', backgroundColor: '#F8F4EE', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((s, i) => {
                const st = STATUS_CFG[s.status]
                const canOut = s.status === 'in_progress' || s.status === 'confirmed'

                return (
                  <tr key={s.id}
                    style={{ borderBottom: i < rows.length - 1 ? '1px solid rgba(26,26,26,0.06)' : 'none', transition: 'background 130ms ease', backgroundColor: canOut ? 'rgba(197,143,59,0.03)' : 'transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = canOut ? 'rgba(197,143,59,0.07)' : 'rgba(197,143,59,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = canOut ? 'rgba(197,143,59,0.03)' : 'transparent')}
                  >
                    <td style={{ padding: '13px 16px', fontWeight: 700, color: '#1A1A1A', whiteSpace: 'nowrap', fontFamily: "'Inter',system-ui,sans-serif" }}>{s.time}</td>
                    <td style={{ padding: '13px 16px', color: '#2A2A2A', fontFamily: "'Inter',system-ui,sans-serif" }}>{s.service}</td>
                    <td style={{ padding: '13px 16px', color: '#4A4A4A', whiteSpace: 'nowrap', fontFamily: "'Inter',system-ui,sans-serif" }}>{s.therapist}</td>
                    <td style={{ padding: '13px 16px', color: '#4A4A4A', whiteSpace: 'nowrap', fontFamily: "'Inter',system-ui,sans-serif" }}>{s.client}</td>
                    <td style={{ padding: '13px 16px', whiteSpace: 'nowrap', fontFamily: "'Inter',system-ui,sans-serif", fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>{fmt(s.amount)}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}`, fontFamily: "'Inter',system-ui,sans-serif", whiteSpace: 'nowrap' }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                      {canOut ? (
                        <button
                          onClick={() => onCheckout({ id: s.id, service: s.service, therapist: s.therapist, client: s.client, amount: s.amount, time: s.time, status: s.status })}
                          style={{ padding: '0 14px', height: 32, border: '1.5px solid rgba(197,143,59,0.55)', borderRadius: 8, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'Inter',system-ui,sans-serif", display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 180ms ease', whiteSpace: 'nowrap' }}
                          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#C58F3B'; el.style.color = '#1A1A1A' }}
                          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'transparent'; el.style.color = '#C58F3B' }}
                        >
                          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                            <rect x=".5" y="2" width="10" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
                            <path d="M.5 4.5h10" stroke="currentColor" strokeWidth="1.2" />
                            <circle cx="2.8" cy="6.5" r=".7" fill="currentColor" />
                          </svg>
                          Check-out
                        </button>
                      ) : (
                        <span style={{ color: 'rgba(26,26,26,0.18)', fontSize: 18, paddingLeft: 4 }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}

              {rows.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '44px 16px', textAlign: 'center', color: '#9A8E85', fontStyle: 'italic', fontFamily: "'Inter',system-ui,sans-serif" }}>No sessions yet today.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', backgroundColor: '#F8F4EE', borderTop: '1px solid rgba(26,26,26,0.07)', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#9A8E85', fontFamily: "'Inter',system-ui,sans-serif" }}>
            {rows.length} of {sales.length} sessions{pendingCount > 0 && <span style={{ marginLeft: 10, color: '#C58F3B', fontWeight: 700 }}>· {pendingCount} pending check-out</span>}
          </span>
          <span style={{ fontFamily: "'Inter',system-ui,sans-serif", fontSize: 17, fontWeight: 700, color: '#1A1A1A' }}>
            Collected: <strong style={{ color: '#C58F3B' }}>{fmt(totalPaid)}</strong>
          </span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const supabaseRef = useRef<SupabaseClient | null>(null)

  if (!supabaseRef.current) {
    // CRITICAL FIX: Use createBrowserClient so it reads the Next.js Cookie properly
    supabaseRef.current = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  const supabase = supabaseRef.current

  const [greeting, setGreeting] = useState('')
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const [checkoutBooking, setCheckoutBooking] = useState<CheckoutBooking | null>(null)

  useEffect(() => {
    const update = () => setGreeting(getGreeting())
    update()

    const t = setInterval(update, 60_000)
    return () => clearInterval(t)
  }, [])

  const loadData = useCallback(async (force = false) => {
    if (force) _cache.bust()

    setRefreshing(true)

    try {
      const data = await fetchSalesData(supabase, force)
      setSales(data)
      setError(null)
      setLastFetched(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [supabase])

  useEffect(() => {
    loadData()

    const t = setInterval(() => loadData(false), AUTO_REFRESH_MS)
    return () => clearInterval(t)
  }, [loadData])

  function handlePaymentSuccess(_id: string) {
    setCheckoutBooking(null)
    loadData(true)
  }

  const summary = computeSummary(sales)
  const breakdown = computeBreakdown(sales)
  const completedCount = sales.filter(s => s.status === 'completed').length
  const todayLabel = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {checkoutBooking && (
        <CheckoutModal
          booking={checkoutBooking}
          onClose={() => setCheckoutBooking(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, fontFamily: "'Inter',system-ui,sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Daily Overview</p>
            <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.8rem,3vw,2.5rem)', fontWeight: 300, color: '#1A1A1A', margin: 0, lineHeight: 1.1, minHeight: '1.1em' }}>
              {greeting || '\u00A0'}
            </h2>
            <p style={{ color: 'rgba(26,26,26,0.40)', fontSize: 13, margin: '4px 0 0' }}>{todayLabel}</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {lastFetched && (
              <span style={{ fontSize: 11, color: 'rgba(26,26,26,0.35)' }}>
                Updated {lastFetched.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}

            <button onClick={() => loadData(true)} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 16px', height: 40, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 10, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', cursor: refreshing ? 'not-allowed' : 'pointer', transition: 'background-color 180ms ease' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ animation: refreshing ? 'spin 700ms linear infinite' : 'none', flexShrink: 0 }}>
                <path d="M10.5 6a4.5 4.5 0 1 1-1.35-3.18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M10.5 2.25V5.5H7.25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {refreshing ? 'Syncing…' : 'Refresh'}
            </button>

            <button style={{ padding: '0 16px', height: 40, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 10, backgroundColor: '#1A1A1A', color: '#C58F3B', fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', cursor: 'pointer' }}>
              + New Booking
            </button>
          </div>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <ErrorUI error={error} onRetry={() => loadData(true)} />
        ) : (
          <>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(197,143,59,0.65)', margin: '0 0 12px' }}>Daily Sales Summary</p>
              <SummaryTiles summary={summary} completedCount={completedCount} />
            </div>

            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(197,143,59,0.65)', margin: '0 0 12px' }}>
                Services Availed Today
              </p>
              <ServiceBreakdownStrip stats={breakdown} />
            </div>

            <SessionsTable sales={sales} onCheckout={setCheckoutBooking} />
          </>
        )}
      </div>
    </>
  )
}