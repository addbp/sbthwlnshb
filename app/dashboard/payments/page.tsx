'use client'

// app/dashboard/payments/page.tsx
// Fixed: Session Cookie bug via createBrowserClient
// Fixed: select('*') for unbreakable database mapping

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { type SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface Payment {
  id: string
  date: string
  client: string
  service: string
  amount: number
  method: string
  status: string
}

// ─────────────────────────────────────────────────────────────
// CONFIG & STYLING
// ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  paid: { label: 'Paid', color: '#3D7A4A', bg: 'rgba(61,122,74,0.12)', border: 'rgba(61,122,74,0.28)' },
  pending: { label: 'Pending', color: '#A07530', bg: 'rgba(197,143,59,0.14)', border: 'rgba(197,143,59,0.32)' },
  refunded: { label: 'Refunded', color: '#8B3A3A', bg: 'rgba(139,58,58,0.12)', border: 'rgba(139,58,58,0.28)' },
  default: { label: 'Unknown', color: '#7A6E65', bg: 'rgba(122,110,101,0.12)', border: 'rgba(122,110,101,0.28)' }
}

const METHOD_CFG: Record<string, { color: string; bg: string }> = {
  'Cash': { color: '#2A6A8A', bg: 'rgba(42,106,138,0.11)' },
  'GCash': { color: '#1A5CA8', bg: 'rgba(26,92,168,0.11)' },
  'Card': { color: '#6A3A8A', bg: 'rgba(106,58,138,0.11)' },
  'Bank Transfer': { color: '#2A7A5A', bg: 'rgba(42,122,90,0.11)' },
  'Default': { color: '#4A4A4A', bg: 'rgba(74,74,74,0.11)' }
}

const fmt = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function normalizeMethod(m: string): string {
  if (!m) return 'Cash';
  const lower = m.toLowerCase();
  if (lower.includes('gcash')) return 'GCash';
  if (lower.includes('bank') || lower.includes('transfer')) return 'Bank Transfer';
  if (lower.includes('card') || lower.includes('master') || lower.includes('visa')) return 'Card';
  return 'Cash';
}

function normalizeStatus(s: string): string {
  if (!s) return 'paid';
  const lower = s.toLowerCase();
  if (lower.includes('pend')) return 'pending';
  if (lower.includes('refund')) return 'refunded';
  return 'paid'; // Treat 'completed', 'confirmed', 'paid' as paid in ledger
}

// ─────────────────────────────────────────────────────────────
// KPI TILE
// ─────────────────────────────────────────────────────────────
function MiniKpi({ label, value, sub, accent = false }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div style={{
      backgroundColor: accent ? '#1A1A1A' : '#FFFFFF',
      border: `1px solid ${accent ? 'rgba(197,143,59,0.20)' : 'rgba(26,26,26,0.09)'}`,
      borderRadius: 16, padding: '22px 24px',
      boxShadow: accent ? '0 6px 22px rgba(0,0,0,0.18)' : '0 2px 10px rgba(0,0,0,0.06)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 20, right: 20, height: 2, backgroundColor: '#C58F3B', opacity: accent ? 0.7 : 0.4, borderRadius: '0 0 2px 2px' }} />
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: accent ? 'rgba(243,233,224,0.50)' : '#7A6E65', margin: '0 0 10px', fontFamily: "'Inter',system-ui,sans-serif" }}>{label}</p>
      <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(2rem,3.5vw,2.8rem)', fontWeight: 300, lineHeight: 1, color: accent ? '#F3E9E0' : '#1A1A1A', margin: '0 0 6px', letterSpacing: '-0.02em' }}>{value}</p>
      <p style={{ fontSize: 12, color: accent ? 'rgba(243,233,224,0.38)' : '#9A8E85', margin: 0, fontFamily: "'Inter',system-ui,sans-serif" }}>{sub}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default function PaymentsPage() {
  const supabaseRef = useRef<SupabaseClient | null>(null)

  if (!supabaseRef.current) {
    supabaseRef.current = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  const supabase = supabaseRef.current

  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState<string>('') // Empty = all time
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const loadPayments = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('bookings')
      .select('*') // CRITICAL: Pull all columns to prevent crashing
      .order('created_at', { ascending: false })

    if (dateFilter) {
      query = query.eq('appointment_date', dateFilter)
    }

    const { data, error } = await query

    if (!error && data) {
      const formatted: Payment[] = data.map(b => ({
        id: String(b.id).substring(0, 8).toUpperCase(),
        date: String(b.appointment_date || b.created_at?.split('T')[0] || ''),
        client: String(b.client_name || 'Walk-in'),
        service: String(b.service_name || 'Standard Session'),
        amount: Number(b.amount || 0),
        method: normalizeMethod(String(b.payment_method || '')),
        status: normalizeStatus(String(b.payment_status || b.status || '')),
      }))
      setPayments(formatted)
    }
    setLoading(false)
  }, [supabase, dateFilter])

  useEffect(() => {
    loadPayments()
  }, [loadPayments])

  const filtered = payments.filter(p =>
    (methodFilter === 'all' || p.method === methodFilter) &&
    (statusFilter === 'all' || p.status === statusFilter)
  )

  const totalPaid = payments.filter(p => p.status === 'paid').reduce((a, p) => a + p.amount, 0)
  const totalPending = payments.filter(p => p.status === 'pending').reduce((a, p) => a + p.amount, 0)
  const totalRefunded = payments.filter(p => p.status === 'refunded').reduce((a, p) => a + p.amount, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* Header & Date Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 6px' }}>
            Finance
          </p>
          <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 300, color: '#1A1A1A', margin: 0 }}>
            Payments Ledger
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7A6E65', marginBottom: 4 }}>
            Date Filter
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{
                padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(26,26,26,0.15)',
                backgroundColor: '#FFFFFF', color: '#1A1A1A', fontFamily: "'Inter',system-ui,sans-serif",
                fontSize: 13, outline: 'none'
              }}
            />
            {dateFilter && (
              <button onClick={() => setDateFilter('')} style={{
                padding: '0 12px', borderRadius: 8, border: '1px solid rgba(26,26,26,0.15)',
                backgroundColor: '#FFFFFF', color: '#1A1A1A', cursor: 'pointer', fontSize: 12
              }}>Clear</button>
            )}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px,100%),1fr))', gap: 14 }}>
        <MiniKpi label="Total Collected" value={fmt(totalPaid)} sub={`${payments.filter(p => p.status === 'paid').length} transactions`} accent />
        <MiniKpi label="Pending" value={fmt(totalPending)} sub={`${payments.filter(p => p.status === 'pending').length} awaiting`} />
        <MiniKpi label="Refunded" value={fmt(totalRefunded)} sub={`${payments.filter(p => p.status === 'refunded').length} processed`} />
        <MiniKpi label="Transactions" value={String(payments.length)} sub={dateFilter ? "For selected date" : "All time records"} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#9A8E85' }}>Filter:</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all', 'paid', 'pending', 'refunded'].map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} style={{
              padding: '0 14px', height: 34, borderRadius: 8, cursor: 'pointer',
              fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
              border: '1px solid', transition: 'all 160ms ease',
              backgroundColor: statusFilter === f ? '#1A1A1A' : 'transparent',
              borderColor: statusFilter === f ? '#1A1A1A' : 'rgba(26,26,26,0.15)',
              color: statusFilter === f ? '#C58F3B' : 'rgba(26,26,26,0.40)',
            }}>{f}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', 'Cash', 'GCash', 'Card', 'Bank Transfer'] as const).map(f => (
            <button key={f} onClick={() => setMethodFilter(f)} style={{
              padding: '0 14px', height: 34, borderRadius: 8, cursor: 'pointer',
              fontSize: 11, fontWeight: 500, letterSpacing: '0.06em',
              border: '1px solid', transition: 'all 160ms ease',
              backgroundColor: methodFilter === f ? 'rgba(197,143,59,0.15)' : 'transparent',
              borderColor: methodFilter === f ? 'rgba(197,143,59,0.55)' : 'rgba(26,26,26,0.12)',
              color: methodFilter === f ? '#A07530' : 'rgba(26,26,26,0.35)',
            }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: '#FFFFFF', backgroundImage: 'none', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, boxShadow: '0 3px 14px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)' }}>
                {['Ref', 'Date', 'Client', 'Service', 'Amount', 'Method', 'Status'].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left', whiteSpace: 'nowrap',
                    fontFamily: "'Inter',system-ui,sans-serif",
                    fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: '#C58F3B', backgroundColor: '#F8F4EE',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '44px 16px', textAlign: 'center', color: '#9A8E85', fontStyle: 'italic', fontFamily: "'Inter',system-ui,sans-serif" }}>
                    <div style={{ display: 'inline-block', width: 20, height: 20, border: '2px solid rgba(197,143,59,0.3)', borderTopColor: '#C58F3B', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    <div style={{ marginTop: 8 }}>Loading ledger...</div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '44px 16px', textAlign: 'center', color: '#9A8E85', fontStyle: 'italic', fontFamily: "'Inter',system-ui,sans-serif" }}>
                    No payments match this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((p, i) => {
                  const sc = STATUS_CFG[p.status] || STATUS_CFG.default
                  const mc = METHOD_CFG[p.method] || METHOD_CFG.Default
                  return (
                    <tr key={p.id + i}
                      style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(26,26,26,0.06)' : 'none', transition: 'background 120ms ease' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(197,143,59,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                    >
                      <td style={{ padding: '13px 16px', fontFamily: "'Inter',system-ui,sans-serif", fontSize: 12, color: '#9A8E85', whiteSpace: 'nowrap' }}>{p.id}</td>
                      <td style={{ padding: '13px 16px', color: '#4A4A4A', whiteSpace: 'nowrap', fontFamily: "'Inter',system-ui,sans-serif" }}>{p.date}</td>
                      <td style={{ padding: '13px 16px', color: '#2A2A2A', whiteSpace: 'nowrap', fontFamily: "'Inter',system-ui,sans-serif", fontWeight: 500 }}>{p.client}</td>
                      <td style={{ padding: '13px 16px', color: '#4A4A4A', fontFamily: "'Inter',system-ui,sans-serif" }}>{p.service}</td>
                      <td style={{ padding: '13px 16px', whiteSpace: 'nowrap', fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 19, fontWeight: 600, color: '#1A1A1A' }}>{fmt(p.amount)}</td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', backgroundColor: mc.bg, color: mc.color, fontFamily: "'Inter',system-ui,sans-serif" }}>
                          {p.method}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 11px', borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, fontFamily: "'Inter',system-ui,sans-serif" }}>
                          {sc.label}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 20px', backgroundColor: '#F8F4EE', borderTop: '1px solid rgba(26,26,26,0.07)', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#9A8E85', fontFamily: "'Inter',system-ui,sans-serif" }}>{filtered.length} of {payments.length} transactions</span>
          <span style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 20, color: '#1A1A1A' }}>
            Showing: <strong style={{ color: '#C58F3B' }}>{fmt(filtered.filter(p => p.status === 'paid').reduce((a, p) => a + p.amount, 0))}</strong>
          </span>
        </div>
      </div>

    </div>
  )
}