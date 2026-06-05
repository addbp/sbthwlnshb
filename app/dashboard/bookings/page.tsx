'use client'
export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── SAFE CURRENCY PARSER ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

interface BookingRow {
  _key: string;
  parsedDate: Date | null;
  client: string;
  service: string;
  therapist: string;
  category: 'SABBATH' | 'LE NAILS';
  amount: number;
  paymentMethod: string;
  clientType: string;
}

const NAIL_KEYWORDS = [
  'MANICURE', 'PEDICURE', 'FOOT SPA', 'FOOT MASSAGE', 'FOOT PARAFFIN', 'HAND PARAFFIN',
  'MANIGEL', 'ORLY', 'GEL POLISH', 'RHINESTONES', 'NAIL ART', 'GEL REMOVAL', 'POLISH', 'NAILS'
];

export default function BookingsDashboardPage() {
  const supabase = useRef(createClient()).current
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'ALL' | 'SABBATH' | 'LE NAILS'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Pagination Configuration
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 100

  const loadBookingsEngine = useCallback(async () => {
    setLoading(true)
    const PAGE_SIZE = 1000
    const uniqueRows = new Map<string, BookingRow>() // <-- DEDUPLICATOR MAP

    try {
      // 1. Unroll Historical Data Stream (`bookings_import`)
      let fromHist = 0
      for (; ;) {
        const { data, error } = await supabase
          .from('bookings_import')
          .select('date, client_name, service, received_payment, service_amount, therapist, payment_method')
          .range(fromHist, fromHist + PAGE_SIZE - 1)

        if (error || !data || data.length === 0) break

        data.forEach((r, idx) => {
          const serviceName = String(r.service || '—');
          const upperService = serviceName.toUpperCase();

          const isNail = NAIL_KEYWORDS.some(k => upperService.includes(k));
          const categoryValue = isNail ? 'LE NAILS' : 'SABBATH';

          const displayService = (upperService.includes('MEMBERSHIP') || upperService.includes('PLATINUM') || upperService.includes('GOLD') || upperService.includes('BASIC') || upperService.includes('VIP'))
            ? upperService
            : serviceName;

          const parsedDate = parseImportDate(r.date);
          const amount = parseCurrency(r.received_payment || r.service_amount);
          const client = String(r.client_name || 'Guest').trim();

          const row: BookingRow = {
            _key: `hist-${fromHist}-${idx}`,
            parsedDate,
            client,
            service: displayService,
            therapist: String(r.therapist || '—').toUpperCase(),
            category: categoryValue,
            amount,
            paymentMethod: String(r.payment_method || 'CASH').toUpperCase(),
            clientType: '—'
          };

          // Generate a strict unique key to prevent Dual-Save duplication
          const dedupKey = `${parsedDate?.getTime()}-${client.toLowerCase()}-${amount}`;
          uniqueRows.set(dedupKey, row);
        })
        if (data.length < PAGE_SIZE) break
        fromHist += PAGE_SIZE
      }

      // 2. Unroll Live POS/Kiosk Data Stream (`bookings`)
      let fromLive = 0
      for (; ;) {
        const { data, error } = await supabase
          .from('bookings')
          .select('appointment_date, created_at, client_name, service_name, service, price, amount, received_payment, therapist_name, payment_method')
          .range(fromLive, fromLive + PAGE_SIZE - 1)

        if (error || !data || data.length === 0) break

        data.forEach((r, idx) => {
          const serviceName = String(r.service_name || r.service || '—');
          const upperService = serviceName.toUpperCase();

          const isNail = NAIL_KEYWORDS.some(k => upperService.includes(k));
          const categoryValue = isNail ? 'LE NAILS' : 'SABBATH';

          const displayService = (upperService.includes('MEMBERSHIP') || upperService.includes('PLATINUM') || upperService.includes('GOLD') || upperService.includes('BASIC') || upperService.includes('VIP'))
            ? upperService
            : serviceName;

          const parsedDate = parseImportDate(r.appointment_date || r.created_at);
          const amount = parseCurrency(r.price || r.amount || r.received_payment);
          const client = String(r.client_name || 'Guest').trim();

          const row: BookingRow = {
            _key: `live-${fromLive}-${idx}`,
            parsedDate,
            client,
            service: displayService,
            therapist: String(r.therapist_name || '—').toUpperCase(),
            category: categoryValue,
            amount,
            paymentMethod: String(r.payment_method || 'CASH').toUpperCase(),
            clientType: '—'
          };

          // Check if this booking was already processed from `bookings_import`
          const dedupKey = `${parsedDate?.getTime()}-${client.toLowerCase()}-${amount}`;
          if (!uniqueRows.has(dedupKey)) {
            uniqueRows.set(dedupKey, row);
          }
        })
        if (data.length < PAGE_SIZE) break
        fromLive += PAGE_SIZE
      }

      // Extract unified deduplicated array
      const unifiedTimeline = Array.from(uniqueRows.values());

      // 3. Sequential Timeline Pass (Calculate Guest Retention Flags)
      unifiedTimeline.sort((a, b) => (a.parsedDate?.getTime() || 0) - (b.parsedDate?.getTime() || 0))
      const historyTracker = new Map<string, number>()

      unifiedTimeline.forEach(row => {
        const uniqueKey = row.client.toLowerCase().trim()
        if (!uniqueKey || uniqueKey === 'guest' || uniqueKey === '—') {
          row.clientType = 'WALK-IN / GUEST'
          return
        }
        const historicalVisits = historyTracker.get(uniqueKey) || 0
        row.clientType = historicalVisits === 0 ? 'NEW CLIENT' : 'RETURNING CLIENT'
        historyTracker.set(uniqueKey, historicalVisits + 1)
      })

      // 4. Reverse Sort (Newest entries bubble directly to front row)
      unifiedTimeline.sort((a, b) => (b.parsedDate?.getTime() || 0) - (a.parsedDate?.getTime() || 0))

      setBookings(unifiedTimeline)
    } catch (err) {
      console.error("Bookings ingestion sub-routine error:", err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadBookingsEngine() }, [loadBookingsEngine])
  useEffect(() => { setCurrentPage(1) }, [activeTab, searchQuery])

  // ─── FILTER MATRIX EXECUTION ───
  const processedDataRows = bookings.filter(row => {
    const matchesTab = activeTab === 'ALL' || row.category === activeTab;
    const matchesSearch = row.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.service.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  })

  const totalPagesCount = Math.max(1, Math.ceil(processedDataRows.length / itemsPerPage))
  const offsetIndex = (currentPage - 1) * itemsPerPage
  const viewablePaginatedRows = processedDataRows.slice(offsetIndex, offsetIndex + itemsPerPage)

  return (
    <>
      <style>{`
        .tab-btn { padding: 10px 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; border: none; background: transparent; color: #666; cursor: pointer; transition: all 200ms ease; position: relative; }
        .tab-btn.active { color: #1A1A1A; }
        .tab-btn.active::after { content: ''; position: absolute; bottom: 0; left: 20px; right: 20px; height: 3px; background-color: #C58F3B; border-radius: 2px; }
        .pos-badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Inter',system-ui,sans-serif" }}>

        {/* Upper Header Control Context */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Data Ledger</p>
            <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 32, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Bookings Log</h2>
          </div>
          <button onClick={loadBookingsEngine} style={{ padding: '0 16px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>
            {loading ? 'Re-aligning...' : 'Refresh Records'}
          </button>
        </div>

        {/* Search Input Controller */}
        <input
          type="search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by customer or service string..."
          style={{ height: 44, width: '100%', maxWidth: 400, padding: '0 16px', border: '1px solid rgba(26,26,26,0.16)', borderRadius: 8, fontSize: 14, outline: 'none' }}
        />

        {/* ─── EXPLICITLY FILTERED TABS ─── */}
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid rgba(26,26,26,0.08)', paddingBottom: 0 }}>
          {(['ALL', 'SABBATH', 'LE NAILS'] as const).map(tabKey => (
            <button
              key={tabKey}
              onClick={() => setActiveTab(tabKey)}
              className={`tab-btn ${activeTab === tabKey ? 'active' : ''}`}
            >
              {tabKey}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: '#fff', borderRadius: 16, border: '1px solid rgba(26,26,26,0.09)' }}>
            Processing limitless tracking pipeline vectors...
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
                  {viewablePaginatedRows.map((r) => (
                    <tr key={r._key} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                      <td style={{ padding: '14px 16px', color: '#666', whiteSpace: 'nowrap' }}>{formatDateToDDMMMYY(r.parsedDate)}</td>
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: '#1A1A1A' }}>{r.client}</td>

                      {/* Forced Uppercase Membership Column Display Target */}
                      <td style={{ padding: '14px 16px', color: '#2A2A2A', fontWeight: r.service.includes('MEMBERSHIP') ? 700 : 400 }}>
                        {r.service}
                      </td>

                      <td style={{ padding: '14px 16px', color: '#666', whiteSpace: 'nowrap' }}>{r.therapist}</td>

                      {/* Clean structural categorization field */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          padding: '4px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700,
                          backgroundColor: r.category === 'LE NAILS' ? 'rgba(197,143,59,0.1)' : 'rgba(26,26,26,0.05)',
                          color: r.category === 'LE NAILS' ? '#C58F3B' : '#1A1A1A',
                          border: r.category === 'LE NAILS' ? '1px solid rgba(197,143,59,0.2)' : '1px solid transparent'
                        }}>
                          {r.category}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1A1A1A' }}>₱{r.amount.toLocaleString()}</td>
                      <td style={{ padding: '14px 16px', color: '#666', fontSize: 12, fontWeight: 600 }}>{r.paymentMethod}</td>

                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <span className="pos-badge" style={{
                          backgroundColor: r.clientType === 'NEW CLIENT' ? 'rgba(61,122,74,0.1)' : 'rgba(197,143,59,0.1)',
                          color: r.clientType === 'NEW CLIENT' ? '#3D7A4A' : '#C58F3B'
                        }}>
                          {r.clientType}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {viewablePaginatedRows.length === 0 && <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No matching records allocated.</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Footer block */}
            <div style={{ padding: '16px 20px', backgroundColor: '#FDFCF8', borderTop: '1px solid rgba(26,26,26,0.09)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <span style={{ fontSize: 13, color: '#666' }}>
                Showing <strong style={{ color: '#1A1A1A' }}>{offsetIndex + 1}</strong> to <strong style={{ color: '#1A1A1A' }}>{Math.min(offsetIndex + itemsPerPage, processedDataRows.length)}</strong> of <strong style={{ color: '#C58F3B' }}>{processedDataRows.length.toLocaleString()}</strong> transaction sequences
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, backgroundColor: currentPage === 1 ? '#f5f5f5' : '#1A1A1A', color: currentPage === 1 ? '#aaa' : '#C58F3B', border: 'none', borderRadius: 6, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }} onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>First</button>
                <button style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, backgroundColor: currentPage === 1 ? '#f5f5f5' : '#1A1A1A', color: currentPage === 1 ? '#aaa' : '#C58F3B', border: 'none', borderRadius: 6, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>Prev</button>
                <span style={{ padding: '0 10px', fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>Page {currentPage} of {totalPagesCount}</span>
                <button style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, backgroundColor: currentPage === totalPagesCount ? '#f5f5f5' : '#1A1A1A', color: currentPage === totalPagesCount ? '#aaa' : '#C58F3B', border: 'none', borderRadius: 6, cursor: currentPage === totalPagesCount ? 'not-allowed' : 'pointer' }} onClick={() => setCurrentPage(prev => Math.min(totalPagesCount, prev + 1))} disabled={currentPage === totalPagesCount}>Next</button>
                <button style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, backgroundColor: currentPage === totalPagesCount ? '#f5f5f5' : '#1A1A1A', color: currentPage === totalPagesCount ? '#aaa' : '#C58F3B', border: 'none', borderRadius: 6, cursor: currentPage === totalPagesCount ? 'not-allowed' : 'pointer' }} onClick={() => setCurrentPage(totalPagesCount)} disabled={currentPage === totalPagesCount}>Last</button>
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  )
}