'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

function parseImportDate(raw: string | null): Date | null {
  if (!raw) return null;
  const clean = String(raw).trim().replace(/,/g, '');
  const d = new Date(clean);
  if (!isNaN(d.getTime())) return d;
  return null;
}

interface ClientRow {
  name: string; visits: number; revenue: number;
  lastVisit: Date | null; rawDate: string;
}

export default function ClientsPage() {
  const supabase = useRef(createClient()).current
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const loadClients = useCallback(async () => {
    setLoading(true)
    const PAGE = 1000
    let from = 0
    const map: Record<string, ClientRow> = {}

    for (; ;) {
      const { data, error } = await supabase
        .from('bookings_import')
        .select('date, client_name, received_payment')
        .range(from, from + PAGE - 1)

      if (error || !data || data.length === 0) break

      data.forEach(r => {
        const rawName = String(r.client_name || 'Guest').trim()
        const key = rawName.toLowerCase()
        const rev = Number(r.received_payment || 0)
        const d = parseImportDate(r.date)

        if (!map[key]) {
          map[key] = { name: rawName, visits: 0, revenue: 0, lastVisit: d, rawDate: String(r.date) }
        }
        map[key].visits++
        map[key].revenue += rev

        if (d && map[key].lastVisit) {
          if (d > map[key].lastVisit) map[key].lastVisit = d;
        } else if (d) {
          map[key].lastVisit = d;
        }
      })

      if (data.length < PAGE) break
      from += PAGE
    }

    const sorted = Object.values(map).sort((a, b) => b.revenue - a.revenue)
    setClients(sorted)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadClients() }, [loadClients])

  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
  const totalRevenue = clients.reduce((a, c) => a + c.revenue, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Inter',system-ui,sans-serif" }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Guest Management</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 32, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Clients</h2>
        </div>
        <button onClick={loadClients} style={{ padding: '0 16px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(200px,100%),1fr))', gap: 12 }}>
          <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '18px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 8px' }}>Total Clients</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px' }}>{clients.length.toLocaleString()}</p>
          </div>
          <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '18px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 8px' }}>Lifetime Value</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px' }}>₱{totalRevenue.toLocaleString()}</p>
          </div>
        </div>
      )}

      <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name..." style={{ height: 40, padding: '0 14px', border: '1px solid rgba(26,26,26,0.16)', borderRadius: 8, fontSize: 14, outline: 'none' }} />

      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: 'rgba(197,143,59,0.07)', borderRadius: 12 }}>
          Extracting unique clients from history...
        </div>
      ) : (
        <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)', backgroundColor: '#F8F4EE' }}>
                  {['Name', 'Total Visits', 'Total Spend', 'Last Visit'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C58F3B', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 1000).map((c, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1A1A1A' }}>{c.name}</td>
                    <td style={{ padding: '12px 16px', color: '#666' }}>{c.visits}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1A1A1A' }}>₱{c.revenue.toLocaleString()}</td>
                    <td style={{ padding: '12px 16px', color: '#666' }}>{c.lastVisit ? c.lastVisit.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : c.rawDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}