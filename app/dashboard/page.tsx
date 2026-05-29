'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── ABSOLUTE BULLETPROOF CURRENCY PARSER ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  _key: string;
  date: string;
  service: string;
  therapist: string;
  client: string;
  revenue: number;
  category: string;
  payMethod: string;
  isLive: boolean;
  status: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchUnifiedData(supabase: any): Promise<Sale[]> {
  const all: Sale[] = []

  // 1. Fetch Live Operations Data
  const { data: liveData } = await supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(1000)
  if (liveData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    liveData.forEach((r: any) => {
      all.push({
        _key: `live-${r.id}`,
        date: r.appointment_date || r.created_at || new Date().toISOString(),
        client: r.client_name || 'Guest',
        service: r.service_name || r.service || '—',
        therapist: r.therapist_name || r.therapist || '—',
        revenue: parseCurrency(r.price || r.amount || r.received_payment),
        category: r.category || 'Live Booking',
        payMethod: r.payment_method || '—',
        isLive: true,
        status: r.status || 'Pending'
      })
    })
  }

  // 2. Fetch Historical Data (Pulls ALL 10,000+ records)
  let from = 0; const PAGE = 1000;
  for (; ;) {
    const { data } = await supabase
      .from('bookings_import')
      .select('date,client_name,service,therapist,received_payment,service_amount,category,payment_method')
      .range(from, from + PAGE - 1)

    if (!data || data.length === 0) break
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data.forEach((r: any, i: number) => {
      all.push({
        _key: `hist-${from + i}`,
        date: String(r.date || ''),
        client: String(r.client_name || 'Guest'),
        service: String(r.service || '—'),
        therapist: String(r.therapist || '—'),
        revenue: parseCurrency(r.received_payment || r.service_amount),
        category: String(r.category || '—'),
        payMethod: String(r.payment_method || '—'),
        isLive: false,
        status: 'Completed'
      })
    })
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return all.sort((a, b) => (parseImportDate(b.date)?.getTime() || 0) - (parseImportDate(a.date)?.getTime() || 0))
}

export default function OverviewPage() {
  const supabase = useRef(createClient()).current
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  // Date Range Filter States
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState(todayISO())

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 100

  const loadData = useCallback(async () => {
    setLoading(true)
    const data = await fetchUnifiedData(supabase)
    setSales(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // Reset page to 1 when dates change
  useEffect(() => { setCurrentPage(1) }, [startDate, endDate])

  // Apply Date Range Filter safely
  const displaySales = sales.filter(s => {
    const d = parseImportDate(s.date);
    if (!d) return false;
    const iso = toLocalISO(d);

    if (startDate && iso < startDate) return false;
    if (endDate && iso > endDate) return false;

    return true;
  })

  // KPIs calculated from the FULL filtered dataset (No Total Revenue)
  const counts = {
    total: displaySales.length,
    pending: displaySales.filter(s => s.status.toLowerCase() === 'pending').length,
    ongoing: displaySales.filter(s => s.status.toLowerCase() === 'ongoing' || s.status.toLowerCase() === 'in session').length,
    completed: displaySales.filter(s => s.status.toLowerCase() === 'completed').length,
  }

  // Pagination Logic for the Table
  const totalPages = Math.max(1, Math.ceil(displaySales.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedSales = displaySales.slice(startIndex, startIndex + itemsPerPage)

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    backgroundColor: disabled ? '#f5f5f5' : '#1A1A1A',
    color: disabled ? '#aaa' : '#C58F3B',
    border: 'none',
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'opacity 200ms ease'
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* ─── HEADER ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Operations</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 32, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Dashboard Overview</h2>
        </div>
        <button onClick={loadData} style={{ padding: '0 16px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>
          {loading ? 'Syncing...' : 'Refresh Live Data'}
        </button>
      </div>

      {/* ─── DATE FILTERS ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.16)', borderRadius: 10, padding: '4px 8px' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>From</span>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: 13, color: '#1A1A1A', backgroundColor: 'transparent', cursor: 'pointer' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase', borderLeft: '1px solid #ddd', paddingLeft: 8 }}>To</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: 13, color: '#1A1A1A', backgroundColor: 'transparent', cursor: 'pointer' }} />
          {(startDate || endDate) && (
            <button onClick={() => { setStartDate(''); setEndDate('') }} style={{ background: 'none', border: 'none', color: '#8B3A3A', fontSize: 18, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }} title="Clear Filter">&times;</button>
          )}
        </div>

        {/* Quick Filter Buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => { setStartDate(todayISO()); setEndDate(todayISO()) }} style={{ padding: '6px 12px', border: '1px solid rgba(26,26,26,0.1)', borderRadius: 8, backgroundColor: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#1A1A1A', cursor: 'pointer' }}>
            Today
          </button>
          <button onClick={() => { setStartDate(''); setEndDate('') }} style={{ padding: '6px 12px', border: '1px solid rgba(26,26,26,0.1)', borderRadius: 8, backgroundColor: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#1A1A1A', cursor: 'pointer' }}>
            All Time
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: 'rgba(197,143,59,0.07)', borderRadius: 12 }}>Aggregating 10,000+ records for operations dashboard...</div>
      ) : (
        <>
          {/* ─── KPIs (Total Revenue Removed) ─── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(200px,100%),1fr))', gap: 12 }}>
            <div style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(197,143,59,0.20)', borderRadius: 14, padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(243,233,224,0.50)', margin: '0 0 8px' }}>Total Bookings</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#F3E9E0', margin: 0 }}>{counts.total.toLocaleString()}</p>
            </div>
            <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '20px', borderLeft: '4px solid #888' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#888', margin: '0 0 8px' }}>Pending</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{counts.pending.toLocaleString()}</p>
            </div>
            <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '20px', borderLeft: '4px solid #C58F3B' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 8px' }}>Ongoing</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{counts.ongoing.toLocaleString()}</p>
            </div>
            <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '20px', borderLeft: '4px solid #3D7A4A' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#3D7A4A', margin: '0 0 8px' }}>Completed</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{counts.completed.toLocaleString()}</p>
            </div>
          </div>

          {/* ─── DATA TABLE WITH PAGINATION ─── */}
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', minHeight: 400 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)', backgroundColor: '#F8F4EE' }}>
                    {['Date', 'Status', 'Client', 'Service', 'Therapist', 'Revenue'].map(h => <th key={h} style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#C58F3B', whiteSpace: 'nowrap' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {paginatedSales.map((s) => (
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
                  {paginatedSales.length === 0 && <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No bookings found for the selected date range.</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{ padding: '16px 20px', backgroundColor: '#FDFCF8', borderTop: '1px solid rgba(26,26,26,0.09)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <span style={{ fontSize: 13, color: '#666' }}>
                Showing <strong style={{ color: '#1A1A1A' }}>{displaySales.length > 0 ? startIndex + 1 : 0}</strong> to <strong style={{ color: '#1A1A1A' }}>{Math.min(startIndex + itemsPerPage, displaySales.length)}</strong> of <strong style={{ color: '#C58F3B' }}>{displaySales.length.toLocaleString()}</strong> entries
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button style={btnStyle(currentPage === 1)} onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>First</button>
                <button style={btnStyle(currentPage === 1)} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>Prev</button>
                <span style={{ padding: '0 10px', fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>Page {currentPage} of {totalPages}</span>
                <button style={btnStyle(currentPage === totalPages)} onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>Next</button>
                <button style={btnStyle(currentPage === totalPages)} onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>Last</button>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  )
}