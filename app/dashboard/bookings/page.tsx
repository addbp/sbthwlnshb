'use client'

// app/dashboard/bookings/page.tsx
// CLASSIC VERSION RESTORED: Limitless fetch from bookings_import
// LATEST FIRST: Ordered by ID descending
// NEW FEATURE: Smart Export to CSV 

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────
const BG = '#F9F4EB'
const BLACK = '#1A1A1A'
const GOLD = '#C58F3B'
const WHITE = '#FFFFFF'
const BODY = "'Inter', system-ui, sans-serif"
const DSP = "'Cormorant Garamond', Georgia, serif"

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function DashboardBookings() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'ALL' | 'SABBATH' | 'LE NAILS'>('ALL')

  // Pagination Configuration
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 100

  // ─── LIMITLESS UNROLLER: FETCH ALL FROM bookings_import ───
  const fetchRecords = async () => {
    setLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allRecords: any[] = [];
      let start = 0;
      const step = 1000;

      for (; ;) {
        const { data, error } = await supabase
          .from('bookings_import')
          .select('*')
          .order('id', { ascending: false }) // Ensures LATEST bookings show up FIRST
          .range(start, start + step - 1);

        if (error || !data || data.length === 0) break;
        allRecords.push(...data);
        if (data.length < step) break;
        start += step;
      }

      setRecords(allRecords)
    } catch (error) {
      console.error('Error fetching bookings:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecords()
  }, [])

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchQuery])

  // ─── FILTERING LOGIC (Search Bar + Tabs) ───
  const filteredRecords = records.filter(record => {
    const matchesSearch =
      (record.client_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (record.service?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (record.date?.toLowerCase() || '').includes(searchQuery.toLowerCase())

    const matchesTab =
      activeTab === 'ALL' ? true :
        (record.category?.toUpperCase() === activeTab)

    return matchesSearch && matchesTab
  })

  // Pagination Logic
  const totalPagesCount = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage))
  const offsetIndex = (currentPage - 1) * itemsPerPage
  const viewablePaginatedRows = filteredRecords.slice(offsetIndex, offsetIndex + itemsPerPage)

  // Format Currency safely
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatCurrency = (amount: any) => {
    const num = Number(String(amount).replace(/[^0-9.-]+/g, ''))
    return isNaN(num) || num === 0 ? '—' : `₱${num.toLocaleString('en-PH')}`
  }

  // ─── CSV EXPORT LOGIC ───
  const exportToCSV = () => {
    if (filteredRecords.length === 0) {
      alert("No records to export.");
      return;
    }

    // 1. Define Headers
    const headers = ['Date', 'Client', 'Service', 'Therapist', 'Category', 'Amount', 'Payment Method', 'Client Type'];

    // 2. Map Data to Rows (wrapped in quotes to prevent comma breaks)
    const csvRows = filteredRecords.map(r => {
      const amt = Number(String(r.amount || r.received_payment || r.service_amount || 0).replace(/[^0-9.-]+/g, ''));
      return [
        `"${r.date || ''}"`,
        `"${r.client_name || ''}"`,
        `"${r.service || ''}"`,
        `"${r.therapist || ''}"`,
        `"${r.category || ''}"`,
        `"${amt}"`,
        `"${r.payment_method || 'CASH'}"`,
        `"${r.customer_type || 'NEW CLIENT'}"`
      ].join(',');
    });

    // 3. Combine and Create Blob
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // 4. Trigger Download
    const link = document.createElement('a');
    link.href = url;
    const dateStamp = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `Sabbath_Bookings_${activeTab}_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div style={{ backgroundColor: BG, minHeight: '100vh', padding: '40px', fontFamily: BODY }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* HEADER SECTION */}
        <div style={{ borderBottom: '1px solid rgba(197,143,59,0.2)', paddingBottom: '20px', marginBottom: '30px' }}>
          <h1 style={{ fontFamily: DSP, fontSize: '32px', color: BLACK, margin: 0 }}>Bookings</h1>
        </div>

        {/* CONTROLS SECTION */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', color: GOLD, textTransform: 'uppercase', margin: '0 0 8px 0' }}>DATA LEDGER</p>
            <h2 style={{ fontFamily: DSP, fontSize: '28px', color: BLACK, margin: 0 }}>Bookings Log</h2>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={exportToCSV}
              disabled={loading || filteredRecords.length === 0}
              style={{
                padding: '12px 24px', backgroundColor: BLACK, border: 'none', borderRadius: '8px',
                color: GOLD, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                cursor: loading || filteredRecords.length === 0 ? 'not-allowed' : 'pointer',
                opacity: loading || filteredRecords.length === 0 ? 0.6 : 1, transition: 'all 0.2s ease'
              }}
            >
              ⬇ Export CSV
            </button>
            <button
              onClick={fetchRecords}
              disabled={loading}
              style={{
                padding: '12px 24px', backgroundColor: 'transparent', border: `1px solid ${GOLD}`, borderRadius: '8px',
                color: GOLD, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'all 0.2s ease'
              }}
            >
              {loading ? 'Refreshing...' : 'Refresh Records'}
            </button>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div style={{ marginBottom: '30px' }}>
          <input
            type="search"
            placeholder="Search by customer, date, or service string..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', maxWidth: '500px', padding: '14px 16px', borderRadius: '8px',
              border: '1px solid rgba(26,26,26,0.1)', backgroundColor: 'transparent',
              fontSize: '14px', color: BLACK, outline: 'none', fontFamily: BODY
            }}
          />
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: '30px', borderBottom: '1px solid rgba(26,26,26,0.1)', marginBottom: '20px' }}>
          {['ALL', 'SABBATH', 'LE NAILS'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              style={{
                background: 'none', border: 'none', padding: '0 0 12px 0', fontSize: '12px', fontWeight: 700,
                letterSpacing: '0.1em', color: activeTab === tab ? BLACK : 'rgba(26,26,26,0.4)',
                borderBottom: activeTab === tab ? `2px solid ${GOLD}` : '2px solid transparent',
                cursor: 'pointer', transition: 'all 0.2s ease'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* TABLE SECTION */}
        <div style={{ backgroundColor: WHITE, borderRadius: '12px', border: '1px solid rgba(26,26,26,0.08)', overflowX: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(249,244,235,0.5)', borderBottom: '1px solid rgba(26,26,26,0.08)' }}>
                <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>DATE</th>
                <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em' }}>CLIENT</th>
                <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em' }}>SERVICE</th>
                <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em' }}>THERAPIST</th>
                <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em' }}>CATEGORY</th>
                <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em' }}>AMOUNT</th>
                <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em' }}>PAYMENT METHOD</th>
                <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>CLIENT TYPE</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'rgba(26,26,26,0.5)' }}>Loading all history from database...</td>
                </tr>
              ) : viewablePaginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'rgba(26,26,26,0.5)' }}>No bookings found for this filter.</td>
                </tr>
              ) : (
                viewablePaginatedRows.map((record, index) => (
                  <tr key={record.id || index} style={{ borderBottom: '1px solid rgba(26,26,26,0.05)' }}>
                    <td style={{ padding: '16px 20px', color: 'rgba(26,26,26,0.7)', whiteSpace: 'nowrap' }}>{record.date || '—'}</td>
                    <td style={{ padding: '16px 20px', fontWeight: 600, color: BLACK }}>{record.client_name || '—'}</td>
                    <td style={{ padding: '16px 20px', color: 'rgba(26,26,26,0.8)', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {record.service || '—'}
                    </td>
                    <td style={{ padding: '16px 20px', color: 'rgba(26,26,26,0.7)' }}>{record.therapist || '—'}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        backgroundColor: record.category === 'LE NAILS' ? 'rgba(197,143,59,0.1)' : 'rgba(26,26,26,0.04)',
                        padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em',
                        color: record.category === 'LE NAILS' ? GOLD : BLACK
                      }}>
                        {record.category || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', fontWeight: 700, color: BLACK }}>{formatCurrency(record.amount || record.received_payment || record.service_amount)}</td>
                    <td style={{ padding: '16px 20px', color: 'rgba(26,26,26,0.7)' }}>{record.payment_method || 'CASH'}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        backgroundColor: record.customer_type === 'NEW CLIENT' ? 'rgba(61,122,74,0.1)' : 'rgba(26,26,26,0.04)',
                        color: record.customer_type === 'NEW CLIENT' ? '#3D7A4A' : '#666',
                        padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em'
                      }}>
                        {record.customer_type || 'NEW CLIENT'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        {!loading && filteredRecords.length > 0 && (
          <div style={{ padding: '16px 20px', backgroundColor: '#FDFCF8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, borderRadius: '0 0 12px 12px', borderRight: '1px solid rgba(26,26,26,0.08)', borderBottom: '1px solid rgba(26,26,26,0.08)', borderLeft: '1px solid rgba(26,26,26,0.08)' }}>
            <span style={{ fontSize: 13, color: '#666' }}>
              Showing <strong style={{ color: BLACK }}>{offsetIndex + 1}</strong> to <strong style={{ color: BLACK }}>{Math.min(offsetIndex + itemsPerPage, filteredRecords.length)}</strong> of <strong style={{ color: GOLD }}>{filteredRecords.length.toLocaleString()}</strong> records
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, backgroundColor: currentPage === 1 ? '#f5f5f5' : BLACK, color: currentPage === 1 ? '#aaa' : GOLD, border: 'none', borderRadius: 6, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }} onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>First</button>
              <button style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, backgroundColor: currentPage === 1 ? '#f5f5f5' : BLACK, color: currentPage === 1 ? '#aaa' : GOLD, border: 'none', borderRadius: 6, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>Prev</button>
              <span style={{ padding: '0 10px', fontSize: 13, fontWeight: 600, color: BLACK }}>Page {currentPage} of {totalPagesCount}</span>
              <button style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, backgroundColor: currentPage === totalPagesCount ? '#f5f5f5' : BLACK, color: currentPage === totalPagesCount ? '#aaa' : GOLD, border: 'none', borderRadius: 6, cursor: currentPage === totalPagesCount ? 'not-allowed' : 'pointer' }} onClick={() => setCurrentPage(prev => Math.min(totalPagesCount, prev + 1))} disabled={currentPage === totalPagesCount}>Next</button>
              <button style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, backgroundColor: currentPage === totalPagesCount ? '#f5f5f5' : BLACK, color: currentPage === totalPagesCount ? '#aaa' : GOLD, border: 'none', borderRadius: 6, cursor: currentPage === totalPagesCount ? 'not-allowed' : 'pointer' }} onClick={() => setCurrentPage(totalPagesCount)} disabled={currentPage === totalPagesCount}>Last</button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}