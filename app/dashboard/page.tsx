'use client'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────
// UNIVERSAL DATE PARSER
// ─────────────────────────────────────────────────────────────
const FULL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function parseImportDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const cleanStr = String(dateStr).trim();
  if (!cleanStr) return null;

  let d = new Date(cleanStr);
  if (!isNaN(d.getTime())) return d;

  const dashMatch = cleanStr.match(/^(\d{1,2})[-\s/]+([A-Za-z]{3,})[-\s/]+(\d{2,4})$/);
  if (dashMatch) {
    let year = dashMatch[3];
    if (year.length === 2) year = '20' + year;
    d = new Date(`${dashMatch[2]} ${dashMatch[1]}, ${year}`);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function isoToImportDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  if (isNaN(d.getTime())) return iso
  return `${FULL_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDateShort(raw: string): string {
  const d = parseImportDate(raw)
  if (!d) return raw || '—'
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

const fmt = (n: number) => '₱' + n.toLocaleString('en-PH')
const fmtK = (n: number) => n >= 1_000_000 ? `₱${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `₱${(n / 1000).toFixed(1)}k` : fmt(n)

// ─────────────────────────────────────────────────────────────
// TYPES & FETCH
// ─────────────────────────────────────────────────────────────
interface Sale {
  _key: string; date: string; service: string; therapist: string;
  client: string; revenue: number; netSales: number;
  category: string; customerType: string; payMethod: string;
}

interface Summary {
  revenue: number; netSalesTotal: number; sessions: number;
  avgValue: number; newClients: number; uniqueClients: number;
}
interface ServiceStat { name: string; revenue: number; count: number }

async function fetchAll(supabase: ReturnType<typeof createClient>): Promise<Sale[]> {
  const COLS = 'date,client_name,service,therapist,received_payment,net_sales,category,customer_type,payment_method'
  const PAGE = 1000
  const all: Sale[] = []
  let from = 0

  for (; ;) {
    const { data, error } = await supabase.from('bookings_import').select(COLS).range(from, from + PAGE - 1)
    if (error || !data || data.length === 0) break
    data.forEach((r, i) => {
      const rev = Number(r.received_payment ?? 0)
      all.push({
        _key: `${r.client_name}-${r.date}-${from + i}`,
        date: String(r.date ?? ''), service: String(r.service ?? '—'),
        therapist: String(r.therapist ?? '—'), client: String(r.client_name ?? 'Guest'),
        revenue: isFinite(rev) ? rev : 0, netSales: Number(r.net_sales ?? 0),
        category: String(r.category ?? '—'), customerType: String(r.customer_type ?? '—'),
        payMethod: String(r.payment_method ?? '—'),
      })
    })
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

function computeSummary(sales: Sale[]): Summary {
  const rev = sales.reduce((a, s) => a + s.revenue, 0)
  const net = sales.reduce((a, s) => a + s.netSales, 0)
  const names = new Set(sales.map(s => s.client.trim().toLowerCase()))
  return {
    revenue: rev, netSalesTotal: net, sessions: sales.length,
    avgValue: sales.length > 0 ? Math.round(rev / sales.length) : 0,
    newClients: sales.filter(s => s.customerType.toLowerCase().includes('new')).length,
    uniqueClients: names.size,
  }
}

function computeBreakdown(sales: Sale[]): ServiceStat[] {
  const map: Record<string, ServiceStat> = {}
  for (const s of sales) {
    const k = s.service || s.category || 'Other'
    if (!map[k]) map[k] = { name: k, revenue: 0, count: 0 }
    map[k].revenue += s.revenue
    map[k].count++
  }
  return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 8)
}

function sortByDate(sales: Sale[]): Sale[] {
  return [...sales].sort((a, b) => {
    const da = parseImportDate(a.date)?.getTime() || 0
    const db = parseImportDate(b.date)?.getTime() || 0
    return db - da
  })
}

// ─────────────────────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────────────────────
function Shim({ w = '100%', h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: 'linear-gradient(90deg,#EDE8E0 0%,#E0D8CE 50%,#EDE8E0 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite' }} />
}

function KpiTiles({ s, label }: { s: Summary; label: string }) {
  const tiles = [
    { key: 'a', l: 'Total Revenue', v: fmtK(s.revenue), sub: label, dark: true },
    { key: 'b', l: 'Total Net Sales', v: fmtK(s.netSalesTotal), sub: 'After deductions', dark: false },
    { key: 'c', l: 'Total Sessions', v: s.sessions.toLocaleString(), sub: `${fmtK(s.avgValue)} avg per session`, dark: false },
    { key: 'd', l: 'Unique Clients', v: s.uniqueClients.toLocaleString(), sub: `${s.newClients} new · ${s.sessions - s.newClients} returning`, dark: false },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(190px,100%),1fr))', gap: 14 }}>
      {tiles.map(t => (
        <div key={t.key} style={{ position: 'relative', overflow: 'hidden', backgroundColor: t.dark ? '#1A1A1A' : '#FFFFFF', border: `1px solid ${t.dark ? 'rgba(197,143,59,0.20)' : 'rgba(26,26,26,0.09)'}`, borderRadius: 16, padding: '20px 22px', boxShadow: t.dark ? '0 6px 20px rgba(0,0,0,0.18)' : '0 2px 10px rgba(0,0,0,0.06)' }}>
          {!t.dark && <div style={{ position: 'absolute', top: 0, left: 16, right: 16, height: 2, backgroundColor: '#C58F3B', opacity: 0.40, borderRadius: '0 0 2px 2px' }} />}
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: t.dark ? 'rgba(243,233,224,0.50)' : '#7A6E65', margin: '0 0 10px' }}>{t.l}</p>
          <p style={{ fontSize: 'clamp(1.4rem,2.4vw,1.9rem)', fontWeight: 700, lineHeight: 1, color: t.dark ? '#F3E9E0' : '#1A1A1A', margin: '0 0 6px' }}>{t.v}</p>
          <p style={{ fontSize: 12, color: t.dark ? 'rgba(243,233,224,0.38)' : '#9A8E85', margin: 0 }}>{t.sub}</p>
        </div>
      ))}
    </div>
  )
}

function BreakdownStrip({ stats }: { stats: ServiceStat[] }) {
  if (!stats.length) return <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.38)', fontStyle: 'italic', margin: 0 }}>No sessions to break down.</p>
  const max = Math.max(...stats.map(s => s.revenue), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {stats.map(s => (
        <div key={s.name} style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 11, padding: '11px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5, flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{s.name}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#C58F3B' }}>{fmtK(s.revenue)} · {s.count.toLocaleString()} session{s.count !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(197,143,59,0.14)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, backgroundColor: '#C58F3B', width: `${Math.round((s.revenue / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const supabase = useRef(createClient()).current
  const [allSales, setAllSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'all' | 'date'>('all')
  const [selectedDate, setSelectedDate] = useState(todayISO())

  const loadData = useCallback(async () => {
    setLoading(true)
    const data = await fetchAll(supabase)
    setAllSales(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const sortedAll = sortByDate(allSales)
  const importDateStr = isoToImportDate(selectedDate)
  const dateSales = allSales.filter(s => fmtDateShort(s.date) === fmtDateShort(importDateStr))

  const tableSales = mode === 'date' ? dateSales : sortedAll.slice(0, 200)
  const tableTitle = mode === 'date' ? `Sessions on ${fmtDateShort(importDateStr)}` : 'Most Recent Sessions (latest 200)'

  const summary = computeSummary(allSales)
  const breakdown = computeBreakdown(mode === 'date' && dateSales.length > 0 ? dateSales : allSales)
  const totalRev = tableSales.reduce((a, s) => a + s.revenue, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Dashboard</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Overview</h2>
        </div>
        <button onClick={loadData} style={{ padding: '0 15px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>Refresh</button>
      </div>

      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: 'rgba(197,143,59,0.07)', borderRadius: 12 }}>Loading data...</div>
      ) : (
        <>
          <KpiTiles s={summary} label={`${allSales.length.toLocaleString()} total sessions`} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', borderRadius: 9, border: '1px solid rgba(26,26,26,0.14)', overflow: 'hidden' }}>
              <button onClick={() => setMode('all')} style={{ padding: '0 18px', height: 36, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', backgroundColor: mode === 'all' ? '#1A1A1A' : 'transparent', color: mode === 'all' ? '#C58F3B' : 'rgba(26,26,26,0.45)' }}>All Records</button>
              <button onClick={() => setMode('date')} style={{ padding: '0 18px', height: 36, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', backgroundColor: mode === 'date' ? '#1A1A1A' : 'transparent', color: mode === 'date' ? '#C58F3B' : 'rgba(26,26,26,0.45)' }}>By Date</button>
            </div>
            {mode === 'date' && <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ height: 36, padding: '0 12px', border: '1px solid rgba(26,26,26,0.16)', borderRadius: 8 }} />}
          </div>

          <BreakdownStrip stats={breakdown} />

          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, boxShadow: '0 3px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', backgroundColor: '#F8F4EE', borderBottom: '1px solid rgba(26,26,26,0.09)' }}>
              <p style={{ margin: 0, fontWeight: 700, color: '#1A1A1A' }}>{tableTitle} <span style={{ color: '#C58F3B', marginLeft: 10 }}>Total: {fmtK(totalRev)}</span></p>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)' }}>
                    {['Date', 'Client', 'Service', 'Therapist', 'Revenue', 'Payment'].map(h => <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#C58F3B' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {tableSales.map((s, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                      <td style={{ padding: '11px 14px', color: '#666' }}>{fmtDateShort(s.date)}</td>
                      <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1A1A1A' }}>{s.client}</td>
                      <td style={{ padding: '11px 14px', color: '#2A2A2A' }}>{s.service}</td>
                      <td style={{ padding: '11px 14px', color: '#4A4A4A' }}>{s.therapist}</td>
                      <td style={{ padding: '11px 14px', fontWeight: 700, color: '#1A1A1A' }}>{fmt(s.revenue)}</td>
                      <td style={{ padding: '11px 14px', color: '#666' }}>{s.payMethod || '—'}</td>
                    </tr>
                  ))}
                  {tableSales.length === 0 && <tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#666' }}>No records found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}