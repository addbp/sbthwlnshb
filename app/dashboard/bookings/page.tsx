'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

function parseImportDate(raw: string | null): Date | null {
  if (!raw) return null;
  const clean = String(raw).trim().replace(/,/g, '');
  let d = new Date(clean);
  if (!isNaN(d.getTime())) return d;

  const dashMatch = clean.match(/^(\d{1,2})[-\s/]+([A-Za-z]{3,})[-\s/]+(\d{2,4})$/);
  if (dashMatch) {
    let year = dashMatch[3];
    if (year.length === 2) year = '20' + year;
    d = new Date(`${dashMatch[2]} ${dashMatch[1]}, ${year}`);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function fmtDateShort(raw: string): string {
  const d = parseImportDate(raw)
  return d ? d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : String(raw)
}

interface Booking {
  _key: string; date: string; client: string; service: string; therapist: string;
  revenue: number; category: string; payMethod: string;
}

export default function BookingsPage() {
  const supabase = useRef(createClient()).current
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const loadBookings = useCallback(async () => {
    setLoading(true)
    const PAGE = 1000
    let from = 0
    const all: Booking[] = []

    for (; ;) {
      const { data, error } = await supabase
        .from('bookings_import')
        .select('date, client_name, service, therapist, received_payment, category, payment_method')
        .range(from, from + PAGE - 1)

      if (error || !data || data.length === 0) break

      data.forEach((r, i) => {
        all.push({
          _key: `${r.client_name}-${i}-${from}`,
          date: String(r.date || ''),
          client: String(r.client_name || 'Guest'),
          service: String(r.service || '—'),
          therapist: String(r.therapist || '—'),
          revenue: Number(r.received_payment || 0),
          category: String(r.category || '—'),
          payMethod: String(r.payment_method || '—')
        })
      })

      if (data.length < PAGE) break
      from += PAGE
    }

    all.sort((a, b) => {
      const da = parseImportDate(a.date)?.getTime() || 0;
      const db = parseImportDate(b.date)?.getTime() || 0;
      return db - da;
    })

    setBookings(all)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadBookings() }, [loadBookings])

  const filtered = bookings.filter(b =>
    search === '' ||
    b.client.toLowerCase().includes(search.toLowerCase()) ||
    b.service.toLowerCase().includes(search.toLowerCase())
  )

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

      <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client or service..." style={{ height: 40, padding: '0 14px', border: '1px solid rgba(26,26,26,0.16)', borderRadius: 8, fontSize: 14, outline: 'none' }} />

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
                  {['Date', 'Client', 'Service', 'Therapist', 'Revenue', 'Payment'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C58F3B', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 1000).map((b) => (
                  <tr key={b._key} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                    <td style={{ padding: '12px 16px', color: '#666' }}>{fmtDateShort(b.date)}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1A1A1A' }}>{b.client}</td>
                    <td style={{ padding: '12px 16px', color: '#2A2A2A' }}>{b.service}</td>
                    <td style={{ padding: '12px 16px', color: '#4A4A4A' }}>{b.therapist}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1A1A1A' }}>₱{b.revenue.toLocaleString()}</td>
                    <td style={{ padding: '12px 16px', color: '#666' }}>{b.payMethod}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#666' }}>No records found.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '12px 16px', backgroundColor: '#F8F4EE', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#666' }}>Showing {Math.min(filtered.length, 1000)} of {bookings.length}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>Total Filtered Revenue: <span style={{ color: '#C58F3B' }}>₱{totalRevenue.toLocaleString()}</span></span>
          </div>
        </div>
      )}
    </div>
  )
}