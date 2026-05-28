'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── SAFE CURRENCY PARSER (Fixes NaN bug) ───
function parseCurrency(val: any): number {
  if (!val) return 0;
  return Number(String(val).replace(/[^0-9.-]+/g, '')) || 0;
}

// ─── INDESTRUCTIBLE DATE PARSER (Forces Noon to kill timezone shifts) ───
function parseImportDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  let clean = String(raw).trim();

  // Format: "27-Aug-25" -> "Aug 27, 2025"
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

// ─── STRICT DATE FORMATTER (Fixes "August 12025" bug) ───
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
  parsedDate: Date | null;
}

export default function BookingsPage() {
  const supabase = useRef(createClient()).current
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')

  const loadBookings = useCallback(async () => {
    setLoading(true)
    const PAGE = 1000
    let from = 0
    const all: Booking[] = []

    for (; ;) {
      const { data, error } = await supabase
        .from('bookings_import')
        .select('date, client_name, service, therapist, received_payment, service_amount, category, payment_method')
        .range(from, from + PAGE - 1)

      if (error || !data || data.length === 0) break

      data.forEach((r, i) => {
        all.push({
          _key: `${r.client_name}-${i}-${from}`,
          date: String(r.date || ''),
          parsedDate: parseImportDate(r.date),
          client: String(r.client_name || 'Guest'),
          service: String(r.service || '—'),
          therapist: String(r.therapist || '—'),
          // Safely strips ₱ and commas
          revenue: parseCurrency(r.received_payment || r.service_amount),
          category: String(r.category || 'Uncategorized'),
          payMethod: String(r.payment_method || '—')
        })
      })
      if (data.length < PAGE) break
      from += PAGE
    }

    // Sort strictly from newest (May 2026) to oldest (May 2025)
    all.sort((a, b) => {
      const timeA = a.parsedDate?.getTime() || 0;
      const timeB = b.parsedDate?.getTime() || 0;
      return timeB - timeA;
    })

    setBookings(all)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadBookings() }, [loadBookings])

  const uniqueCategories = ['All', ...Array.from(new Set(bookings.map(b => b.category).filter(Boolean)))]

  const filtered = bookings.filter(b => {
    const matchesSearch = search === '' || b.client.toLowerCase().includes(search.toLowerCase()) || b.service.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || b.category === categoryFilter;
    return matchesSearch && matchesCategory;
  })

  const totalRevenue = filtered.reduce((sum, b) => sum + b.revenue, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Inter',system-ui,sans-serif" }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Reservations</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 32, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>All Bookings</h2>
        </div>
        <button onClick={loadBookings} style={{ padding: '0 16px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', cursor: 'pointer' }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {uniqueCategories.map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(cat)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid', backgroundColor: categoryFilter === cat ? '#1A1A1A' : '#fff', color: categoryFilter === cat ? '#C58F3B' : '#666', borderColor: categoryFilter === cat ? '#1A1A1A' : '#ddd', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{cat}</button>
          ))}
        </div>
        <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client or service..." style={{ height: 40, width: '100%', maxWidth: 300, padding: '0 14px', border: '1px solid rgba(26,26,26,0.16)', borderRadius: 8, fontSize: 14, outline: 'none' }} />
      </div>

      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: 'rgba(197,143,59,0.07)', borderRadius: 12 }}>
          Loading all booking records...
        </div>
      ) : (
        <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)', backgroundColor: '#F8F4EE' }}>
                  {/* RENAMED COLUMNS HERE */}
                  {['Date', 'Client', 'Service', 'Therapist', 'Category', 'Payment', 'Discount/Membership'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C58F3B', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 1000).map((b) => (
                  <tr key={b._key} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                    {/* APPLIED PERFECT DD-MMM-YY DATE FORMAT */}
                    <td style={{ padding: '12px 16px', color: '#666', whiteSpace: 'nowrap' }}>{formatDateToDDMMMYY(b.parsedDate)}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1A1A1A' }}>{b.client}</td>
                    <td style={{ padding: '12px 16px', color: '#2A2A2A' }}>{b.service}</td>
                    <td style={{ padding: '12px 16px', color: '#4A4A4A' }}>{b.therapist}</td>
                    <td style={{ padding: '12px 16px', color: '#666' }}>
                      <span style={{ padding: '4px 8px', borderRadius: 4, backgroundColor: '#f5f5f5', fontSize: 11 }}>{b.category}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1A1A1A' }}>₱{b.revenue.toLocaleString()}</td>
                    <td style={{ padding: '12px 16px', color: '#666', fontWeight: 600 }}>{b.payMethod}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: '#666' }}>No records found.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '12px 16px', backgroundColor: '#F8F4EE', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#666' }}>Showing {Math.min(filtered.length, 1000)} of {bookings.length}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>Total Filtered Payment: <span style={{ color: '#C58F3B' }}>₱{totalRevenue.toLocaleString()}</span></span>
          </div>
        </div>
      )}
    </div>
  )
}