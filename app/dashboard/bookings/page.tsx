'use client'

// app/dashboard/bookings/page.tsx
// ULTIMATE OMNI-FETCH VERSION
// Features: Dual-Table Merge, Smart Returning Client Logic, Client History Popup, CSV Export

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
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

// ─── UTILITIES ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCurrency(val: any): number {
  if (!val) return 0;
  return Number(String(val).replace(/[^0-9.-]+/g, '')) || 0;
}

function parseImportDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const clean = String(raw).trim();
  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]), 12, 0, 0);
  const dashMatch = clean.match(/^(\d{1,2})[-\s/]+([A-Za-z]{3,})[-\s/]+(\d{2,4})$/);
  if (dashMatch) {
    let year = dashMatch[3];
    if (year.length === 2) year = '20' + year;
    const d = new Date(`${dashMatch[2]} ${dashMatch[1]}, ${year}`);
    if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  }
  const fallback = new Date(clean);
  if (!isNaN(fallback.getTime())) return fallback;
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

const NAIL_KEYWORDS = ['MANICURE', 'PEDICURE', 'FOOT SPA', 'FOOT MASSAGE', 'FOOT PARAFFIN', 'HAND PARAFFIN', 'MANIGEL', 'ORLY', 'GEL POLISH', 'RHINESTONES', 'NAIL ART', 'GEL REMOVAL', 'POLISH', 'NAILS'];

interface UnifiedRecord {
  id: string;
  rawDate: Date | null;
  displayDate: string;
  client_name: string;
  service: string;
  therapist: string;
  category: string;
  amount: number;
  payment_method: string;
  customer_type?: string;
}

export default function DashboardBookings() {
  const [records, setRecords] = useState<UnifiedRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'ALL' | 'SABBATH' | 'LE NAILS'>('ALL')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 100

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [selectedClientName, setSelectedClientName] = useState('')
  const [selectedClientHistory, setSelectedClientHistory] = useState<UnifiedRecord[]>([])

  // ─── LIMITLESS OMNI-FETCHER (MERGES BOTH TABLES) ───
  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const fetchUnlimited = async (tableName: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allRecords: any[] = [];
        let start = 0;
        const step = 1000;
        for (; ;) {
          const { data, error } = await supabase.from(tableName).select('*').range(start, start + step - 1);
          if (error || !data || data.length === 0) break;
          allRecords.push(...data);
          if (data.length < step) break;
          start += step;
        }
        return allRecords;
      };

      const [liveData, importData] = await Promise.all([
        fetchUnlimited('bookings'),
        fetchUnlimited('bookings_import')
      ]);

      const uniqueMap = new Map<string, UnifiedRecord>();

      // 1. Process Live Bookings
      liveData.forEach(r => {
        const client = String(r.client_name || 'Guest').trim();
        const amt = parseCurrency(r.price || r.amount || r.received_payment);
        const parsedDate = parseImportDate(r.appointment_date || r.created_at);
        const standardDate = formatDateToYYYYMMDD(parsedDate);
        const timeStr = String(r.appointment_time || '').trim();
        const service = String(r.service_name || r.service || '—');

        const isNail = NAIL_KEYWORDS.some(k => service.toUpperCase().includes(k));
        const cat = isNail ? 'LE NAILS' : 'SABBATH';

        const key = `${client.toLowerCase()}-${amt}-${standardDate}-${timeStr}`;
        uniqueMap.set(key, {
          id: `live-${r.booking_id}`,
          rawDate: parsedDate,
          displayDate: formatDateToDDMMMYY(parsedDate),
          client_name: client,
          service: service,
          therapist: String(r.therapist_name || '—').toUpperCase(),
          category: cat,
          amount: amt,
          payment_method: String(r.payment_method || 'PAY AT COUNTER').toUpperCase()
        });
      });

      // 2. Process Import Bookings
      importData.forEach(r => {
        const client = String(r.client_name || 'Guest').trim();
        const amt = parseCurrency(r.amount || r.received_payment || r.service_amount);
        const parsedDate = parseImportDate(r.date || r.created_at);
        const standardDate = formatDateToYYYYMMDD(parsedDate);
        const timeStr = String(r.time || r.appointment_time || '').trim();
        const service = String(r.service || '—');

        const isNail = NAIL_KEYWORDS.some(k => service.toUpperCase().includes(k));
        const cat = isNail ? 'LE NAILS' : 'SABBATH';

        const key = `${client.toLowerCase()}-${amt}-${standardDate}-${timeStr}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, {
            id: `imp-${r.id}`,
            rawDate: parsedDate,
            displayDate: formatDateToDDMMMYY(parsedDate),
            client_name: client,
            service: service,
            therapist: String(r.therapist || '—').toUpperCase(),
            category: cat,
            amount: amt,
            payment_method: String(r.payment_method || 'CASH').toUpperCase()
          });
        }
      });

      const merged = Array.from(uniqueMap.values());

      // 3. Smart Retention Logic (>= 2 visits = Returning Client)
      const visitCounts: Record<string, number> = {};
      merged.forEach(r => {
        const c = r.client_name.toLowerCase();
        if (c && c !== 'guest' && c !== '—') {
          visitCounts[c] = (visitCounts[c] || 0) + 1;
        }
      });

      merged.forEach(r => {
        const c = r.client_name.toLowerCase();
        if (!c || c === 'guest' || c === '—') {
          r.customer_type = 'WALK-IN / GUEST';
        } else {
          r.customer_type = visitCounts[c] >= 2 ? 'RETURNING CLIENT' : 'NEW CLIENT';
        }
      });

      // 4. Sort Latest First
      merged.sort((a, b) => (b.rawDate?.getTime() || 0) - (a.rawDate?.getTime() || 0));

      setRecords(merged);
    } catch (error) {
      console.error('Error fetching bookings:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchQuery])

  // ─── MODAL HANDLER ───
  const openClientModal = (clientName: string) => {
    if (!clientName || clientName.toLowerCase() === 'guest' || clientName === '—') return;
    const history = records.filter(r => r.client_name.toLowerCase() === clientName.toLowerCase());
    setSelectedClientHistory(history);
    setSelectedClientName(clientName);
    setShowModal(true);
  }

  // ─── FILTERING LOGIC ───
  const filteredRecords = records.filter(record => {
    const matchesSearch =
      (record.client_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (record.service?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (record.displayDate?.toLowerCase() || '').includes(searchQuery.toLowerCase())

    const matchesTab = activeTab === 'ALL' ? true : (record.category?.toUpperCase() === activeTab)
    return matchesSearch && matchesTab
  })

  const totalPagesCount = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage))
  const offsetIndex = (currentPage - 1) * itemsPerPage
  const viewablePaginatedRows = filteredRecords.slice(offsetIndex, offsetIndex + itemsPerPage)

  const formatCurrency = (amount: number) => amount === 0 ? '—' : `₱${amount.toLocaleString('en-PH')}`

  // ─── CSV EXPORT ───
  const exportToCSV = () => {
    if (filteredRecords.length === 0) return alert("No records to export.");
    const headers = ['Date', 'Client', 'Service', 'Therapist', 'Category', 'Amount', 'Payment Method', 'Client Type'];
    const csvRows = filteredRecords.map(r => [
      `"${r.displayDate}"`, `"${r.client_name}"`, `"${r.service}"`, `"${r.therapist}"`,
      `"${r.category}"`, `"${r.amount}"`, `"${r.payment_method}"`, `"${r.customer_type}"`
    ].join(','));

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Sabbath_Bookings_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
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
            <button onClick={exportToCSV} disabled={loading || filteredRecords.length === 0} style={{ padding: '12px 24px', backgroundColor: BLACK, border: 'none', borderRadius: '8px', color: GOLD, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: loading || filteredRecords.length === 0 ? 'not-allowed' : 'pointer', opacity: loading || filteredRecords.length === 0 ? 0.6 : 1, transition: 'all 0.2s ease' }}>
              ⬇ Export CSV
            </button>
            <button onClick={fetchRecords} disabled={loading} style={{ padding: '12px 24px', backgroundColor: 'transparent', border: `1px solid ${GOLD}`, borderRadius: '8px', color: GOLD, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'all 0.2s ease' }}>
              {loading ? 'Merging...' : 'Refresh Records'}
            </button>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div style={{ marginBottom: '30px' }}>
          <input type="search" placeholder="Search by customer, date, or service string..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', maxWidth: '500px', padding: '14px 16px', borderRadius: '8px', border: '1px solid rgba(26,26,26,0.1)', backgroundColor: 'transparent', fontSize: '14px', color: BLACK, outline: 'none', fontFamily: BODY }} />
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: '30px', borderBottom: '1px solid rgba(26,26,26,0.1)', marginBottom: '20px' }}>
          {['ALL', 'SABBATH', 'LE NAILS'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} style={{ background: 'none', border: 'none', padding: '0 0 12px 0', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: activeTab === tab ? BLACK : 'rgba(26,26,26,0.4)', borderBottom: activeTab === tab ? `2px solid ${GOLD}` : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s ease' }}>
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
                <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'rgba(26,26,26,0.5)' }}>Merging live data with historical records...</td></tr>
              ) : viewablePaginatedRows.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'rgba(26,26,26,0.5)' }}>No bookings found for this filter.</td></tr>
              ) : (
                viewablePaginatedRows.map((record) => (
                  <tr key={record.id} style={{ borderBottom: '1px solid rgba(26,26,26,0.05)' }}>
                    <td style={{ padding: '16px 20px', color: 'rgba(26,26,26,0.7)', whiteSpace: 'nowrap' }}>{record.displayDate}</td>

                    {/* CLICKABLE CLIENT NAME */}
                    <td
                      onClick={() => openClientModal(record.client_name)}
                      style={{ padding: '16px 20px', fontWeight: 700, color: GOLD, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      {record.client_name}
                    </td>

                    <td style={{ padding: '16px 20px', color: 'rgba(26,26,26,0.8)', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{record.service}</td>
                    <td style={{ padding: '16px 20px', color: 'rgba(26,26,26,0.7)' }}>{record.therapist}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ backgroundColor: record.category === 'LE NAILS' ? 'rgba(197,143,59,0.1)' : 'rgba(26,26,26,0.04)', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', color: record.category === 'LE NAILS' ? GOLD : BLACK }}>
                        {record.category}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', fontWeight: 700, color: BLACK }}>{formatCurrency(record.amount)}</td>
                    <td style={{ padding: '16px 20px', color: 'rgba(26,26,26,0.7)' }}>{record.payment_method}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ backgroundColor: record.customer_type === 'NEW CLIENT' ? 'rgba(61,122,74,0.1)' : 'rgba(197,143,59,0.1)', color: record.customer_type === 'NEW CLIENT' ? '#3D7A4A' : '#C58F3B', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em' }}>
                        {record.customer_type}
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

        {/* ─── CLIENT HISTORY POPUP MODAL ─── */}
        {showModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: WHITE, borderRadius: '16px', width: '100%', maxWidth: '800px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', overflow: 'hidden' }}>

              {/* Modal Header */}
              <div style={{ padding: '24px 30px', borderBottom: '1px solid rgba(26,26,26,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#FDFCF8' }}>
                <div>
                  <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', color: GOLD, textTransform: 'uppercase', margin: '0 0 8px 0' }}>CLIENT PROFILE</p>
                  <h2 style={{ fontFamily: DSP, fontSize: '32px', color: BLACK, margin: 0 }}>{selectedClientName}</h2>
                </div>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '28px', color: '#666', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
              </div>

              {/* Client Stats Summary */}
              <div style={{ display: 'flex', gap: '20px', padding: '20px 30px', backgroundColor: WHITE, borderBottom: '1px solid rgba(26,26,26,0.05)' }}>
                <div style={{ flex: 1, padding: '16px', backgroundColor: 'rgba(197,143,59,0.05)', borderRadius: '12px', border: '1px solid rgba(197,143,59,0.1)' }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, color: GOLD, letterSpacing: '0.1em', margin: '0 0 8px 0' }}>TOTAL VISITS</p>
                  <p style={{ fontSize: '24px', fontWeight: 700, color: BLACK, margin: 0 }}>{selectedClientHistory.length}</p>
                </div>
                <div style={{ flex: 1, padding: '16px', backgroundColor: 'rgba(61,122,74,0.05)', borderRadius: '12px', border: '1px solid rgba(61,122,74,0.1)' }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#3D7A4A', letterSpacing: '0.1em', margin: '0 0 8px 0' }}>LIFETIME SPENT</p>
                  <p style={{ fontSize: '24px', fontWeight: 700, color: BLACK, margin: 0 }}>
                    {formatCurrency(selectedClientHistory.reduce((acc, r) => acc + (r.amount || 0), 0))}
                  </p>
                </div>
              </div>

              {/* History Table */}
              <div style={{ overflowY: 'auto', padding: '0 30px 30px 30px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: BLACK, marginBottom: '16px', marginTop: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Service History</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid rgba(26,26,26,0.1)' }}>
                      <th style={{ padding: '12px 0', color: '#666', fontWeight: 600 }}>Date</th>
                      <th style={{ padding: '12px 0', color: '#666', fontWeight: 600 }}>Service</th>
                      <th style={{ padding: '12px 0', color: '#666', fontWeight: 600 }}>Therapist</th>
                      <th style={{ padding: '12px 0', color: '#666', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedClientHistory.map((h, i) => (
                      <tr key={h.id || i} style={{ borderBottom: '1px solid rgba(26,26,26,0.05)' }}>
                        <td style={{ padding: '16px 0', color: BLACK, fontWeight: 600 }}>{h.displayDate}</td>
                        <td style={{ padding: '16px 0', color: '#666' }}>{h.service}</td>
                        <td style={{ padding: '16px 0', color: '#666' }}>{h.therapist}</td>
                        <td style={{ padding: '16px 0', color: BLACK, fontWeight: 700, textAlign: 'right' }}>{formatCurrency(h.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  )
}