'use client'
export const dynamic = 'force-dynamic'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// --- BULLETPROOF DATE PARSER ---
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function parseImportDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const clean = String(raw).trim().replace(/,/g, '');
  if (!clean) return null;

  // Format 1: 1-May-25 or 01-May-2025
  const dashMatch = clean.match(/^(\d{1,2})[-\s/]+([A-Za-z]{3,})[-\s/]+(\d{2,4})$/);
  if (dashMatch) {
    let year = dashMatch[3];
    if (year.length === 2) year = '20' + year;
    const d = new Date(`${dashMatch[2]} ${dashMatch[1]}, ${year}`);
    if (!isNaN(d.getTime())) return d;
  }

  // Format 2: May 1 2025
  const wordMatch = clean.match(/^([A-Za-z]{3,})\s+(\d{1,2})\s+(\d{2,4})$/);
  if (wordMatch) {
    let year = wordMatch[3];
    if (year.length === 2) year = '20' + year;
    const d = new Date(`${wordMatch[1]} ${wordMatch[2]}, ${year}`);
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback
  const d = new Date(clean);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDateShort(raw: string): string {
  const d = parseImportDate(raw);
  if (!d) return String(raw);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

const fmtK = (n: number) => n >= 1000 ? `₱${(n / 1000).toFixed(1)}k` : `₱${n}`

interface Sale {
  _key: string; date: string; service: string; therapist: string;
  client: string; revenue: number; category: string; payMethod: string;
  isLive: boolean; status: string;
}

// --- UNIFIED FETCH (LIVE + HISTORY) ---
async function fetchUnifiedData(supabase: any): Promise<Sale[]> {
  const all: Sale[] = []

  // 1. Fetch Live Bookings
  const { data: liveData } = await supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(500)
  if (liveData) {
    liveData.forEach((r: any) => {
      all.push({
        _key: `live-${r.id}`,
        date: r.created_at || new Date().toISOString(),
        client: r.client_name || 'Guest',
        service: r.service_name || r.service || '—',
        therapist: r.therapist_name || r.therapist || '—',
        revenue: Number(r.price || r.received_payment || 0),
        category: r.category || 'Live Booking',
        payMethod: r.payment_method || '—',
        isLive: true,
        status: r.status || 'Pending'
      })
    })
  }

  // 2. Fetch Historical Import (Paginated)
  let from = 0; const PAGE = 1000;
  for (; ;) {
    const { data } = await supabase.from('bookings_import').select('date,client_name,service,therapist,received_payment,category,payment_method').range(from, from + PAGE - 1)
    if (!data || data.length === 0) break
    data.forEach((r: any, i: number) => {
      all.push({
        _key: `hist-${from + i}`,
        date: String(r.date || ''),
        client: String(r.client_name || 'Guest'),
        service: String(r.service || '—'),
        therapist: String(r.therapist || '—'),
        revenue: Number(r.received_payment || 0),
        category: String(r.category || '—'),
        payMethod: String(r.payment_method || '—'),
        isLive: false,
        status: 'Completed'
      })
    })
    if (data.length < PAGE) break; from += PAGE;
  }

  // Sort universally
  return all.sort((a, b) => (parseImportDate(b.date)?.getTime() || 0) - (parseImportDate(a.date)?.getTime() || 0))
}

export default function OverviewPage() {
  const supabase = useRef(createClient()).current
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'daily' | 'all'>('daily') // Defaults to Daily!
  const [selectedDate, setSelectedDate] = useState(todayISO())

  const loadData = useCallback(async () => {
    setLoading(true)
    const data = await fetchUnifiedData(supabase)
    setSales(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // Filter based on mode
  const displaySales = mode === 'all'
    ? sales.slice(0, 500)
    : sales.filter(s => {
      const d = parseImportDate(s.date);
      return d && d.toISOString().split('T')[0] === selectedDate;
    })

  const totalRev = displaySales.reduce((a, s) => a + s.revenue, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Dashboard</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 32, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Overview</h2>
        </div>
        <button onClick={loadData} style={{ padding: '0 16px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>
          {loading ? 'Syncing...' : 'Refresh Live Data'}
        </button>
      </div>

      {/* View Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', borderRadius: 9, border: '1px solid rgba(26,26,26,0.14)', overflow: 'hidden' }}>
          <button onClick={() => setMode('daily')} style={{ padding: '0 18px', height: 36, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', backgroundColor: mode === 'daily' ? '#1A1A1A' : 'transparent', color: mode === 'daily' ? '#C58F3B' : '#666' }}>Daily View</button>
          <button onClick={() => setMode('all')} style={{ padding: '0 18px', height: 36, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', backgroundColor: mode === 'all' ? '#1A1A1A' : 'transparent', color: mode === 'all' ? '#C58F3B' : '#666' }}>All Time</button>
        </div>
        {mode === 'daily' && <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ height: 36, padding: '0 12px', border: '1px solid #ccc', borderRadius: 8 }} />}
      </div>

      {/* KPI */}
      <div style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(197,143,59,0.20)', borderRadius: 16, padding: '20px', maxWidth: 300 }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(243,233,224,0.50)', margin: '0 0 8px' }}>{mode === 'daily' ? 'Revenue (Selected Day)' : 'Total Revenue (All Time)'}</p>
        <p style={{ fontSize: 28, fontWeight: 700, color: '#F3E9E0', margin: 0 }}>₱{totalRev.toLocaleString()}</p>
        <p style={{ fontSize: 12, color: 'rgba(243,233,224,0.38)', margin: '4px 0 0' }}>{displaySales.length} sessions tracked</p>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: 'rgba(197,143,59,0.07)', borderRadius: 12 }}>Syncing live bookings and history...</div>
      ) : (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)', backgroundColor: '#F8F4EE' }}>
                  {['Date', 'Status', 'Client', 'Service', 'Therapist', 'Revenue'].map(h => <th key={h} style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#C58F3B' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {displaySales.map((s, i) => (
                  <tr key={s._key} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                    <td style={{ padding: '12px 16px', color: '#666' }}>{fmtDateShort(s.date)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', backgroundColor: s.isLive ? 'rgba(61,122,74,0.1)' : 'rgba(197,143,59,0.1)', color: s.isLive ? '#3D7A4A' : '#C58F3B' }}>{s.status}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1A1A1A' }}>{s.client}</td>
                    <td style={{ padding: '12px 16px', color: '#2A2A2A' }}>{s.service}</td>
                    <td style={{ padding: '12px 16px', color: '#4A4A4A' }}>{s.therapist}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1A1A1A' }}>₱{s.revenue.toLocaleString()}</td>
                  </tr>
                ))}
                {displaySales.length === 0 && <tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#666' }}>No bookings for this view.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}