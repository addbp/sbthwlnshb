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

interface PaymentRecord {
  _key: string;
  parsedDate: Date | null;
  client: string;
  service: string;
  amount: number;
  received: number;
  modeOfPayment: string;
  clientType: string;
}

export default function PaymentsPage() {
  const supabase = useRef(createClient()).current
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 100

  const loadPayments = useCallback(async () => {
    setLoading(true)
    const PAGE = 1000
    let from = 0
    const all: PaymentRecord[] = []

    // 1. Fetch entire database history
    for (; ;) {
      const { data, error } = await supabase
        .from('bookings_import')
        .select('date, client_name, service, service_amount, received_payment, payment_method')
        .range(from, from + PAGE - 1)

      if (error || !data || data.length === 0) break

      data.forEach((r, i) => {
        all.push({
          _key: `pay-${from}-${i}`,
          parsedDate: parseImportDate(r.date),
          client: String(r.client_name || 'Guest'),
          service: String(r.service || '—'),
          amount: parseCurrency(r.service_amount),
          received: parseCurrency(r.received_payment),
          modeOfPayment: String(r.payment_method || '—').toUpperCase(),
          clientType: '—' // Will be calculated dynamically below
        })
      })
      if (data.length < PAGE) break
      from += PAGE
    }

    // 2. Sort OLDEST to NEWEST to simulate the exact timeline of the spa
    all.sort((a, b) => (a.parsedDate?.getTime() || 0) - (b.parsedDate?.getTime() || 0))

    // 3. Scan the database timeline to dynamically calculate NEW vs RETURNING clients
    const visitCounter = new Map<string, number>()
    all.forEach(p => {
      // Use lowercase trim to match names perfectly (e.g., "John" matches "john ")
      const nameKey = p.client.toLowerCase().trim()
      if (!nameKey || nameKey === 'guest' || nameKey === '—') {
        p.clientType = 'WALK-IN / GUEST'
        return
      }

      const visits = visitCounter.get(nameKey) || 0
      if (visits === 0) {
        p.clientType = 'NEW CLIENT'
      } else {
        p.clientType = 'RETURNING CLIENT'
      }
      visitCounter.set(nameKey, visits + 1)
    })

    // 4. Sort NEWEST to OLDEST for the dashboard display view
    all.sort((a, b) => (b.parsedDate?.getTime() || 0) - (a.parsedDate?.getTime() || 0))

    setPayments(all)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadPayments() }, [loadPayments])

  const totalReceived = payments.reduce((sum, p) => sum + p.received, 0)
  const totalTransactions = payments.length

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(payments.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedPayments = payments.slice(startIndex, startIndex + itemsPerPage)

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    padding: '6px 12px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
    backgroundColor: disabled ? '#f5f5f5' : '#1A1A1A', color: disabled ? '#aaa' : '#C58F3B',
    border: 'none', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'opacity 200ms ease'
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 36, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Payments</h2>
        </div>
        <button onClick={loadPayments} style={{ padding: '0 16px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', cursor: 'pointer' }}>
          {loading ? 'Syncing...' : 'Refresh'}
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(197,143,59,0.2)', borderRadius: 14, padding: '24px', minWidth: 220, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: '0 0 8px', letterSpacing: '0.05em' }}>Total Received</p>
          <p style={{ fontSize: 32, fontWeight: 700, color: '#fff', margin: 0 }}>
            {loading ? '...' : `₱${totalReceived.toLocaleString()}`}
          </p>
        </div>
        <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '24px', minWidth: 220, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 8px', letterSpacing: '0.05em' }}>Total Transactions</p>
          <p style={{ fontSize: 32, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
            {loading ? '...' : totalTransactions.toLocaleString()}
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: '#fff', borderRadius: 16, border: '1px solid rgba(26,26,26,0.09)' }}>
          Scanning timeline to map New vs Returning clients...
        </div>
      ) : (
        <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ overflowX: 'auto', minHeight: 400 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)', backgroundColor: '#F8F4EE' }}>
                  {['Date', 'Client', 'Service', 'Amount', 'Received', 'Mode of Payment', 'Client Type'].map(h => (
                    <th key={h} style={{ padding: '14px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C58F3B', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedPayments.map((p) => (
                  <tr key={p._key} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                    <td style={{ padding: '14px 16px', color: '#666', whiteSpace: 'nowrap' }}>{formatDateToDDMMMYY(p.parsedDate)}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: '#1A1A1A' }}>{p.client}</td>
                    <td style={{ padding: '14px 16px', color: '#2A2A2A' }}>{p.service}</td>
                    <td style={{ padding: '14px 16px', color: '#666' }}>₱{p.amount.toLocaleString()}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1A1A1A' }}>₱{p.received.toLocaleString()}</td>
                    <td style={{ padding: '14px 16px', color: '#666' }}>
                      <span style={{ padding: '4px 8px', borderRadius: 4, backgroundColor: '#f5f5f5', fontSize: 11, fontWeight: 600, border: '1px solid rgba(0,0,0,0.05)' }}>
                        {p.modeOfPayment}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                        backgroundColor: p.clientType === 'NEW CLIENT' ? 'rgba(61,122,74,0.1)' : 'rgba(197,143,59,0.1)',
                        color: p.clientType === 'NEW CLIENT' ? '#3D7A4A' : '#C58F3B'
                      }}>
                        {p.clientType}
                      </span>
                    </td>
                  </tr>
                ))}
                {paginatedPayments.length === 0 && <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No payment records found.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div style={{ padding: '16px 20px', backgroundColor: '#FDFCF8', borderTop: '1px solid rgba(26,26,26,0.09)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <span style={{ fontSize: 13, color: '#666' }}>
              Showing <strong style={{ color: '#1A1A1A' }}>{startIndex + 1}</strong> to <strong style={{ color: '#1A1A1A' }}>{Math.min(startIndex + itemsPerPage, payments.length)}</strong> of <strong style={{ color: '#C58F3B' }}>{payments.length.toLocaleString()}</strong> transactions
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
    </div>
  )
}