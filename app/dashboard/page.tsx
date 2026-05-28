'use client'
export const dynamic = 'force-dynamic'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── ABSOLUTE BULLETPROOF CURRENCY PARSER ───
// This guarantees it will NEVER return NaN, even if the database has weird text.
function parseCurrency(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

// ─── INDESTRUCTIBLE DATE PARSER ───
function parseImportDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  let clean = String(raw).trim();

  const dashMatch = clean.match(/^(\d{1,2})[-\s/]+([A-Za-z]{3,})[-\s/]+(\d{2,4})$/);
  if (dashMatch) {
    let year = dashMatch[3];
    if (year.length === 2) year = '20' + year;
    clean = `${dashMatch[2]} ${dashMatch[1]}, ${year}`;
  }

  let d = new Date(clean);
  if (!isNaN(d.getTime())) {
    // Force to NOON to prevent timezone shifting
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  }
  return null;
}

function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayISO(): string {
  return toLocalISO(new Date());
}

// ─── STRICT DATE FORMATTER ───
function formatDateToDDMMMYY(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dd = String(d.getDate()).padStart(2, '0');
  const mmm = months[d.getMonth()];
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}-${mmm}-${yy}`;
}

function fmtDateShort(raw: string): string {
  const d = parseImportDate(raw);
  if (!d) return String(raw);
  return formatDateToDDMMMYY(d);
}

interface Sale {
  _key: string; date: string; service: string; therapist: string;
  client: string; revenue: number; category: string; payMethod: string;
  isLive: boolean; status: string;
}

async function fetchUnifiedData(supabase: any): Promise<Sale[]> {
  const all: Sale[] = []

  // 1. Fetch Live Operations Data
  const { data: liveData } = await supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(1000)
  if (liveData) {
    liveData.forEach((r: any) => {
      all.push({
        _key: `live-${r.id}`,
        // Use appointment_date if available, otherwise created_at
        date: r.appointment_date || r.created_at || new Date().toISOString(),
        client: r.client_name || 'Guest',
        service: r.service_name || r.service || '—',
        therapist: r.therapist_name || r.therapist || '—',
        // Checks all possible live revenue columns
        revenue: parseCurrency(r.price || r.amount || r.received_payment),
        category: r.category || 'Live Booking',
        payMethod: r.payment_method || '—',
        isLive: true,
        status: r.status || 'Pending'
      })
    })
  }

  // 2. Fetch Historical Data
  let from = 0; const PAGE = 1000;
  for (; ;) {
    const { data } = await supabase.from('bookings_import').select('date,client_name,service,therapist,received_payment,service_amount,category,payment_method').range(from, from + PAGE - 1)
    if (!data || data.length === 0) break
    data.forEach((r: any, i: number) => {
      all.push({
        _key: `hist-${from + i}`,
        date: String(r.date || ''),
        client: String(r.client_name || 'Guest'),
        service: String(r.service || '—'),
        therapist: String(r.therapist || '—'),
        // Checks all possible historical revenue columns
        revenue: parseCurrency(r.received_payment || r.service_amount),
        category: String(r.category || '—'),
        payMethod: String(r.payment_method || '—'),
        isLive: false,
        status: 'Completed'
      })
    })
    if (data.length < PAGE) break; from += PAGE;
  }

  // Sort universally from newest to oldest
  return all.sort((a, b) => (parseImportDate(b.date)?.getTime() || 0) - (parseImportDate(a.date)?.getTime() || 0))
}

export default function OverviewPage() {
  const supabase = useRef(createClient()).current
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'daily' | 'all'>('daily')
  const [selectedDate, setSelectedDate] = useState(todayISO())

  const loadData = useCallback(async () => {
    setLoading(true)
    const data = await fetchUnifiedData(supabase)
    setSales(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const displaySales = mode === 'all'
    ? sales.slice(0, 500)
    : sales.filter(s => {
      const d = parseImportDate(s.date);
      if (!d) return false;
      return toLocalISO(d) === selectedDate;
    })

  const totalRev = displaySales.reduce((a, s) => a + s.revenue, 0)

  const counts = {
    total: displaySales.length,
    pending: displaySales.filter(s => s.status.toLowerCase() === 'pending').length,
    ongoing: displaySales.filter(s => s.status.toLowerCase() === 'ongoing' || s.status.toLowerCase() === 'in session').length,
    completed: displaySales.filter(s => s.status.toLowerCase() === 'completed').length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Inter',system-ui,sans-serif" }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Operations</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 32, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Dashboard Overview</h2>
        </div>
        <button onClick={loadData} style={{ padding: '0 16px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>
          {loading ? 'Syncing...' : 'Refresh Live Data'}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', borderRadius: 9, border: '1px solid rgba(26,26,26,0.14)', overflow: 'hidden' }}>
          <button onClick={() => setMode('daily')} style={{ padding: '0 18px', height: 36, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', backgroundColor: mode === 'daily' ? '#1A1A1A' : 'transparent', color: mode === 'daily' ? '#C58F3B' : '#666' }}>Daily View</button>
          <button onClick={() => setMode('all')} style={{ padding: '0 18px', height: 36, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', backgroundColor: mode === 'all' ? '#1A1A1A' : 'transparent', color: mode === 'all' ? '#C58F3B' : '#666' }}>All Time History</button>
        </div>
        {mode === 'daily' && (
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ height: 36, padding: '0 12px', border: '1px solid #ddd', borderRadius: 8, outline: 'none', cursor: 'pointer' }} />
        )}
      </div>

      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: 'rgba(197,143,59,0.07)', borderRadius: 12 }}>Loading operations data...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(200px,100%),1fr))', gap: 12 }}>
            <div style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(197,143,59,0.20)', borderRadius: 14, padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(243,233,224,0.50)', margin: '0 0 8px' }}>Total Revenue</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#F3E9E0', margin: 0 }}>₱{totalRev.toLocaleString()}</p>
            </div>
            <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '20px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 8px' }}>Total Bookings</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{counts.total}</p>
            </div>
            <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '20px', borderLeft: '4px solid #888' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#888', margin: '0 0 8px' }}>Pending</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{counts.pending}</p>
            </div>
            <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '20px', borderLeft: '4px solid #C58F3B' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 8px' }}>Ongoing</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{counts.ongoing}</p>
            </div>
            <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '20px', borderLeft: '4px solid #3D7A4A' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#3D7A4A', margin: '0 0 8px' }}>Completed</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{counts.completed}</p>
            </div>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)', backgroundColor: '#F8F4EE' }}>
                    {['Date', 'Status', 'Client', 'Service', 'Therapist', 'Revenue'].map(h => <th key={h} style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#C58F3B', whiteSpace: 'nowrap' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {displaySales.map((s) => (
                    <tr key={s._key} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                      <td style={{ padding: '12px 16px', color: '#666', whiteSpace: 'nowrap' }}>{fmtDateShort(s.date)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                          backgroundColor: s.status.toLowerCase() === 'completed' ? 'rgba(61,122,74,0.1)' : s.status.toLowerCase() === 'ongoing' ? 'rgba(197,143,59,0.1)' : '#f5f5f5',
                          color: s.status.toLowerCase() === 'completed' ? '#3D7A4A' : s.status.toLowerCase() === 'ongoing' ? '#C58F3B' : '#666'
                        }}>
                          {s.status}
                        </span>
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
        </>
      )}
    </div>
  )
}