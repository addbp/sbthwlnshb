'use client'
export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback, useRef } from 'react'
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

interface ClientRecord {
  name: string;
  totalVisits: number;
  totalSpend: number;
  lastVisitDate: Date | null;
  history: any[];
}

export default function ClientsPage() {
  const supabase = useRef(createClient()).current
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 100

  // Client Profile Modal State
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null)

  const loadClients = useCallback(async () => {
    setLoading(true)
    const PAGE = 1000
    let from = 0
    const rawData: any[] = []

    // Fetch all bookings to aggregate client data
    for (; ;) {
      const { data, error } = await supabase
        .from('bookings_import')
        .select('date, client_name, service, received_payment, service_amount, therapist')
        .range(from, from + PAGE - 1)

      if (error || !data || data.length === 0) break
      rawData.push(...data)
      if (data.length < PAGE) break
      from += PAGE
    }

    // Aggregate into unique clients
    const clientMap = new Map<string, ClientRecord>()

    rawData.forEach(r => {
      const name = String(r.client_name || 'Guest').trim()
      if (!name) return

      const rev = parseCurrency(r.received_payment || r.service_amount)
      const d = parseImportDate(r.date)

      if (!clientMap.has(name)) {
        clientMap.set(name, {
          name,
          totalVisits: 0,
          totalSpend: 0,
          lastVisitDate: d,
          history: []
        })
      }

      const client = clientMap.get(name)!
      client.totalVisits += 1
      client.totalSpend += rev
      client.history.push({ date: d, service: r.service, revenue: rev, therapist: r.therapist })

      // Update last visit if this record is newer
      if (d && (!client.lastVisitDate || d.getTime() > client.lastVisitDate.getTime())) {
        client.lastVisitDate = d
      }
    })

    const allClients = Array.from(clientMap.values())
    // Sort by most recent visit
    allClients.sort((a, b) => (b.lastVisitDate?.getTime() || 0) - (a.lastVisitDate?.getTime() || 0))

    setClients(allClients)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadClients() }, [loadClients])
  useEffect(() => { setCurrentPage(1) }, [search])

  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
  const totalSystemLifetimeValue = clients.reduce((sum, c) => sum + c.totalSpend, 0)

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedClients = filtered.slice(startIndex, startIndex + itemsPerPage)

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    padding: '6px 12px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
    backgroundColor: disabled ? '#f5f5f5' : '#1A1A1A', color: disabled ? '#aaa' : '#C58F3B',
    border: 'none', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
  })

  return (
    <>
      {/* ─── CLIENT PROFILE MODAL ─── */}
      {selectedClient && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, backgroundColor: 'rgba(26,26,26,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: 600, backgroundColor: '#FDFCF8', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.3)', fontFamily: "'Inter',system-ui,sans-serif", maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

            {/* Modal Header */}
            <div style={{ padding: '24px', borderBottom: '1px solid rgba(197,143,59,0.2)', backgroundColor: '#1A1A1A', color: '#FDFCF8', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#C58F3B', textTransform: 'uppercase', margin: '0 0 6px' }}>Client Profile</p>
                <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 28, margin: 0, color: '#FDFCF8' }}>{selectedClient.name}</h2>
              </div>
              <button onClick={() => setSelectedClient(null)} style={{ background: 'none', border: 'none', color: '#C58F3B', fontSize: 28, cursor: 'pointer', lineHeight: 1 }}>&times;</button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto' }}>

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                <div style={{ padding: '16px', backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.08)', borderRadius: 12 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#7A6E65', margin: '0 0 4px', textTransform: 'uppercase' }}>Total Visits</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{selectedClient.totalVisits}</p>
                </div>
                <div style={{ padding: '16px', backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.08)', borderRadius: 12 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#7A6E65', margin: '0 0 4px', textTransform: 'uppercase' }}>Lifetime Spend</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>₱{selectedClient.totalSpend.toLocaleString()}</p>
                </div>
                <div style={{ padding: '16px', backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.08)', borderRadius: 12 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#7A6E65', margin: '0 0 4px', textTransform: 'uppercase' }}>Last Visit</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: '#C58F3B', margin: '0 0 4px' }}>{formatDateToDDMMMYY(selectedClient.lastVisitDate)}</p>
                </div>
              </div>

              {/* Data Sections */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 20, color: '#1A1A1A', margin: '0 0 12px', borderBottom: '1px solid rgba(26,26,26,0.1)', paddingBottom: 8 }}>Waiver Data</h3>
                <div style={{ padding: '16px', backgroundColor: 'rgba(197,143,59,0.05)', borderRadius: 8, border: '1px dashed rgba(197,143,59,0.4)' }}>
                  <p style={{ fontSize: 13, color: '#666', margin: 0, fontStyle: 'italic' }}>No active digital waiver found for this client on file. A new waiver will be required upon next visit.</p>
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 20, color: '#1A1A1A', margin: '0 0 12px', borderBottom: '1px solid rgba(26,26,26,0.1)', paddingBottom: 8 }}>Future Bookings</h3>
                <p style={{ fontSize: 13, color: '#666', margin: 0 }}>No upcoming appointments scheduled.</p>
              </div>

              <div>
                <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 20, color: '#1A1A1A', margin: '0 0 12px', borderBottom: '1px solid rgba(26,26,26,0.1)', paddingBottom: 8 }}>Past History (Top 5)</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ color: '#C58F3B', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.1em' }}>
                      <th style={{ padding: '8px 0' }}>Date</th>
                      <th style={{ padding: '8px 0' }}>Service</th>
                      <th style={{ padding: '8px 0' }}>Therapist</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedClient.history.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0)).slice(0, 5).map((h, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                        <td style={{ padding: '12px 0', color: '#1A1A1A', fontWeight: 600 }}>{formatDateToDDMMMYY(h.date)}</td>
                        <td style={{ padding: '12px 0', color: '#666' }}>{h.service}</td>
                        <td style={{ padding: '12px 0', color: '#666' }}>{h.therapist}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ─── MAIN PAGE UI ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Inter',system-ui,sans-serif" }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Guest Management</p>
            <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 32, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Clients</h2>
          </div>
          <button onClick={loadClients} style={{ padding: '0 16px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', cursor: 'pointer' }}>
            {loading ? 'Aggregating...' : 'Refresh'}
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(240px,100%),1fr))', gap: 12 }}>
          <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 8px' }}>Total Unique Clients</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{loading ? '...' : clients.length.toLocaleString()}</p>
          </div>
          <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 8px' }}>Total System Lifetime Value</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>₱{loading ? '...' : totalSystemLifetimeValue.toLocaleString()}</p>
          </div>
        </div>

        <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name..." style={{ height: 44, width: '100%', maxWidth: 400, padding: '0 16px', border: '1px solid rgba(26,26,26,0.16)', borderRadius: 8, fontSize: 15, outline: 'none' }} />

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: '#fff', borderRadius: 16, border: '1px solid rgba(26,26,26,0.09)' }}>Aggregating 10,000+ records to build client profiles...</div>
        ) : (
          <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ overflowX: 'auto', minHeight: 400 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)', backgroundColor: '#F8F4EE' }}>
                    {['Name', 'Total Visits', 'Total Spend', 'Last Visit'].map(h => (
                      <th key={h} style={{ padding: '14px 20px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C58F3B', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedClients.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                      <td style={{ padding: '14px 20px', fontWeight: 700, color: '#1A1A1A' }}>
                        <button
                          onClick={() => setSelectedClient(c)}
                          style={{ background: 'none', border: 'none', color: '#1A1A1A', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 0, textDecoration: 'underline', textDecorationColor: 'rgba(197,143,59,0.5)', textUnderlineOffset: 4 }}
                        >
                          {c.name}
                        </button>
                      </td>
                      <td style={{ padding: '14px 20px', color: '#666' }}>{c.totalVisits}</td>
                      <td style={{ padding: '14px 20px', fontWeight: 700, color: '#1A1A1A' }}>₱{c.totalSpend.toLocaleString()}</td>
                      <td style={{ padding: '14px 20px', color: '#666', whiteSpace: 'nowrap' }}>{formatDateToDDMMMYY(c.lastVisitDate)}</td>
                    </tr>
                  ))}
                  {paginatedClients.length === 0 && <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No clients found.</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{ padding: '16px 20px', backgroundColor: '#FDFCF8', borderTop: '1px solid rgba(26,26,26,0.09)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <span style={{ fontSize: 13, color: '#666' }}>
                Showing <strong style={{ color: '#1A1A1A' }}>{startIndex + 1}</strong> to <strong style={{ color: '#1A1A1A' }}>{Math.min(startIndex + itemsPerPage, filtered.length)}</strong> of <strong style={{ color: '#C58F3B' }}>{filtered.length.toLocaleString()}</strong> clients
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
    </>
  )
}