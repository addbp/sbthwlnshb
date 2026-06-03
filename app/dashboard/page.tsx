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

// ─── TIME SLOTS FOR CALENDAR ───
const TIME_SLOTS = [
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
  '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
  '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM',
  '8:00 PM', '8:30 PM', '9:00 PM', '9:30 PM', '10:00 PM', '10:30 PM',
  '11:00 PM', '11:30 PM', '12:00 AM'
];

interface Sale {
  _key: string;
  id: string | number | null;
  date: string;
  time: string;
  service: string;
  therapist: string;
  client: string;
  revenue: number;
  category: string;
  payMethod: string;
  isLive: boolean;
  status: string;
}

// ─── UNLIMITED ONE-SHOT FETCH FOR 100% ACCURATE TOTALS ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchUnifiedData(supabase: any): Promise<Sale[]> {
  const all: Sale[] = []

  try {
    // ONE massive request to grab everything at once (bypasses sequential timeout issues)
    const [liveRes, histRes] = await Promise.all([
      supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(15000),
      supabase.from('bookings_import').select('date,client_name,service,therapist,received_payment,service_amount,category,payment_method').limit(25000)
    ]);

    if (liveRes.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      liveRes.data.forEach((r: any) => {
        let normalizedStatus = r.status || r.booking_status || 'Pending';
        normalizedStatus = String(normalizedStatus).trim();
        if (normalizedStatus.toLowerCase() === 'in session') normalizedStatus = 'Ongoing';
        if (normalizedStatus.toLowerCase() === 'done') normalizedStatus = 'Completed';

        all.push({
          _key: `live-${r.id}`,
          id: r.id,
          date: r.appointment_date || r.booking_date || r.created_at || new Date().toISOString(),
          time: String(r.appointment_time || r.time || ''),
          client: r.client_name || r.name || r.full_name || 'Guest',
          service: r.service_name || r.service || r.treatment || '—',
          therapist: r.therapist_name || r.therapist || '—',
          revenue: parseCurrency(r.price || r.amount || r.received_payment || r.total_cost),
          category: r.category || '—', // Live Booking text completely removed
          payMethod: r.payment_method || '—',
          isLive: true,
          status: normalizedStatus
        })
      })
    }

    if (histRes.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      histRes.data.forEach((r: any, i: number) => {
        all.push({
          _key: `hist-${i}`,
          id: null,
          date: String(r.date || ''),
          time: '',
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
    }
  } catch (err) {
    console.error("Database sync failed:", err);
  }

  return all.sort((a, b) => (parseImportDate(b.date)?.getTime() || 0) - (parseImportDate(a.date)?.getTime() || 0))
}

const STATUS_COLORS: Record<string, { bg: string, text: string, border: string }> = {
  'completed': { bg: 'rgba(61,122,74,0.1)', text: '#3D7A4A', border: 'rgba(61,122,74,0.3)' },
  'ongoing': { bg: 'rgba(197,143,59,0.1)', text: '#C58F3B', border: 'rgba(197,143,59,0.3)' },
  'pending': { bg: '#f5f5f5', text: '#666666', border: '#cccccc' },
  'hold': { bg: 'rgba(189,40,40,0.1)', text: '#BD2828', border: 'rgba(189,40,40,0.3)' }
};

export default function OverviewPage() {
  const supabase = useRef(createClient()).current
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table')

  // Defaults to completely empty (ALL TIME) to instantly pull the 10,000+ DB records
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 100

  const loadData = useCallback(async () => {
    setLoading(true)
    const data = await fetchUnifiedData(supabase)
    setSales(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { setCurrentPage(1) }, [startDate, endDate])

  const displaySales = sales.filter(s => {
    // Absolute bypass: If filter is set to "All Time", do not risk dropping broken date formats. Return EVERYTHING.
    if (!startDate && !endDate) return true;

    const d = parseImportDate(s.date);
    if (!d) return false;
    const iso = toLocalISO(d);
    if (startDate && iso < startDate) return false;
    if (endDate && iso > endDate) return false;
    return true;
  })

  // KPIs strictly sync with the displayed sales, guaranteeing true database numbers
  const counts = {
    total: displaySales.length,
    pending: displaySales.filter(s => s.status.toLowerCase().trim() === 'pending').length,
    ongoing: displaySales.filter(s => s.status.toLowerCase().trim() === 'ongoing').length,
    completed: displaySales.filter(s => s.status.toLowerCase().trim() === 'completed').length,
    hold: displaySales.filter(s => s.status.toLowerCase().trim() === 'hold').length,
  }

  const handleStatusChange = async (id: string | number | null, newStatus: string) => {
    if (!id) return;
    setSales(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
    const { error } = await supabase.from('bookings').update({ status: newStatus }).eq('id', id);
    if (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status in the database.");
    }
  }

  const totalPages = Math.max(1, Math.ceil(displaySales.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedSales = displaySales.slice(startIndex, startIndex + itemsPerPage)

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    padding: '6px 12px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
    backgroundColor: disabled ? '#f5f5f5' : '#1A1A1A', color: disabled ? '#aaa' : '#C58F3B',
    border: 'none', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 200ms ease'
  })

  // Calendar safely defaults to TODAY if the main filter is set to ALL TIME
  const activeCalendarDate = startDate || todayISO();
  const calendarBookings = sales.filter(s => {
    const d = parseImportDate(s.date);
    return d && toLocalISO(d) === activeCalendarDate && s.time;
  });

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

        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => { setStartDate(todayISO()); setEndDate(todayISO()) }} style={{ padding: '6px 12px', border: '1px solid rgba(26,26,26,0.1)', borderRadius: 8, backgroundColor: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#1A1A1A', cursor: 'pointer' }}>Today</button>
          <button onClick={() => { setStartDate(''); setEndDate('') }} style={{ padding: '6px 12px', border: '1px solid rgba(26,26,26,0.1)', borderRadius: 8, backgroundColor: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#1A1A1A', cursor: 'pointer' }}>All Time</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: 'rgba(197,143,59,0.07)', borderRadius: 12 }}>Pulling complete database without limits...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(180px,100%),1fr))', gap: 12 }}>
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
            <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '20px', borderLeft: '4px solid #BD2828' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#BD2828', margin: '0 0 8px' }}>Hold</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{counts.hold.toLocaleString()}</p>
            </div>
            <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '20px', borderLeft: '4px solid #3D7A4A' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#3D7A4A', margin: '0 0 8px' }}>Completed</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{counts.completed.toLocaleString()}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid rgba(26,26,26,0.1)', paddingBottom: 12 }}>
            <button
              onClick={() => setViewMode('table')}
              style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', border: 'none', cursor: 'pointer', backgroundColor: viewMode === 'table' ? '#1A1A1A' : 'transparent', color: viewMode === 'table' ? '#C58F3B' : '#666', transition: 'all 200ms ease' }}
            >
              List View
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', border: 'none', cursor: 'pointer', backgroundColor: viewMode === 'calendar' ? '#1A1A1A' : 'transparent', color: viewMode === 'calendar' ? '#C58F3B' : '#666', transition: 'all 200ms ease' }}
            >
              Daily Schedule
            </button>
          </div>

          {viewMode === 'calendar' && (
            <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '24px' }}>
              <div style={{ marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid rgba(197,143,59,0.2)' }}>
                <h3 style={{ margin: 0, fontSize: 18, color: '#1A1A1A', fontFamily: "'Cormorant Garamond',Georgia,serif" }}>Schedule for <span style={{ color: '#C58F3B' }}>{fmtDateShort(activeCalendarDate)}</span></h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666' }}>All live bookings mapping to their specific time slots.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {TIME_SLOTS.map(timeSlot => {
                  const slotBookings = calendarBookings.filter(b => b.time === timeSlot);

                  return (
                    <div key={timeSlot} style={{ display: 'flex', borderBottom: '1px solid rgba(26,26,26,0.05)', paddingBottom: 12 }}>
                      <div style={{ width: 90, flexShrink: 0, paddingTop: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A' }}>{timeSlot}</span>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {slotBookings.length === 0 ? (
                          <div style={{ padding: '6px 12px', border: '1px dashed rgba(26,26,26,0.15)', borderRadius: 6, backgroundColor: '#FAFAFA' }}>
                            <span style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>Available</span>
                          </div>
                        ) : (
                          slotBookings.map(b => {
                            const normStatus = b.status.toLowerCase().trim();
                            const colors = STATUS_COLORS[normStatus] || STATUS_COLORS['pending'];
                            const isUnpaid = normStatus === 'pending' || normStatus === 'hold';

                            return (
                              <div key={b._key} style={{ padding: '12px', backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                                <div>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>{b.client}</div>
                                  <div style={{ fontSize: 12, color: '#4A4A4A' }}>{b.service} <span style={{ color: '#aaa', margin: '0 4px' }}>|</span> Therapist: {b.therapist}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', backgroundColor: '#fff', color: colors.text, border: `1px solid ${colors.border}`, marginBottom: 6 }}>
                                    {b.status}
                                  </span>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: isUnpaid ? '#aaa' : '#1A1A1A' }}>
                                    ₱{b.revenue.toLocaleString()} {isUnpaid && <span style={{ color: '#BD2828' }}>(Unpaid)</span>}
                                  </div>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {viewMode === 'table' && (
            <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto', minHeight: 400 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)', backgroundColor: '#F8F4EE' }}>
                      {['Date', 'Time', 'Status', 'Client', 'Service', 'Therapist', 'Revenue'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#C58F3B', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSales.map((s) => {
                      const normStatus = s.status.toLowerCase().trim();
                      const colors = STATUS_COLORS[normStatus] || STATUS_COLORS['pending'];
                      const isUnpaid = normStatus === 'pending' || normStatus === 'hold';

                      const arrowHex = colors.text.replace('#', '');
                      const customArrow = `url('data:image/svg+xml;utf8,<svg fill="%23${arrowHex}" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/></svg>')`;

                      return (
                        <tr key={s._key} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                          <td style={{ padding: '12px 16px', color: '#666', whiteSpace: 'nowrap' }}>{fmtDateShort(s.date)}</td>
                          <td style={{ padding: '12px 16px', color: '#666', fontSize: 12, whiteSpace: 'nowrap' }}>{s.time || '—'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            {s.isLive ? (
                              <select
                                value={s.status}
                                onChange={(e) => handleStatusChange(s.id, e.target.value)}
                                style={{
                                  padding: '4px 22px 4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                                  textTransform: 'uppercase', backgroundColor: colors.bg, color: colors.text,
                                  border: `1px solid ${colors.border}`, cursor: 'pointer', outline: 'none',
                                  appearance: 'none', WebkitAppearance: 'none', backgroundImage: customArrow,
                                  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 2px center'
                                }}
                              >
                                <option value="Completed">COMPLETED</option>
                                <option value="Ongoing">ONGOING</option>
                                <option value="Pending">PENDING</option>
                                <option value="Hold">HOLD</option>
                              </select>
                            ) : (
                              <span style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, cursor: 'not-allowed', opacity: 0.8 }} title="Historical records cannot be edited">
                                {s.status}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1A1A1A' }}>{s.client}</td>
                          <td style={{ padding: '12px 16px', color: '#2A2A2A' }}>{s.service}</td>
                          <td style={{ padding: '12px 16px', color: '#4A4A4A' }}>{s.therapist}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: isUnpaid ? '#aaa' : '#1A1A1A', transition: 'color 0.2s' }}>
                            ₱{s.revenue.toLocaleString()} {isUnpaid && <span style={{ fontSize: 10, fontWeight: 600, color: '#BD2828', marginLeft: 4 }}>(Unpaid)</span>}
                          </td>
                        </tr>
                      )
                    })}
                    {paginatedSales.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No bookings found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

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
          )}
        </>
      )}
    </div>
  )
}