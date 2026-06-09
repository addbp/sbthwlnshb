'use client'

// app/dashboard/bookings/page.tsx
// Phase 41: Bookings Ledger (Strict System Creation Date Sort + Locked Dynamic Column Layout)
// FULLY EXPANDED FORMATTING PRESERVED

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
  if (val === null || val === undefined || val === '') return 0;
  return Number(String(val).replace(/[^0-9.-]+/g, '')) || 0;
}

function parseImportDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const clean = String(raw).trim();
  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]), 12, 0, 0);
  }

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
  branch: string;
  client_name: string;
  service: string;
  therapist: string;
  category: string;
  amount: number;
  discount_pct: number;
  payment_method: string;
  payment_status: string;
  ref_no: string;
  receipt_url: string;
  received_payment: number;
  customer_type?: string;
  additional_mins: number;
  additional_price: number;
  createdAt: string;
}

export default function DashboardBookings() {
  const [records, setRecords] = useState<UnifiedRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'ALL' | 'SABBATH' | 'LE NAILS'>('ALL')
  const [viewBranch, setViewBranch] = useState<string>('Sabbath Malolos')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 100

  // Client Modal State
  const [showModal, setShowModal] = useState(false)
  const [selectedClientName, setSelectedClientName] = useState('')
  const [selectedClientHistory, setSelectedClientHistory] = useState<UnifiedRecord[]>([])

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  // CSV Export Modal State
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportMode, setExportMode] = useState<'ALL' | 'RANGE'>('ALL')
  const [exportDateRange, setExportDateRange] = useState({ start: '', end: '' })

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
        const amt = parseCurrency(r.price || r.amount || r.service_amount || 0);
        const addMins = Number(r.additional_mins || 0);
        const addPrice = Number(r.additional_price || 0);

        const client = String(r.client_name || 'Guest').trim();
        const timeStr = String(r.appointment_time || '').trim();
        const parsedDate = parseImportDate(r.appointment_date || r.created_at);
        const standardDate = formatDateToYYYYMMDD(parsedDate);
        const service = String(r.service_name || r.service || '—');
        const branchAssigned = String(r.branch || 'Sabbath Malolos');

        const isNail = NAIL_KEYWORDS.some(k => service.toUpperCase().includes(k));
        const cat = isNail ? 'LE NAILS' : 'SABBATH';

        const key = `${client.toLowerCase()}-${amt}-${standardDate}-${timeStr}`;

        uniqueMap.set(key, {
          id: `live-${r.booking_id}`,
          rawDate: parsedDate,
          displayDate: formatDateToDDMMMYY(parsedDate),
          branch: branchAssigned,
          client_name: client,
          service: service,
          therapist: String(r.therapist_name || '—').toUpperCase(),
          category: cat,
          amount: amt,
          discount_pct: Number(r.discount_pct || 0),
          payment_method: String(r.payment_method || 'PAY AT COUNTER').toUpperCase(),
          payment_status: String(r.payment_status || 'UNPAID').toUpperCase(),
          ref_no: String(r.ref_no || ''),
          receipt_url: String(r.receipt_url || ''),
          received_payment: parseCurrency(r.received_payment || amt),
          additional_mins: addMins,
          additional_price: addPrice,
          createdAt: r.created_at || new Date().toISOString()
        });
      });

      // 2. Process Import Bookings
      importData.forEach(r => {
        const amt = parseCurrency(r.amount || r.received_payment || r.service_amount);
        const addMins = Number(r.additional_mins || 0);
        const addPrice = Number(r.additional_price || 0);

        const client = String(r.client_name || 'Guest').trim();
        const timeStr = String(r.time || r.appointment_time || '').trim();
        const parsedDate = parseImportDate(r.date || r.created_at);
        const standardDate = formatDateToYYYYMMDD(parsedDate);
        const service = String(r.service || '—');
        const branchAssigned = String(r.branch || 'Sabbath Malolos');

        const isNail = NAIL_KEYWORDS.some(k => service.toUpperCase().includes(k));
        const cat = isNail ? 'LE NAILS' : 'SABBATH';

        const key = `${client.toLowerCase()}-${amt}-${standardDate}-${timeStr}`;

        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, {
            id: `imp-${r.id}`,
            rawDate: parsedDate,
            displayDate: formatDateToDDMMMYY(parsedDate),
            branch: branchAssigned,
            client_name: client,
            service: service,
            therapist: String(r.therapist || '—').toUpperCase(),
            category: cat,
            amount: amt,
            discount_pct: Number(r.discount_pct || 0),
            payment_method: String(r.payment_method || 'CASH').toUpperCase(),
            payment_status: String(r.payment_status || 'PAID').toUpperCase(),
            ref_no: String(r.ref_no || ''),
            receipt_url: String(r.receipt_url || ''),
            received_payment: parseCurrency(r.received_payment || amt),
            additional_mins: addMins,
            additional_price: addPrice,
            createdAt: r.created_at || new Date().toISOString()
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
          r.customer_type = 'WALK-IN / GUEST'; // <-- TYPO FIXED HERE
        } else {
          r.customer_type = visitCounts[c] >= 2 ? 'RETURNING CLIENT' : 'NEW CLIENT';
        }
      });

      // 4. EXACT SORTING FIX: Appointment Date First -> Then Creation Date
      merged.sort((a, b) => {
        const dateA = a.rawDate?.getTime() || 0;
        const dateB = b.rawDate?.getTime() || 0;

        // 1. Sort by actual Appointment Date (June 9 above May 29)
        if (dateB !== dateA) {
          return dateB - dateA;
        }

        // 2. If same appointment date, sort by which was added to the system most recently
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

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
  }, [activeTab, searchQuery, viewBranch])

  // ─── FILTERING LOGIC ───
  const filteredRecords = records.filter(record => {
    const matchesSearch =
      (record.client_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (record.service?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (record.displayDate?.toLowerCase() || '').includes(searchQuery.toLowerCase())

    const matchesTab = activeTab === 'ALL' ? true : (record.category?.toUpperCase() === activeTab)
    const matchesBranch = record.branch === viewBranch;

    return matchesSearch && matchesTab && matchesBranch
  })

  const totalPagesCount = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage))
  const offsetIndex = (currentPage - 1) * itemsPerPage
  const viewablePaginatedRows = filteredRecords.slice(offsetIndex, offsetIndex + itemsPerPage)

  const formatCurrency = (amount: number) => amount === 0 ? '—' : `₱${amount.toLocaleString('en-PH')}`

  // ─── MODAL HANDLERS ───
  const openClientModal = (clientName: string) => {
    if (!clientName || clientName.toLowerCase() === 'guest' || clientName === '—') return;
    const history = records.filter(r => r.client_name.toLowerCase() === clientName.toLowerCase() && r.branch === viewBranch);
    setSelectedClientHistory(history);
    setSelectedClientName(clientName);
    setShowModal(true);
  }

  const openPaymentModal = (clientName: string) => {
    if (!clientName || clientName.toLowerCase() === 'guest' || clientName === '—') return;
    const history = records.filter(r => r.client_name.toLowerCase() === clientName.toLowerCase() && r.branch === viewBranch);
    setSelectedClientHistory(history);
    setSelectedClientName(clientName);
    setShowPaymentModal(true);
  }

  // ─── CSV EXPORT LOGIC WITH TOTALS ───
  const confirmCSVExport = () => {
    let dataToExport = filteredRecords;

    if (exportMode === 'RANGE') {
      if (!exportDateRange.start || !exportDateRange.end) {
        alert("Please select both a Start Date and an End Date.");
        return;
      }

      const startDate = new Date(exportDateRange.start);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(exportDateRange.end);
      endDate.setHours(23, 59, 59, 999);

      dataToExport = filteredRecords.filter(r => {
        if (!r.rawDate) return false;
        return r.rawDate >= startDate && r.rawDate <= endDate;
      });
    }

    if (dataToExport.length === 0) {
      alert("No records found in the selected date range.");
      return;
    }

    const headers = ['Date', 'Branch', 'Client', 'Service', 'Therapist', 'Category', 'Base Amount', 'Extra Mins', 'Surcharge Price', 'Total Amount', 'Payment Method', 'Payment Status', 'Client Type'];

    const csvRows = dataToExport.map(r => {
      const totalAmount = r.amount + (r.additional_price || 0);
      return [
        `"${r.displayDate}"`,
        `"${r.branch}"`,
        `"${r.client_name}"`,
        `"${r.service}"`,
        `"${r.therapist}"`,
        `"${r.category}"`,
        `"${r.amount}"`,
        `"${r.additional_mins}"`,
        `"${r.additional_price}"`,
        `"${totalAmount}"`,
        `"${r.payment_method}"`,
        `"${r.payment_status}"`,
        `"${r.customer_type}"`
      ].join(',')
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${viewBranch.replace(' ', '_')}_Bookings_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setShowExportModal(false);
  }

  return (
    <div style={{ backgroundColor: BG, minHeight: '100vh', padding: 'clamp(12px, 3vw, 30px)', fontFamily: BODY, boxSizing: 'border-box', overflowX: 'hidden' }}>
      <div style={{ maxWidth: '100%', margin: '0 auto', width: '100%' }}>

        {/* HEADER SECTION */}
        <div style={{ borderBottom: '1px solid rgba(197,143,59,0.2)', paddingBottom: '16px', marginBottom: '24px' }}>
          <h1 style={{ fontFamily: DSP, fontSize: '28px', color: BLACK, margin: 0 }}>Bookings Ledger</h1>
        </div>

        {/* CONTROLS SECTION */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', color: GOLD, textTransform: 'uppercase', margin: '0 0 6px 0' }}>DATA LEDGER</p>
            <h2 style={{ fontFamily: DSP, fontSize: '24px', color: BLACK, margin: 0 }}>Operations Log</h2>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setShowExportModal(true)}
              disabled={loading || filteredRecords.length === 0}
              style={{ padding: '10px 20px', backgroundColor: BLACK, border: 'none', borderRadius: '6px', color: GOLD, fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', cursor: loading || filteredRecords.length === 0 ? 'not-allowed' : 'pointer', opacity: loading || filteredRecords.length === 0 ? 0.6 : 1, transition: 'all 0.2s ease', whiteSpace: 'nowrap' }}
            >
              ⬇ Export CSV
            </button>
            <button
              onClick={fetchRecords}
              disabled={loading}
              style={{ padding: '10px 20px', backgroundColor: 'transparent', border: `1px solid ${GOLD}`, borderRadius: '6px', color: GOLD, fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'all 0.2s ease', whiteSpace: 'nowrap' }}
            >
              {loading ? 'Merging...' : 'Refresh Records'}
            </button>
          </div>
        </div>

        {/* ── BRANCH TOGGLE TABS ── */}
        <div style={{ display: 'flex', gap: 8, padding: '4px', backgroundColor: 'rgba(26,26,26,0.04)', borderRadius: 8, width: 'fit-content', marginBottom: '20px' }}>
          <button
            onClick={() => setViewBranch('Sabbath Malolos')}
            style={{ padding: '8px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 200ms ease', backgroundColor: viewBranch === 'Sabbath Malolos' ? WHITE : 'transparent', color: viewBranch === 'Sabbath Malolos' ? GOLD : '#666', boxShadow: viewBranch === 'Sabbath Malolos' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none', whiteSpace: 'nowrap' }}>
            Malolos Branch
          </button>
          <button
            onClick={() => setViewBranch('Sabbath Pulilan')}
            style={{ padding: '8px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 200ms ease', backgroundColor: viewBranch === 'Sabbath Pulilan' ? WHITE : 'transparent', color: viewBranch === 'Sabbath Pulilan' ? GOLD : '#666', boxShadow: viewBranch === 'Sabbath Pulilan' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none', whiteSpace: 'nowrap' }}>
            Pulilan Branch
          </button>
        </div>

        {/* SEARCH BAR */}
        <div style={{ marginBottom: '20px' }}>
          <input
            type="search"
            placeholder={`Search ${viewBranch} bookings by customer, date, or service...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', maxWidth: '400px', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(26,26,26,0.1)', backgroundColor: 'transparent', fontSize: '13px', color: BLACK, outline: 'none', fontFamily: BODY }}
          />
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid rgba(26,26,26,0.1)', marginBottom: '16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {['ALL', 'SABBATH', 'LE NAILS'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              style={{ background: 'none', border: 'none', padding: '0 0 10px 0', fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', color: activeTab === tab ? BLACK : 'rgba(26,26,26,0.4)', borderBottom: activeTab === tab ? `2px solid ${GOLD}` : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s ease', whiteSpace: 'nowrap' }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* TABLE SECTION WITH PERFECT CONTAINER LOCKED WIDTH */}
        <div style={{ width: '100%', backgroundColor: WHITE, borderRadius: '0 10px 10px 10px', border: '1px solid rgba(26,26,26,0.08)', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px', tableLayout: 'auto' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(249,244,235,0.5)', borderBottom: '1px solid rgba(26,26,26,0.08)' }}>
                <th style={{ padding: '12px 10px', color: GOLD, fontWeight: 700, letterSpacing: '0.05em', width: '10%' }}>DATE</th>
                <th style={{ padding: '12px 10px', color: GOLD, fontWeight: 700, letterSpacing: '0.05em', width: '15%' }}>CLIENT</th>
                <th style={{ padding: '12px 10px', color: GOLD, fontWeight: 700, letterSpacing: '0.05em', width: '22%' }}>SERVICE</th>
                <th style={{ padding: '12px 10px', color: GOLD, fontWeight: 700, letterSpacing: '0.05em', width: '13%' }}>THERAPIST</th>
                <th style={{ padding: '12px 10px', color: GOLD, fontWeight: 700, letterSpacing: '0.05em', width: '8%' }}>CATEGORY</th>
                <th style={{ padding: '12px 10px', color: GOLD, fontWeight: 700, letterSpacing: '0.05em', width: '8%' }}>TOTAL AMT</th>
                <th style={{ padding: '12px 10px', color: GOLD, fontWeight: 700, letterSpacing: '0.05em', width: '10%' }}>EXTENSIONS</th>
                <th style={{ padding: '12px 10px', color: GOLD, fontWeight: 700, letterSpacing: '0.05em', width: '10%' }}>PAYMENT</th>
                <th style={{ padding: '12px 10px', color: GOLD, fontWeight: 700, letterSpacing: '0.05em', width: '4%' }}>TYPE</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'rgba(26,26,26,0.5)', fontSize: '12px' }}>Merging live data with historical records...</td></tr>
              ) : viewablePaginatedRows.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'rgba(26,26,26,0.5)', fontSize: '12px' }}>No bookings found for {viewBranch}.</td></tr>
              ) : (
                viewablePaginatedRows.map((record) => {
                  const totalCombinedAmount = record.amount + (record.additional_price || 0);

                  return (
                    <tr key={record.id} style={{ borderBottom: '1px solid rgba(26,26,26,0.05)' }}>
                      <td style={{ padding: '12px 10px', color: 'rgba(26,26,26,0.7)' }}>{record.displayDate}</td>

                      {/* CLICKABLE CLIENT NAME */}
                      <td
                        onClick={() => openClientModal(record.client_name)}
                        style={{ padding: '12px 10px', fontWeight: 700, color: GOLD, cursor: 'pointer', textDecoration: 'underline', wordBreak: 'break-all' }}
                      >
                        {record.client_name}
                      </td>

                      <td style={{ padding: '12px 10px', color: 'rgba(26,26,26,0.8)', wordBreak: 'break-word' }}>{record.service}</td>
                      <td style={{ padding: '12px 10px', color: 'rgba(26,26,26,0.7)', wordBreak: 'break-all' }}>{record.therapist}</td>
                      <td style={{ padding: '12px 10px' }}>
                        <span style={{ backgroundColor: record.category === 'LE NAILS' ? 'rgba(197,143,59,0.1)' : 'rgba(26,26,26,0.04)', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em', color: record.category === 'LE NAILS' ? GOLD : BLACK }}>
                          {record.category === 'LE NAILS' ? 'NAILS' : 'SPA'}
                        </span>
                      </td>

                      {/* TOTAL AMOUNT (BASE + SURCHARGE) */}
                      <td style={{ padding: '12px 10px', fontWeight: 700, color: BLACK }}>
                        {formatCurrency(totalCombinedAmount)}
                      </td>

                      {/* EXTENSIONS COLUMN */}
                      <td style={{ padding: '12px 10px', color: BLACK }}>
                        {record.additional_mins > 0 || record.additional_price > 0 ? (
                          <span style={{ backgroundColor: 'rgba(197,143,59,0.1)', color: GOLD, fontWeight: 700, fontSize: 10, padding: '2px 4px', borderRadius: 4, display: 'inline-block' }}>
                            +{record.additional_mins}m / +₱{record.additional_price}
                          </span>
                        ) : (
                          <span style={{ color: '#aaa' }}>—</span>
                        )}
                      </td>

                      {/* CLICKABLE PAYMENT METHOD */}
                      <td
                        onClick={() => openPaymentModal(record.client_name)}
                        style={{ padding: '12px 10px', color: GOLD, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        {record.payment_method}
                      </td>

                      <td style={{ padding: '12px 10px' }}>
                        <span style={{ display: 'inline-block', backgroundColor: record.customer_type === 'NEW CLIENT' ? 'rgba(61,122,74,0.1)' : 'rgba(197,143,59,0.1)', color: record.customer_type === 'NEW CLIENT' ? '#3D7A4A' : '#C58F3B', padding: '2px 4px', borderRadius: '4px', fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                          {record.customer_type === 'NEW CLIENT' ? 'NEW' : 'RET'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        {!loading && filteredRecords.length > 0 && (
          <div style={{ padding: '12px 16px', backgroundColor: '#FDFCF8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, borderRadius: '0 0 10px 10px', borderRight: '1px solid rgba(26,26,26,0.08)', borderBottom: '1px solid rgba(26,26,26,0.08)', borderLeft: '1px solid rgba(26,26,26,0.08)' }}>
            <span style={{ fontSize: 12, color: '#666' }}>
              Showing <strong>{offsetIndex + 1}</strong> to <strong>{Math.min(offsetIndex + itemsPerPage, filteredRecords.length)}</strong> of <strong style={{ color: GOLD }}>{filteredRecords.length.toLocaleString()}</strong> records
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, backgroundColor: currentPage === 1 ? '#f5f5f5' : BLACK, color: currentPage === 1 ? '#aaa' : GOLD, border: 'none', borderRadius: 4, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }} onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>First</button>
              <button style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, backgroundColor: currentPage === 1 ? '#f5f5f5' : BLACK, color: currentPage === 1 ? '#aaa' : GOLD, border: 'none', borderRadius: 4, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>Prev</button>
              <span style={{ padding: '0 6px', fontSize: 12, fontWeight: 600, color: BLACK }}>Page {currentPage} of {totalPagesCount}</span>
              <button style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, backgroundColor: currentPage === totalPagesCount ? '#f5f5f5' : BLACK, color: currentPage === totalPagesCount ? '#aaa' : GOLD, border: 'none', borderRadius: 4, cursor: currentPage === totalPagesCount ? 'not-allowed' : 'pointer' }} onClick={() => setCurrentPage(prev => Math.min(totalPagesCount, prev + 1))} disabled={currentPage === totalPagesCount}>Next</button>
              <button style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, backgroundColor: currentPage === totalPagesCount ? '#f5f5f5' : BLACK, color: currentPage === totalPagesCount ? '#aaa' : GOLD, border: 'none', borderRadius: 4, cursor: currentPage === totalPagesCount ? 'not-allowed' : 'pointer' }} onClick={() => setCurrentPage(totalPagesCount)} disabled={currentPage === totalPagesCount}>Last</button>
            </div>
          </div>
        )}

        {/* ─── CLIENT HISTORY POPUP MODAL ─── */}
        {showModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: WHITE, borderRadius: '12px', width: '100%', maxWidth: '800px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', overflow: 'hidden' }}>

              <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(26,26,26,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#FDFCF8' }}>
                <div>
                  <p style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.15em', color: GOLD, textTransform: 'uppercase', margin: '0 0 6px 0' }}>CLIENT PROFILE ({viewBranch})</p>
                  <h2 style={{ fontFamily: DSP, fontSize: '28px', color: BLACK, margin: 0 }}>{selectedClientName}</h2>
                </div>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', color: '#666', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
              </div>

              <div style={{ display: 'flex', gap: '16px', padding: '16px 24px', backgroundColor: WHITE, borderBottom: '1px solid rgba(26,26,26,0.05)' }}>
                <div style={{ flex: 1, padding: '12px', backgroundColor: 'rgba(197,143,59,0.05)', borderRadius: '8px', border: '1px solid rgba(197,143,59,0.1)' }}>
                  <p style={{ fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.1em', margin: '0 0 6px 0' }}>TOTAL VISITS</p>
                  <p style={{ fontSize: '20px', fontWeight: 700, color: BLACK, margin: 0 }}>{selectedClientHistory.length}</p>
                </div>
                <div style={{ flex: 1, padding: '12px', backgroundColor: 'rgba(61,122,74,0.05)', borderRadius: '8px', border: '1px solid rgba(61,122,74,0.1)' }}>
                  <p style={{ fontSize: '9px', fontWeight: 700, color: '#3D7A4A', letterSpacing: '0.1em', margin: '0 0 6px 0' }}>LIFETIME SPENT</p>
                  <p style={{ fontSize: '20px', fontWeight: 700, color: BLACK, margin: 0 }}>
                    {formatCurrency(selectedClientHistory.reduce((acc, r) => acc + ((r.amount || 0) + (r.additional_price || 0)), 0))}
                  </p>
                </div>
              </div>

              <div style={{ overflowY: 'auto', padding: '0 24px 24px 24px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: BLACK, marginBottom: '12px', marginTop: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Service History</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid rgba(26,26,26,0.1)' }}>
                      <th style={{ padding: '10px 0', color: '#666', fontWeight: 600 }}>Date</th>
                      <th style={{ padding: '10px 0', color: '#666', fontWeight: 600 }}>Service</th>
                      <th style={{ padding: '10px 0', color: '#666', fontWeight: 600 }}>Therapist</th>
                      <th style={{ padding: '10px 0', color: BLACK, fontWeight: 700, textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedClientHistory.map((h, i) => (
                      <tr key={h.id || i} style={{ borderBottom: '1px solid rgba(26,26,26,0.05)' }}>
                        <td style={{ padding: '12px 0', color: BLACK, fontWeight: 600 }}>{h.displayDate}</td>
                        <td style={{ padding: '12px 0', color: '#666' }}>{h.service}</td>
                        <td style={{ padding: '12px 0', color: '#666' }}>{h.therapist}</td>
                        <td style={{ padding: '12px 0', color: BLACK, fontWeight: 700, textAlign: 'right' }}>{formatCurrency((h.amount || 0) + (h.additional_price || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        )}

        {/* ─── PAYMENT DETAILS & HISTORY POPUP MODAL ─── */}
        {showPaymentModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: WHITE, borderRadius: '12px', width: '100%', maxWidth: '850px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', overflow: 'hidden' }}>

              <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(26,26,26,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#FDFCF8' }}>
                <div>
                  <p style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.15em', color: GOLD, textTransform: 'uppercase', margin: '0 0 6px 0' }}>PAYMENT PROFILE & HISTORY</p>
                  <h2 style={{ fontFamily: DSP, fontSize: '28px', color: BLACK, margin: 0 }}>{selectedClientName}</h2>
                </div>
                <button onClick={() => setShowPaymentModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', color: '#666', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
              </div>

              <div style={{ overflowY: 'auto', padding: '0 24px 24px 24px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px', marginTop: '16px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid rgba(26,26,26,0.1)' }}>
                      <th style={{ padding: '10px 0', color: '#666', fontWeight: 600 }}>Date</th>
                      <th style={{ padding: '10px 0', color: '#666', fontWeight: 600 }}>Service</th>
                      <th style={{ padding: '10px 0', color: '#666', fontWeight: 600 }}>Net Amt</th>
                      <th style={{ padding: '10px 0', color: '#666', fontWeight: 600 }}>Paid</th>
                      <th style={{ padding: '10px 0', color: '#666', fontWeight: 600 }}>Method</th>
                      <th style={{ padding: '10px 0', color: '#666', fontWeight: 600 }}>Ref / Receipt</th>
                      <th style={{ padding: '10px 0', color: '#666', fontWeight: 600 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedClientHistory.map((h, i) => {
                      const net = (h.amount + (h.additional_price || 0)) * (1 - (h.discount_pct / 100));
                      return (
                        <tr key={h.id || i} style={{ borderBottom: '1px solid rgba(26,26,26,0.05)' }}>
                          <td style={{ padding: '12px 0', color: BLACK, fontWeight: 600, whiteSpace: 'nowrap' }}>{h.displayDate}</td>
                          <td style={{ padding: '12px 0', color: '#666' }}>{h.service}</td>
                          <td style={{ padding: '12px 0', color: BLACK, fontWeight: 700 }}>{formatCurrency(net)}</td>
                          <td style={{ padding: '12px 0', color: '#3D7A4A', fontWeight: 700 }}>{formatCurrency(h.received_payment)}</td>
                          <td style={{ padding: '12px 0', color: BLACK, fontWeight: 600 }}>{h.payment_method}</td>
                          <td style={{ padding: '12px 0', color: '#666', fontSize: 11 }}>
                            {h.ref_no ? <div style={{ marginBottom: 4 }}>Ref: {h.ref_no}</div> : null}
                            {h.receipt_url ? <a href={h.receipt_url} target="_blank" rel="noreferrer" style={{ color: GOLD, fontWeight: 700, textDecoration: 'underline' }}>View Receipt</a> : null}
                            {!h.ref_no && !h.receipt_url ? '—' : null}
                          </td>
                          <td style={{ padding: '12px 0' }}>
                            <span style={{
                              display: 'inline-block', whiteSpace: 'nowrap',
                              backgroundColor: h.payment_status === 'PAID' ? 'rgba(61,122,74,0.1)' : 'rgba(200,50,50,0.1)',
                              color: h.payment_status === 'PAID' ? '#3D7A4A' : '#C83232',
                              padding: '4px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700
                            }}>
                              {h.payment_status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        )}

        {/* ─── CSV EXPORT FILTER MODAL ─── */}
        {showExportModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: WHITE, borderRadius: '12px', width: '100%', maxWidth: '400px', padding: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>

              <h2 style={{ fontFamily: DSP, fontSize: '22px', color: BLACK, margin: '0 0 12px 0' }}>Export CSV</h2>
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '20px', lineHeight: 1.5 }}>
                Choose how much data you want to download from your <strong>{viewBranch}</strong> ledger.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: BLACK, cursor: 'pointer' }}>
                  <input type="radio" checked={exportMode === 'ALL'} onChange={() => setExportMode('ALL')} style={{ accentColor: GOLD, width: '16px', height: '16px' }} />
                  All Time Data
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: BLACK, cursor: 'pointer' }}>
                  <input type="radio" checked={exportMode === 'RANGE'} onChange={() => setExportMode('RANGE')} style={{ accentColor: GOLD, width: '16px', height: '16px' }} />
                  Filter by Date Range
                </label>
              </div>

              {exportMode === 'RANGE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '6px', border: '1px solid rgba(26,26,26,0.05)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: BLACK, marginBottom: '4px', letterSpacing: '0.05em' }}>START DATE</label>
                    <input type="date" min="2025-05-01" value={exportDateRange.start} onChange={e => setExportDateRange({ ...exportDateRange, start: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid rgba(26,26,26,0.15)', fontFamily: BODY, outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: BLACK, marginBottom: '4px', letterSpacing: '0.05em' }}>END DATE</label>
                    <input type="date" min="2025-05-01" value={exportDateRange.end} onChange={e => setExportDateRange({ ...exportDateRange, end: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: '4px', border: '1px solid rgba(26,26,26,0.15)', fontFamily: BODY, outline: 'none' }} />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: exportMode === 'ALL' ? '24px' : '8px' }}>
                <button onClick={() => setShowExportModal(false)} style={{ padding: '10px 16px', backgroundColor: 'transparent', border: 'none', color: '#666', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button onClick={confirmCSVExport} style={{ padding: '10px 20px', backgroundColor: BLACK, border: 'none', borderRadius: '6px', color: GOLD, fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Download Data</button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  )
}