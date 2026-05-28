'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── SAFE CURRENCY PARSER ───
function parseCurrency(val: any): number {
  if (!val) return 0;
  return Number(String(val).replace(/[^0-9.-]+/g, '')) || 0;
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

// ─── STRICT DATE FORMATTER ───
function formatDateToDDMMMYY(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dd = String(d.getDate()).padStart(2, '0');
  const mmm = months[d.getMonth()];
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}-${mmm}-${yy}`;
}

interface Booking {
  _key: string;
  date: string;
  client: string;
  service: string;
  therapist: string;
  revenue: number;
  category: string;
  payMethod: string;
  customerType: string;
  parsedDate: Date | null;
}

export default function BookingsPage() {
  const supabase = useRef(createClient()).current
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 100

  const loadBookings = useCallback(async () => {
    setLoading(true)
    const PAGE = 1000
    const all: Booking[] = []

    // ─── 1. FETCH LIVE BOOKINGS CONTINUOUSLY (NO LIMIT) ───
    let liveFrom = 0
    for (; ;) {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, appointment_date, created_at, client_name, service_name, service, therapist_name, therapist, price, amount, received_payment, category, payment_method')
        .range(liveFrom, liveFrom + PAGE - 1)

      if (error || !data || data.length === 0) break

      data.forEach(r => {
        all.push({
          _key: `live-${r.id}-${liveFrom}`,
          date: String(r.appointment_date || r.created_at || ''),
          parsedDate: parseImportDate(r.appointment_date || r.created_at),
          client: String(r.client_name || 'Guest'),
          service: String(r.service_name || r.service || '—'),
          therapist: String(r.therapist_name || r.therapist || '—'),
          revenue: parseCurrency(r.price || r.amount || r.received_payment),
          category: String(r.category || 'Live Booking'),
          payMethod: String(r.payment_method || '—').toUpperCase(),
          customerType: '—'
        })
      })
      if (data.length < PAGE) break
      liveFrom += PAGE
    }

    // ─── 2. FETCH HISTORICAL BOOKINGS CONTINUOUSLY (NO LIMIT) ───
    let histFrom = 0
    for (; ;) {
      const { data, error } = await supabase
        .from('bookings_import')
        .select('date, client_name, service, therapist, received_payment, service_amount, category, payment_method')
        .range(histFrom, histFrom + PAGE - 1)

      if (error || !data || data.length === 0) break

      data.forEach((r, i) => {
        all.push({
          _key: `hist-${histFrom}-${i}`,
          date: String(r.date || ''),
          parsedDate: parseImportDate(r.date),
          client: String(r.client_name || 'Guest'),
          service: String(r.service || '—'),
          therapist: String(r.therapist || '—'),
          revenue: parseCurrency(r.received_payment || r.service_amount),
          category: String(r.category || '—'),
          payMethod: String(r.payment_method || '—').toUpperCase(),
          customerType: '—'
        })
      })
      if (data.length < PAGE) break
      histFrom += PAGE
    }

    // ─── 3. TIMELINE SCANNER (CALCULATES NEW VS RETURNING ACCURATELY) ───
    all.sort((a, b) => (a.parsedDate?.getTime() || 0) - (b.parsedDate?.getTime() || 0)) // Oldest to Newest

    const visitCounter = new Map<string, number>()
    all.forEach(p => {
      const nameKey = p.client.toLowerCase().trim()
      if (!nameKey || nameKey === 'guest' || nameKey === '—') {
        p.customerType = 'WALK-IN'
        return
      }
      const visits = visitCounter.get(nameKey) || 0
      if (visits === 0) {
        p.customerType = 'NEW CLIENT'
      } else {
        p.customerType = 'RETURNING CLIENT'
      }
      visitCounter.set(nameKey, visits + 1)
    })

    // ─── 4. SORT NEWEST TO OLDEST FOR DASHBOARD ───
    all.sort((a, b) => (b.parsedDate?.getTime() || 0) - (a.parsedDate?.getTime() || 0))

    setBookings(all)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadBookings() }, [loadBookings])

  // Reset to page 1 whenever they search or filter
  useEffect(() => {
    setCurrentPage(1)
  }, [search, categoryFilter])

  const uniqueCategories = ['All', ...Array.from(new Set(bookings.map(b => b.category).filter(Boolean)))]

  // Apply Search & Filters
  const filtered = bookings.filter(b => {
    const matchesSearch = search === '' || b.client.toLowerCase().includes(search.toLowerCase()) || b.service.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || b.category === categoryFilter;
    return matchesSearch && matchesCategory;
  })

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedBookings = filtered.slice(startIndex, startIndex + itemsPerPage)

  // Button Style for Pagination
  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    padding: '6px 12px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
    backgroundColor: disabled ? '#f5f5f5' : '#1A1A1A', color: disabled ? '#aaa' : '#C58F3B',
    border: 'none', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'opacity 200ms ease'
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Inter',system-ui,sans-serif" }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Reservations</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 32, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>All Bookings</h2>
        </div>
        <button onClick={loadBookings} style={{ padding: '0 16px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', cursor: 'pointer' }}>
          {loading ? 'Loading...' : 'Refresh Data'}
        </button>
      </div>

      {/* ─── FILTERS AND SEARCH ─── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {uniqueCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid',
                backgroundColor: categoryFilter === cat ? '#1A1A1A' : '#fff',
                color: categoryFilter === cat ? '#C58F3B' : '#666',
                borderColor: categoryFilter === cat ? '#1A1A1A' : '#ddd',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600
              }}
            >
              {cat}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search client or service..."
          style={{
            height: 40, width: '100%', maxWidth: 300, padding: '0 14px',
            border: '1px solid rgba(26,26,26,0.16)', borderRadius: 8,
            fontSize: 14, outline: 'none'
          }}
        />
      </div>

      {loading ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16 }}>
          Syncing continuous live and historical data...
        </div>
      ) : (
        <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ overflowX: 'auto', minHeight: 400 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)', backgroundColor: '#F8F4EE' }}>
                  {['Date', 'Client', 'Service', 'Therapist', 'Category', 'Amount', 'Payment Method', 'Client Type'].map(h => (
                    <th key={h} style={{ padding: '14px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C58F3B', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedBookings.map((b) => (
                  <tr key={b._key} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                    <td style={{ padding: '14px 16px', color: '#666', whiteSpace: 'nowrap' }}>{formatDateToDDMMMYY(b.parsedDate)}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: '#1A1A1A' }}>{b.client}</td>
                    <td style={{ padding: '14px 16px', color: '#2A2A2A' }}>{b.service}</td>
                    <td style={{ padding: '14px 16px', color: '#4A4A4A' }}>{b.therapist}</td>
                    <td style={{ padding: '14px 16px', color: '#666' }}>
                      <span style={{ padding: '4px 8px', borderRadius: 4, backgroundColor: '#f5f5f5', fontSize: 11 }}>{b.category}</span>
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1A1A1A' }}>₱{b.revenue.toLocaleString()}</td>
                    <td style={{ padding: '14px 16px', color: '#666', fontWeight: 600 }}>{b.payMethod}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                        backgroundColor: b.customerType === 'NEW CLIENT' ? 'rgba(61,122,74,0.1)' : 'rgba(197,143,59,0.1)',
                        color: b.customerType === 'NEW CLIENT' ? '#3D7A4A' : '#C58F3B'
                      }}>
                        {b.customerType}
                      </span>
                    </td>
                  </tr>
                ))}
                {paginatedBookings.length === 0 && <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No records match your search.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* ─── PAGINATION BAR (FIXED) ─── */}
          <div style={{ padding: '16px 20px', backgroundColor: '#FDFCF8', borderTop: '1px solid rgba(26,26,26,0.09)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <span style={{ fontSize: 13, color: '#666' }}>
              Showing <strong style={{ color: '#1A1A1A' }}>{filtered.length > 0 ? startIndex + 1 : 0}</strong> to <strong style={{ color: '#1A1A1A' }}>{Math.min(startIndex + itemsPerPage, filtered.length)}</strong> of <strong style={{ color: '#C58F3B' }}>{filtered.length.toLocaleString()}</strong> entries
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button style={btnStyle(currentPage === 1)} onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>First</button>
              <button style={btnStyle(currentPage === 1)} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</button>
              <span style={{ padding: '0 10px', fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>Page {currentPage} of {totalPages}</span>
              <button style={btnStyle(currentPage === totalPages)} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</button>
              <button style={btnStyle(currentPage === totalPages)} onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>Last</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}