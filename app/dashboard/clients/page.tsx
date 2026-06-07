'use client'

// app/dashboard/clients/page.tsx
// Unified Ledger: Client Directory + Therapist Commission Calendar (Strict "Completed" Tracking)

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── UTILITIES ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCurrency(val: any): number {
  if (!val) return 0;
  return Number(String(val).replace(/[^0-9.-]+/g, '')) || 0;
}

function parseImportDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  let clean = String(raw).trim();
  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]), 12, 0, 0);
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

function formatDateToDDMMMYY(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dd = String(d.getDate()).padStart(2, '0');
  const mmm = months[d.getMonth()];
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}-${mmm}-${yy}`;
}

function formatDateToYYYYMMDD(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface WaiverData {
  focus_areas: string;
  health_conditions: string;
  signature: string;
  date_signed: Date | null;
}

interface ClientRecord {
  name: string;
  totalVisits: number;
  totalSpend: number;
  membershipTier: string;
  remainingMassages: string;
  lastVisitDate: Date | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  history: any[];
  waiver: WaiverData | null;
}

interface CommissionRecord {
  dateStr: string;
  therapist: string;
  net: number;
  commission: number;
  client: string;
  service: string;
}

export default function ClientsPage() {
  const supabase = useRef(createClient()).current
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [commissions, setCommissions] = useState<CommissionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [viewMode, setViewMode] = useState<'directory' | 'calendar'>('directory')

  // Pagination for Directory
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 100

  // Client Profile Modal State
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null)

  // Calendar State
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date())
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const PAGE = 1000
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allBookings: any[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allWaivers: any[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allMemberships: any[] = []

    // 1. Fetch HISTORICAL Bookings (Included 'status')
    let fromHist = 0
    for (; ;) {
      const { data, error } = await supabase
        .from('bookings_import')
        .select('date, client_name, service, received_payment, service_amount, therapist, discount_pct, therapist_comm_pct, status')
        .range(fromHist, fromHist + PAGE - 1)
      if (error || !data || data.length === 0) break
      allBookings.push(...data)
      if (data.length < PAGE) break
      fromHist += PAGE
    }

    // 2. Fetch LIVE Bookings (Included 'status')
    let fromLive = 0
    for (; ;) {
      const { data, error } = await supabase
        .from('bookings')
        .select('appointment_date, created_at, client_name, service_name, service, price, amount, received_payment, therapist_name, therapist, discount_pct, therapist_comm_pct, status')
        .range(fromLive, fromLive + PAGE - 1)
      if (error || !data || data.length === 0) break
      allBookings.push(...data)
      if (data.length < PAGE) break
      fromLive += PAGE
    }

    // 3. Fetch Waivers
    let fromWaiver = 0
    for (; ;) {
      const { data, error } = await supabase.from('waivers').select('*').range(fromWaiver, fromWaiver + PAGE - 1)
      if (error || !data || data.length === 0) break
      allWaivers.push(...data)
      if (data.length < PAGE) break
      fromWaiver += PAGE
    }

    // 4. Fetch Memberships
    let fromMem = 0
    for (; ;) {
      const { data, error } = await supabase.from('memberships').select('client_name, membership_tier, remaining_massages').eq('status', 'Active').range(fromMem, fromMem + PAGE - 1)
      if (error || !data || data.length === 0) break
      allMemberships.push(...data)
      if (data.length < PAGE) break
      fromMem += PAGE
    }

    const clientMap = new Map<string, ClientRecord>()
    const commArray: CommissionRecord[] = []

    const getClient = (rawName: string) => {
      const name = String(rawName).trim()
      const key = name.toLowerCase()
      if (!clientMap.has(key)) {
        clientMap.set(key, { name, totalVisits: 0, totalSpend: 0, membershipTier: 'N/A', remainingMassages: '—', lastVisitDate: null, history: [], waiver: null })
      }
      return clientMap.get(key)!
    }

    allBookings.forEach(r => {
      const rawDate = r.date || r.appointment_date || r.created_at
      const d = parseImportDate(rawDate)
      const dateStr = formatDateToYYYYMMDD(d)
      const rev = parseCurrency(r.received_payment || r.service_amount || r.price || r.amount)

      const disc = Number(r.discount_pct || 0)
      const commPct = Number(r.therapist_comm_pct || 0)
      const net = rev * (1 - disc / 100)
      const commission = net * (commPct / 100)
      const therapist = String(r.therapist_name || r.therapist || 'Unassigned').toUpperCase()
      const svcName = r.service || r.service_name || 'Massage Service'
      const bookingStatus = String(r.status || 'Completed').toUpperCase()

      const name = r.client_name || r.name || 'Guest'

      // STRICTLY TRACK ONLY COMPLETED VISITS FOR CLIENT PROFILE
      if (name.toLowerCase() !== 'guest' && name !== '—' && bookingStatus === 'COMPLETED') {
        const client = getClient(name)
        client.totalVisits += 1
        client.totalSpend += rev
        client.history.push({ date: d, service: svcName, revenue: rev, therapist: therapist })
        if (d && (!client.lastVisitDate || d.getTime() > client.lastVisitDate.getTime())) {
          client.lastVisitDate = d
        }
      }

      // STRICTLY TRACK ONLY COMPLETED APPOINTMENTS FOR COMMISSION
      if (bookingStatus === 'COMPLETED' && dateStr && therapist !== 'UNASSIGNED' && therapist !== '—') {
        commArray.push({ dateStr, therapist, net, commission, client: name, service: svcName })
      }
    })

    allMemberships.forEach(m => {
      if (!m.client_name || m.client_name.toLowerCase() === 'guest' || m.client_name === '—') return
      const client = getClient(m.client_name)
      client.membershipTier = (m.membership_tier || 'N/A').toUpperCase()
      client.remainingMassages = m.remaining_massages || '—'
    })

    allWaivers.forEach(w => {
      if (!w.client_name || w.client_name.toLowerCase() === 'guest' || w.client_name === '—') return
      const client = getClient(w.client_name)
      const d = parseImportDate(w.date_signed)
      if (!client.waiver || (d && client.waiver.date_signed && d.getTime() > client.waiver.date_signed.getTime())) {
        client.waiver = { focus_areas: w.focus_areas || 'None', health_conditions: w.health_conditions || 'None', signature: w.signature || '', date_signed: d }
      }
    })

    const allClients = Array.from(clientMap.values()).sort((a, b) => (b.lastVisitDate?.getTime() || 0) - (a.lastVisitDate?.getTime() || 0))

    setClients(allClients)
    setCommissions(commArray)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { setCurrentPage(1) }, [search])

  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  const returningClientsCount = clients.filter(c => c.totalVisits >= 2).length
  const newClientsCount = clients.filter(c => c.totalVisits === 1).length

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedClients = filtered.slice(startIndex, startIndex + itemsPerPage)

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    padding: '6px 12px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
    backgroundColor: disabled ? '#f5f5f5' : '#1A1A1A', color: disabled ? '#aaa' : '#C58F3B',
    border: 'none', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
  })

  // ─── CALENDAR LOGIC ───
  const daysInMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1).getDay();

  const handlePrevMonth = () => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1));

  const daysArray = Array.from({ length: 42 }, (_, i) => {
    const dayNumber = i - firstDay + 1;
    if (dayNumber > 0 && dayNumber <= daysInMonth) {
      const d = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), dayNumber);
      return { dayNumber, dateStr: formatDateToYYYYMMDD(d) };
    }
    return null;
  });

  const selectedDateCommissions = commissions.filter(c => c.dateStr === selectedDateStr);

  return (
    <>
      {/* ─── CLIENT PROFILE MODAL ─── */}
      {selectedClient && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, backgroundColor: 'rgba(26,26,26,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: 650, backgroundColor: '#FDFCF8', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.3)', fontFamily: "'Inter',system-ui,sans-serif", maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

            <div style={{ padding: '24px', borderBottom: '1px solid rgba(197,143,59,0.2)', backgroundColor: '#1A1A1A', color: '#FDFCF8', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#C58F3B', textTransform: 'uppercase', margin: '0 0 6px' }}>
                  Client Profile {selectedClient.membershipTier !== 'N/A' && <span style={{ backgroundColor: '#C58F3B', color: '#1A1A1A', padding: '2px 6px', borderRadius: 4, marginLeft: 8 }}>{selectedClient.membershipTier}</span>}
                </p>
                <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 28, margin: 0, color: '#FDFCF8' }}>{selectedClient.name}</h2>
              </div>
              <button onClick={() => setSelectedClient(null)} style={{ background: 'none', border: 'none', color: '#C58F3B', fontSize: 28, cursor: 'pointer', lineHeight: 1 }}>&times;</button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto' }}>
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

              {/* ─── CONNECTED WAIVER DATA DISPLAY ─── */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 20, color: '#1A1A1A', margin: '0 0 12px', borderBottom: '1px solid rgba(26,26,26,0.1)', paddingBottom: 8 }}>Waiver Data</h3>

                {selectedClient.waiver ? (
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 250px', backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.08)', borderRadius: 12, padding: '16px' }}>
                      <div style={{ marginBottom: 12 }}>
                        <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Declared Health Conditions</span>
                        <span style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 600 }}>{selectedClient.waiver.health_conditions}</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Body Focus Areas</span>
                        <span style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 600 }}>{selectedClient.waiver.focus_areas}</span>
                      </div>
                    </div>

                    <div style={{ flex: '1 1 200px', backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.08)', borderRadius: 12, padding: '16px' }}>
                      <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 8 }}>Digital Signature</span>
                      <div style={{ backgroundColor: '#fafafa', border: '1px dashed #ccc', borderRadius: 8, padding: '10px', textAlign: 'center', height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {selectedClient.waiver.signature ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={selectedClient.waiver.signature} alt="Client Signature" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                        ) : (
                          <span style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic' }}>No signature</span>
                        )}
                      </div>
                      <p style={{ margin: '8px 0 0', fontSize: 9, textAlign: 'right', color: '#666', fontWeight: 600 }}>SIGNED: {formatDateToDDMMMYY(selectedClient.waiver.date_signed)}</p>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '16px', backgroundColor: 'rgba(197,143,59,0.05)', borderRadius: 8, border: '1px dashed rgba(197,143,59,0.4)' }}>
                    <p style={{ fontSize: 13, color: '#666', margin: 0, fontStyle: 'italic' }}>No active digital waiver found for this client on file. A new waiver will be required upon next visit.</p>
                  </div>
                )}
              </div>

              <div>
                <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 20, color: '#1A1A1A', margin: '0 0 12px', borderBottom: '1px solid rgba(26,26,26,0.1)', paddingBottom: 8 }}>Past History</h3>
                {selectedClient.history.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ color: '#C58F3B', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.1em' }}>
                        <th style={{ padding: '8px 0' }}>Date</th>
                        <th style={{ padding: '8px 0' }}>Service</th>
                        <th style={{ padding: '8px 0' }}>Therapist</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedClient.history.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0)).slice(0, 10).map((h, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                          <td style={{ padding: '12px 0', color: '#1A1A1A', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatDateToDDMMMYY(h.date)}</td>
                          <td style={{ padding: '12px 0', color: '#666' }}>{h.service}</td>
                          <td style={{ padding: '12px 0', color: '#666' }}>{h.therapist}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ fontSize: 13, color: '#666', fontStyle: 'italic' }}>No past bookings recorded yet.</p>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ─── DAY COMMISSIONS MODAL ─── */}
      {selectedDateStr && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, backgroundColor: 'rgba(26,26,26,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: 700, backgroundColor: '#FDFCF8', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.3)', fontFamily: "'Inter',system-ui,sans-serif", maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '24px 30px', borderBottom: '1px solid rgba(197,143,59,0.2)', backgroundColor: '#1A1A1A', color: '#FDFCF8', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#C58F3B', textTransform: 'uppercase', margin: '0 0 6px' }}>DATE OVERVIEW</p>
                <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 28, margin: 0, color: '#FDFCF8' }}>Commission Extraction</h2>
                <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0 0' }}>{selectedDateStr}</p>
              </div>
              <button onClick={() => setSelectedDateStr(null)} style={{ background: 'none', border: 'none', color: '#C58F3B', fontSize: 28, cursor: 'pointer', lineHeight: 1 }}>&times;</button>
            </div>
            <div style={{ padding: '30px', overflowY: 'auto' }}>
              {selectedDateCommissions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666', fontStyle: 'italic' }}>No completed sessions recorded for this date.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.1)' }}>
                      <th style={{ padding: '12px 0', color: '#C58F3B', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 10 }}>Therapist</th>
                      <th style={{ padding: '12px 0', color: '#C58F3B', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 10 }}>Client</th>
                      <th style={{ padding: '12px 0', color: '#C58F3B', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 10 }}>Service</th>
                      <th style={{ padding: '12px 0', color: '#C58F3B', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 10, textAlign: 'right' }}>Net Cost</th>
                      <th style={{ padding: '12px 0', color: '#C58F3B', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 10, textAlign: 'right' }}>Earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDateCommissions.map((c, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(26,26,26,0.05)' }}>
                        <td style={{ padding: '16px 0', fontWeight: 700, color: '#1A1A1A' }}>{c.therapist}</td>
                        <td style={{ padding: '16px 0', color: '#666' }}>{c.client}</td>
                        <td style={{ padding: '16px 0', color: '#666', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.service}</td>
                        <td style={{ padding: '16px 0', color: '#666', textAlign: 'right' }}>₱{c.net.toLocaleString()}</td>
                        <td style={{ padding: '16px 0', fontWeight: 700, color: '#3D7A4A', textAlign: 'right' }}>₱{c.commission.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ padding: '16px 0', fontWeight: 700, textAlign: 'right', color: '#1A1A1A', fontSize: 14 }}>TOTAL DATE COMMISSION:</td>
                      <td style={{ padding: '16px 0', fontWeight: 700, textAlign: 'right', color: '#C58F3B', fontSize: 16 }}>
                        ₱{selectedDateCommissions.reduce((sum, c) => sum + c.commission, 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── MAIN PAGE UI ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Inter',system-ui,sans-serif" }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Operations</p>
            <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 32, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Client & Commission Hub</h2>
          </div>
          <button onClick={loadData} style={{ padding: '0 16px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', cursor: 'pointer' }}>
            {loading ? 'Aggregating...' : 'Refresh Arrays'}
          </button>
        </div>

        {/* VIEW TOGGLE */}
        <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid rgba(26,26,26,0.1)', paddingBottom: 16 }}>
          <button onClick={() => setViewMode('directory')} style={{ padding: '10px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', border: 'none', cursor: 'pointer', backgroundColor: viewMode === 'directory' ? '#1A1A1A' : 'transparent', color: viewMode === 'directory' ? '#C58F3B' : '#666', transition: 'all 200ms ease' }}>
            Client Directory
          </button>
          <button onClick={() => setViewMode('calendar')} style={{ padding: '10px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', border: 'none', cursor: 'pointer', backgroundColor: viewMode === 'calendar' ? '#1A1A1A' : 'transparent', color: viewMode === 'calendar' ? '#C58F3B' : '#666', transition: 'all 200ms ease' }}>
            Therapist Commission Calendar
          </button>
        </div>

        {viewMode === 'directory' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(240px,100%),1fr))', gap: 12 }}>
              <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: '4px solid #C58F3B' }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 8px' }}>Returning/Regular Clients</p>
                <p style={{ fontSize: 28, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{loading ? '...' : returningClientsCount.toLocaleString()}</p>
              </div>
              <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: '4px solid #3D7A4A' }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#3D7A4A', margin: '0 0 8px' }}>New Clients</p>
                <p style={{ fontSize: 28, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{loading ? '...' : newClientsCount.toLocaleString()}</p>
              </div>
            </div>

            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name..." style={{ height: 44, width: '100%', maxWidth: 400, padding: '0 16px', border: '1px solid rgba(26,26,26,0.16)', borderRadius: 8, fontSize: 15, outline: 'none' }} />

            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: '#fff', borderRadius: 16, border: '1px solid rgba(26,26,26,0.09)' }}>Aggregating databases to build unified client profiles...</div>
            ) : (
              <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ overflowX: 'auto', minHeight: 400 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)', backgroundColor: '#F8F4EE' }}>
                        {['Name', 'Total Visits', 'Total Spend', 'Membership', 'Remaining', 'Last Visit'].map(h => (
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

                          <td style={{ padding: '14px 20px' }}>
                            <span style={{
                              padding: '4px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', whiteSpace: 'nowrap',
                              backgroundColor: c.membershipTier !== 'N/A' ? 'rgba(197,143,59,0.15)' : '#f5f5f5',
                              color: c.membershipTier !== 'N/A' ? '#1A1A1A' : '#888',
                              border: c.membershipTier !== 'N/A' ? '1px solid rgba(197,143,59,0.4)' : '1px solid transparent'
                            }}>
                              {c.membershipTier}
                            </span>
                          </td>

                          <td style={{ padding: '14px 20px', color: c.remainingMassages !== '—' ? '#3D7A4A' : '#666', fontWeight: c.remainingMassages !== '—' ? 700 : 400 }}>
                            {c.remainingMassages}
                          </td>

                          <td style={{ padding: '14px 20px', color: '#666', whiteSpace: 'nowrap' }}>{formatDateToDDMMMYY(c.lastVisitDate)}</td>
                        </tr>
                      ))}
                      {paginatedClients.length === 0 && <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No clients found.</td></tr>}
                    </tbody>
                  </table>
                </div>

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
          </>
        )}

        {viewMode === 'calendar' && (
          <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 3px 12px rgba(0,0,0,0.05)', padding: '24px' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <button onClick={handlePrevMonth} style={{ padding: '8px 16px', borderRadius: 8, backgroundColor: '#f5f5f5', border: '1px solid #ccc', cursor: 'pointer' }}>&larr; Prev</button>
              <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 28, margin: 0, color: '#1A1A1A' }}>
                {currentMonthDate.toLocaleString('default', { month: 'long' })} {currentMonthDate.getFullYear()}
              </h2>
              <button onClick={handleNextMonth} style={{ padding: '8px 16px', borderRadius: 8, backgroundColor: '#f5f5f5', border: '1px solid #ccc', cursor: 'pointer' }}>Next &rarr;</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#C58F3B', textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: 8 }}>{d}</div>
              ))}

              {daysArray.map((cell, idx) => {
                if (!cell) return <div key={idx} style={{ backgroundColor: '#fafafa', borderRadius: 8, border: '1px dashed #eee', minHeight: 100 }} />;

                const dayComms = commissions.filter(c => c.dateStr === cell.dateStr);
                const totalDayComm = dayComms.reduce((sum, c) => sum + c.commission, 0);

                return (
                  <div
                    key={idx}
                    onClick={() => { if (dayComms.length > 0) setSelectedDateStr(cell.dateStr) }}
                    style={{
                      minHeight: 100, border: '1px solid rgba(26,26,26,0.1)', borderRadius: 8, padding: '10px',
                      display: 'flex', flexDirection: 'column',
                      cursor: dayComms.length > 0 ? 'pointer' : 'default',
                      backgroundColor: dayComms.length > 0 ? 'rgba(197,143,59,0.05)' : '#fff',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: dayComms.length > 0 ? '#1A1A1A' : '#aaa' }}>{cell.dayNumber}</span>
                    {dayComms.length > 0 && (
                      <div style={{ marginTop: 'auto' }}>
                        <div style={{ fontSize: 10, color: '#666', fontWeight: 600 }}>Earned:</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#3D7A4A' }}>₱{totalDayComm.toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

          </div>
        )}

      </div>
    </>
  )
}