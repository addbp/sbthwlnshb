'use client'

// app/dashboard/payments/page.tsx
// Phase 30: High-Security Payments Ledger (Strict PIN 061026, Auto-Locking Revenue, Pagination Lock)

/* eslint-disable @typescript-eslint/no-explicit-any */

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

// ─── INTERFACES ───
interface FinancialRecord {
  _key: string;
  id: string | null;
  rawId: string | null;
  isLive: boolean;
  rawDate: Date | null;
  displayDate: string;
  client: string;
  service: string;
  amount: number;
  discount_pct: number;
  net_sales: number;
  received: number;
  modeOfPayment: string;
  payment_status: string;
  ref_no: string;
  receipt_url: string;
  clientType: string;
}

interface Membership { id: string; client_name: string; membership_tier: string; discount_percentage: number }

export default function PaymentsPage() {
  const supabase = useRef(createClient()).current
  const [payments, setPayments] = useState<FinancialRecord[]>([])
  const [activeMemberships, setActiveMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(true)

  // ─── DYNAMIC PIN SECURITY STATE ───
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)

  // ─── POS / CASHIER STATES ───
  const [editingReceivedId, setEditingReceivedId] = useState<string | null>(null)
  const [receivedInput, setReceivedInput] = useState('')

  // Modals
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false)
  const [showClientModal, setShowClientModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  const [selectedPayment, setSelectedPayment] = useState<FinancialRecord | null>(null)
  const [selectedClientHistory, setSelectedClientHistory] = useState<FinancialRecord[]>([])
  const [applyDiscount, setApplyDiscount] = useState(false)
  const [detectedMembership, setDetectedMembership] = useState<Membership | null>(null)

  // Pagination Configuration
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 100

  // ─── LIMITLESS PAGINATION UNROLLING ENGINE ───
  const loadPayments = useCallback(async () => {
    setLoading(true)
    // Lock the revenue on manual refresh
    setIsUnlocked(false)
    const PAGE_SIZE = 1000
    const allMemberships: Membership[] = []

    try {
      // 1. Fetch Memberships
      let fromMem = 0
      for (; ;) {
        const { data, error } = await supabase.from('memberships').select('id, client_name, membership_tier, discount_percentage').eq('status', 'Active').range(fromMem, fromMem + PAGE_SIZE - 1)
        if (error || !data || data.length === 0) break
        allMemberships.push(...(data as Membership[]))
        if (data.length < PAGE_SIZE) break
        fromMem += PAGE_SIZE
      }
      setActiveMemberships(allMemberships)

      // 2. Fetch Live Bookings
      const uniqueMap = new Map<string, FinancialRecord>();
      let fromLive = 0
      for (; ;) {
        const { data, error } = await supabase.from('bookings').select('*').range(fromLive, fromLive + PAGE_SIZE - 1)
        if (error || !data || data.length === 0) break

        data.forEach((r: any) => {
          const amt = parseCurrency(r.price || r.amount || r.service_amount || 0);
          const disc = Number(r.discount_pct || 0);
          const net = amt * (1 - (disc / 100));
          const client = String(r.client_name || 'Guest').trim();
          const timeStr = String(r.appointment_time || '').trim();
          const parsedDate = parseImportDate(r.appointment_date || r.created_at);
          const standardDate = formatDateToYYYYMMDD(parsedDate);
          const key = `${client.toLowerCase()}-${amt}-${standardDate}-${timeStr}`;

          uniqueMap.set(key, {
            _key: `live-${r.booking_id}`,
            id: r.booking_id,
            rawId: r.booking_id,
            isLive: true,
            rawDate: parsedDate,
            displayDate: formatDateToDDMMMYY(parsedDate),
            client: client,
            service: String(r.service_name || r.service || '—'),
            amount: amt,
            discount_pct: disc,
            net_sales: net,
            received: parseCurrency(r.received_payment || amt),
            modeOfPayment: String(r.payment_method || 'PAY AT COUNTER').toUpperCase(),
            payment_status: String(r.payment_status || 'UNPAID').toUpperCase(),
            ref_no: String(r.ref_no || ''),
            receipt_url: String(r.receipt_url || ''),
            clientType: '—'
          });
        })
        if (data.length < PAGE_SIZE) break
        fromLive += PAGE_SIZE
      }

      // 3. Fetch Import Bookings
      let fromHist = 0
      for (; ;) {
        const { data, error } = await supabase.from('bookings_import').select('*').range(fromHist, fromHist + PAGE_SIZE - 1)
        if (error || !data || data.length === 0) break

        data.forEach((r: any) => {
          const amt = parseCurrency(r.amount || r.received_payment || r.service_amount);
          const disc = Number(r.discount_pct || 0);
          const net = amt * (1 - (disc / 100));
          const client = String(r.client_name || 'Guest').trim();
          const timeStr = String(r.time || r.appointment_time || '').trim();
          const parsedDate = parseImportDate(r.date || r.created_at);
          const standardDate = formatDateToYYYYMMDD(parsedDate);
          const key = `${client.toLowerCase()}-${amt}-${standardDate}-${timeStr}`;

          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, {
              _key: `imp-${r.id}`,
              id: null,
              rawId: r.id,
              isLive: false,
              rawDate: parsedDate,
              displayDate: formatDateToDDMMMYY(parsedDate),
              client: client,
              service: String(r.service || '—'),
              amount: amt,
              discount_pct: disc,
              net_sales: net,
              received: parseCurrency(r.received_payment || amt),
              modeOfPayment: String(r.payment_method || 'CASH').toUpperCase(),
              payment_status: String(r.payment_status || 'PAID').toUpperCase(),
              ref_no: String(r.ref_no || ''),
              receipt_url: String(r.receipt_url || ''),
              clientType: '—'
            });
          }
        })
        if (data.length < PAGE_SIZE) break
        fromHist += PAGE_SIZE
      }

      const all = Array.from(uniqueMap.values());

      // 4. Retention Logic
      all.sort((a, b) => (a.rawDate?.getTime() || 0) - (b.rawDate?.getTime() || 0))
      const visitCounter = new Map<string, number>()
      all.forEach(p => {
        const nameKey = p.client.toLowerCase().trim()
        if (!nameKey || nameKey === 'guest' || nameKey === '—') {
          p.clientType = 'WALK-IN / GUEST'
          return
        }
        const visits = visitCounter.get(nameKey) || 0
        p.clientType = visits === 0 ? 'NEW CLIENT' : 'RETURNING CLIENT'
        visitCounter.set(nameKey, visits + 1)
      })

      // 5. Reverse Chronological
      all.sort((a, b) => (b.rawDate?.getTime() || 0) - (a.rawDate?.getTime() || 0))
      setPayments(all)
    } catch (error) {
      console.error("Limitless processing fault:", error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadPayments() }, [loadPayments])

  // ─── INTERACTIVE MODAL TRIGGERS ───
  const openClientHistory = (clientName: string) => {
    if (!clientName || clientName.toLowerCase() === 'guest' || clientName === '—') return;
    const history = payments.filter(r => r.client.toLowerCase() === clientName.toLowerCase());
    setSelectedClientHistory(history);
    setSelectedPayment(history[0]);
    setShowClientModal(true);
  }

  const openPaymentDetails = (p: FinancialRecord) => {
    if (!p.client || p.client.toLowerCase() === 'guest' || p.client === '—') return;
    const history = payments.filter(r => r.client.toLowerCase() === p.client.toLowerCase());
    setSelectedClientHistory(history);
    setSelectedPayment(p);
    setShowPaymentModal(true);
  }

  const openDiscountModal = (p: FinancialRecord) => {
    if (!p.isLive) return alert("Historical data rows are read-only.");
    const foundMem = activeMemberships.find(m => m.client_name.toLowerCase().trim() === p.client.toLowerCase().trim());
    setDetectedMembership(foundMem || null);
    setSelectedPayment(p);
    setApplyDiscount(false);
    setIsDiscountModalOpen(true);
  }

  // ─── INLINE ACTIONS ───
  const startEditingReceived = (p: FinancialRecord) => {
    if (!p.isLive) return;
    setEditingReceivedId(p._key);
    setReceivedInput(p.received.toString() || '');
  }

  const saveReceivedAmount = async (p: FinancialRecord) => {
    if (!p.isLive || !p.rawId) return;
    const newReceived = parseCurrency(receivedInput);
    setPayments(prev => prev.map(item => item._key === p._key ? { ...item, received: newReceived } : item));
    setEditingReceivedId(null);
    const { error } = await supabase.from('bookings').update({ received_payment: newReceived }).eq('booking_id', p.rawId);
    if (error) alert("Failed to commit received totals.");
  }

  const confirmDiscount = async () => {
    if (!selectedPayment || !selectedPayment.rawId) return;
    const newDiscPct = applyDiscount && detectedMembership ? detectedMembership.discount_percentage : 0;
    const newNet = selectedPayment.amount * (1 - (newDiscPct / 100));

    setPayments(prev => prev.map(item => item._key === selectedPayment._key ? { ...item, discount_pct: newDiscPct, net_sales: newNet } : item));
    setIsDiscountModalOpen(false);

    const { error } = await supabase.from('bookings').update({ discount_pct: newDiscPct }).eq('booking_id', selectedPayment.rawId);
    if (error) alert("Failed to modify discount value variables.");
  }

  // ─── PAGINATION ───
  const totalReceived = payments.reduce((sum, p) => sum + p.received, 0)
  const totalTransactions = payments.length
  const totalPages = Math.max(1, Math.ceil(payments.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedPayments = payments.slice(startIndex, startIndex + itemsPerPage)

  // ─── SMART AUTO-LOCKING PAGINATION ───
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    setIsUnlocked(false); // Instantly relock the revenue card upon navigation
    setPinInput('');
  }

  // ─── STRICT PIN VALIDATION ───
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pinInput === '061026') {
      setIsUnlocked(true)
      setPinError(false)
      setPinInput('')
    } else {
      setPinError(true)
      setPinInput('')
    }
  }

  const formatCurrency = (amount: number) => amount === 0 ? '—' : `₱${amount.toLocaleString('en-PH')}`

  return (
    <>
      <style>{`
        .pos-input { width: 85px; padding: 4px 8px; border: 2px solid #C58F3B; border-radius: 6px; outline: none; font-weight: bold; text-align: center; font-family: inherit; }
        .modal-overlay { position: fixed; inset: 0; z-index: 999; background-color: rgba(10,8,6,0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 20px; }
        .clickable-cell:hover { color: #C58F3B !important; text-decoration: underline; text-underline-offset: 4px; cursor: pointer; }
        .received-cell:hover { background-color: rgba(197,143,59,0.05); outline: 1px dashed #C58F3B; border-radius: 4px; cursor: pointer; }
      `}</style>

      {/* ─── CASHIER DISCOUNTS PORTAL POPUP ─── */}
      {isDiscountModalOpen && selectedPayment && (
        <div className="modal-overlay">
          <div style={{ backgroundColor: '#F9F4EB', padding: 32, borderRadius: 16, width: '100%', maxWidth: 450, boxShadow: '0 24px 60px rgba(0,0,0,0.3)', fontFamily: "'Inter',system-ui,sans-serif" }}>
            <div style={{ paddingBottom: 16, borderBottom: '1px solid rgba(197,143,59,0.2)', marginBottom: 20 }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 28, margin: '0 0 4px', color: '#1A1A1A' }}>Apply Discount</h3>
              <p style={{ fontSize: 13, color: '#666', margin: 0 }}>Review and approve operational deductions for {selectedPayment.client}.</p>
            </div>

            <div style={{ backgroundColor: '#fff', padding: 20, borderRadius: 12, border: '1px solid rgba(26,26,26,0.1)', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Service Invoiced</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{selectedPayment.service}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Base Amount</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>₱{selectedPayment.amount.toLocaleString()}</span>
              </div>
            </div>

            {detectedMembership ? (
              <div style={{ backgroundColor: 'rgba(61,122,74,0.08)', padding: 16, borderRadius: 12, border: '1px solid rgba(61,122,74,0.3)', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 18 }}>👑</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#3D7A4A', textTransform: 'uppercase' }}>{detectedMembership.membership_tier} Located</div>
                    <div style={{ fontSize: 12, color: '#4A4A4A' }}>Linked discount: {detectedMembership.discount_percentage}% OFF</div>
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', backgroundColor: '#fff', borderRadius: 8, border: '1px solid rgba(61,122,74,0.2)' }}>
                  <input type="checkbox" checked={applyDiscount} onChange={(e) => setApplyDiscount(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>Execute & Apply {detectedMembership.discount_percentage}% Deduction</span>
                </label>
              </div>
            ) : (
              <div style={{ padding: 16, backgroundColor: 'rgba(26,26,26,0.04)', borderRadius: 12, border: '1px dashed rgba(26,26,26,0.15)', textAlign: 'center', marginBottom: 24 }}>
                <p style={{ fontSize: 13, color: '#666', margin: 0 }}>No active profiles allocated inside the memberships directory.</p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, padding: '16px 20px', backgroundColor: '#1A1A1A', borderRadius: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>Adjusted Net Due</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: '#C58F3B' }}>
                ₱{applyDiscount && detectedMembership ? (selectedPayment.amount - (selectedPayment.amount * (detectedMembership.discount_percentage / 100))).toLocaleString() : selectedPayment.amount.toLocaleString()}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setIsDiscountModalOpen(false)} style={{ flex: 1, height: 48, backgroundColor: 'transparent', border: '1px solid rgba(26,26,26,0.2)', borderRadius: 8, color: '#1A1A1A', fontWeight: 700, textTransform: 'uppercase', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmDiscount} style={{ flex: 1, height: 48, backgroundColor: '#1A1A1A', color: '#C58F3B', border: 'none', borderRadius: 8, fontWeight: 700, textTransform: 'uppercase', fontSize: 12, cursor: 'pointer' }}>Confirm Approval</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── LINKED CLIENT HISTORY POPUP MODAL ─── */}
      {showClientModal && selectedPayment && (
        <div className="modal-overlay" onClick={() => setShowClientModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#fff', borderRadius: '16px', width: '100%', maxWidth: '800px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ padding: '24px 30px', borderBottom: '1px solid rgba(26,26,26,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#FDFCF8' }}>
              <div>
                <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', color: '#C58F3B', textTransform: 'uppercase', margin: '0 0 8px 0' }}>CLIENT PROFILE</p>
                <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '32px', color: '#1A1A1A', margin: 0 }}>{selectedPayment.client}</h2>
              </div>
              <button onClick={() => setShowClientModal(false)} style={{ background: 'none', border: 'none', fontSize: '28px', color: '#666', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
            </div>
            <div style={{ display: 'flex', gap: '20px', padding: '20px 30px', backgroundColor: '#fff', borderBottom: '1px solid rgba(26,26,26,0.05)' }}>
              <div style={{ flex: 1, padding: '16px', backgroundColor: 'rgba(197,143,59,0.05)', borderRadius: '12px', border: '1px solid rgba(197,143,59,0.1)' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: '#C58F3B', letterSpacing: '0.1em', margin: '0 0 8px 0' }}>TOTAL VISITS</p>
                <p style={{ fontSize: '24px', fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{selectedClientHistory.length}</p>
              </div>
              <div style={{ flex: 1, padding: '16px', backgroundColor: 'rgba(61,122,74,0.05)', borderRadius: '12px', border: '1px solid rgba(61,122,74,0.1)' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: '#3D7A4A', letterSpacing: '0.1em', margin: '0 0 8px 0' }}>LIFETIME SPENT</p>
                <p style={{ fontSize: '24px', fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{formatCurrency(selectedClientHistory.reduce((acc, r) => acc + (r.net_sales || 0), 0))}</p>
              </div>
            </div>
            <div style={{ overflowY: 'auto', padding: '0 30px 30px 30px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1A1A1A', marginBottom: '16px', marginTop: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Service History</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(26,26,26,0.1)' }}>
                    <th style={{ padding: '12px 0', color: '#666', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '12px 0', color: '#666', fontWeight: 600 }}>Service</th>
                    <th style={{ padding: '12px 0', color: '#666', fontWeight: 600, textAlign: 'right' }}>Net Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedClientHistory.map((h, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(26,26,26,0.05)' }}>
                      <td style={{ padding: '16px 0', color: '#1A1A1A', fontWeight: 600 }}>{h.displayDate}</td>
                      <td style={{ padding: '16px 0', color: '#666' }}>{h.service}</td>
                      <td style={{ padding: '16px 0', color: '#1A1A1A', fontWeight: 700, textAlign: 'right' }}>{formatCurrency(h.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── LINKED PAYMENT HISTORY MODAL ─── */}
      {showPaymentModal && selectedPayment && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#fff', borderRadius: '16px', width: '100%', maxWidth: '900px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ padding: '24px 30px', borderBottom: '1px solid rgba(26,26,26,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#FDFCF8' }}>
              <div>
                <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', color: '#C58F3B', textTransform: 'uppercase', margin: '0 0 8px 0' }}>PAYMENT DETAILS EXTRACT</p>
                <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '32px', color: '#1A1A1A', margin: 0 }}>{selectedPayment.client}</h2>
              </div>
              <button onClick={() => setShowPaymentModal(false)} style={{ background: 'none', border: 'none', fontSize: '28px', color: '#666', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '0 30px 30px 30px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', marginTop: '20px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(26,26,26,0.1)' }}>
                    <th style={{ padding: '12px 0', color: '#666', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '12px 0', color: '#666', fontWeight: 600 }}>Service</th>
                    <th style={{ padding: '12px 0', color: '#666', fontWeight: 600 }}>Net Due</th>
                    <th style={{ padding: '12px 0', color: '#666', fontWeight: 600 }}>Paid (Rcvd)</th>
                    <th style={{ padding: '12px 0', color: '#666', fontWeight: 600 }}>Change</th>
                    <th style={{ padding: '12px 0', color: '#666', fontWeight: 600 }}>Method</th>
                    <th style={{ padding: '12px 0', color: '#666', fontWeight: 600 }}>Receipt</th>
                    <th style={{ padding: '12px 0', color: '#666', fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedClientHistory.map((h, i) => {
                    const change = Math.max(0, h.received - h.net_sales);
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(26,26,26,0.05)' }}>
                        <td style={{ padding: '16px 0', color: '#1A1A1A', fontWeight: 600 }}>{h.displayDate}</td>
                        <td style={{ padding: '16px 0', color: '#666' }}>{h.service}</td>
                        <td style={{ padding: '16px 0', color: '#1A1A1A', fontWeight: 700 }}>{formatCurrency(h.net_sales)}</td>
                        <td style={{ padding: '16px 0', color: '#3D7A4A', fontWeight: 700 }}>{formatCurrency(h.received)}</td>
                        <td style={{ padding: '16px 0', color: '#666', fontWeight: 700 }}>{formatCurrency(change)}</td>
                        <td style={{ padding: '16px 0', color: '#1A1A1A', fontWeight: 600 }}>{h.modeOfPayment}</td>
                        <td style={{ padding: '16px 0', color: '#666', fontSize: 11 }}>
                          {h.ref_no ? <div style={{ marginBottom: 4 }}>Ref: {h.ref_no}</div> : null}
                          {h.receipt_url ? <a href={h.receipt_url} target="_blank" rel="noreferrer" style={{ color: '#C58F3B', fontWeight: 700, textDecoration: 'underline' }}>View</a> : null}
                          {!h.ref_no && !h.receipt_url ? '—' : null}
                        </td>
                        <td style={{ padding: '16px 0' }}>
                          <span style={{ display: 'inline-block', whiteSpace: 'nowrap', backgroundColor: h.payment_status === 'PAID' ? 'rgba(61,122,74,0.1)' : 'rgba(200,50,50,0.1)', color: h.payment_status === 'PAID' ? '#3D7A4A' : '#C83232', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
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

      {/* ─── PRIMARY WORKSPACE CONTAINER ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Inter',system-ui,sans-serif" }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 36, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Payments Ledger</h2>
          </div>
          <button onClick={loadPayments} style={{ padding: '0 16px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', cursor: 'pointer' }}>
            {loading ? 'Re-aligning...' : 'Refresh Logs'}
          </button>
        </div>

        {/* ─── INTEL STAT CARDS ─── */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 250px', backgroundColor: '#1A1A1A', border: '1px solid rgba(197,143,59,0.2)', borderRadius: 14, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: 0, letterSpacing: '0.05em' }}>Total Net Received</p>
              {isUnlocked && (
                <button onClick={() => setIsUnlocked(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C58F3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                </button>
              )}
            </div>

            {isUnlocked ? (
              <p style={{ fontSize: 32, fontWeight: 700, color: '#fff', margin: 0 }}>
                {loading ? '...' : `₱${totalReceived.toLocaleString()}`}
              </p>
            ) : (
              <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(26,26,26,0.95)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <form onSubmit={handlePinSubmit} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C58F3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  <input type="password" maxLength={6} value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="ENTER PIN" style={{ width: 100, height: 30, backgroundColor: 'transparent', border: 'none', borderBottom: `1px solid ${pinError ? '#ff4d4f' : '#C58F3B'}`, color: '#fff', fontSize: 14, textAlign: 'center', outline: 'none', letterSpacing: '0.2em' }} />
                  <button type="submit" style={{ display: 'none' }}></button>
                </form>
                {pinError && <span style={{ fontSize: 9, color: '#ff4d4f', marginTop: 4, position: 'absolute', bottom: 10 }}>INCORRECT PIN</span>}
              </div>
            )}
          </div>

          <div style={{ flex: '1 1 250px', backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 8px', letterSpacing: '0.05em' }}>Total Continuous Transactions</p>
            <p style={{ fontSize: 32, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
              {loading ? '...' : totalTransactions.toLocaleString()}
            </p>
          </div>
        </div>

        {/* ─── DATA GRID LEDGER ─── */}
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: '#fff', borderRadius: 16, border: '1px solid rgba(26,26,26,0.09)' }}>
            Iterating table schemas down to infinite limit variables...
          </div>
        ) : (
          <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ overflowX: 'auto', minHeight: 400 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)', backgroundColor: '#F8F4EE' }}>
                    {['Date', 'Client', 'Service', 'Amount', 'Discounted', 'Net Sales', 'Received', 'Mode of Payment', 'Client Type'].map(h => (
                      <th key={h} style={{ padding: '14px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C58F3B', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedPayments.map((p) => (
                    <tr key={p._key} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                      <td style={{ padding: '14px 16px', color: '#666', whiteSpace: 'nowrap' }}>{p.displayDate}</td>

                      <td
                        onClick={() => openClientHistory(p.client)}
                        className="clickable-cell"
                        style={{ padding: '14px 16px', fontWeight: 600, color: '#1A1A1A', whiteSpace: 'nowrap' }}
                      >
                        {p.client}
                      </td>

                      <td style={{ padding: '14px 16px', color: '#2A2A2A', maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.service}</td>
                      <td style={{ padding: '14px 16px', color: '#666' }}>{formatCurrency(p.amount)}</td>

                      <td
                        onClick={() => openDiscountModal(p)}
                        className={p.isLive ? "clickable-cell" : ""}
                        style={{ padding: '14px 16px', fontWeight: 700, color: p.discount_pct > 0 ? '#C83232' : '#888' }}
                      >
                        {p.discount_pct > 0 ? `-${p.discount_pct}%` : '—'}
                      </td>

                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1A1A1A' }}>{formatCurrency(p.net_sales)}</td>

                      <td
                        onClick={() => startEditingReceived(p)}
                        className={p.isLive ? "received-cell" : ""}
                        style={{ padding: '14px 16px', fontWeight: 700, color: '#3D7A4A' }}
                      >
                        {editingReceivedId === p._key ? (
                          <input
                            type="number"
                            className="pos-input"
                            autoFocus
                            value={receivedInput}
                            onChange={(e) => setReceivedInput(e.target.value)}
                            onBlur={() => saveReceivedAmount(p)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveReceivedAmount(p) }}
                          />
                        ) : (
                          formatCurrency(p.received)
                        )}
                      </td>

                      <td
                        onClick={() => openPaymentDetails(p)}
                        className="clickable-cell"
                        style={{ padding: '14px 16px', color: '#666' }}
                      >
                        <span style={{ padding: '4px 8px', borderRadius: 4, backgroundColor: '#f5f5f5', fontSize: 11, fontWeight: 600, border: '1px solid rgba(0,0,0,0.05)' }}>
                          {p.modeOfPayment}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap', minWidth: 140 }}>
                        <span style={{
                          display: 'inline-block', whiteSpace: 'nowrap',
                          padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                          backgroundColor: p.clientType === 'NEW CLIENT' ? 'rgba(61,122,74,0.1)' : 'rgba(197,143,59,0.1)',
                          color: p.clientType === 'NEW CLIENT' ? '#3D7A4A' : '#C58F3B'
                        }}>
                          {p.clientType}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {paginatedPayments.length === 0 && <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No active payment sequences detected.</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{ padding: '16px 20px', backgroundColor: '#FDFCF8', borderTop: '1px solid rgba(26,26,26,0.09)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <span style={{ fontSize: 13, color: '#666' }}>
                Showing <strong style={{ color: '#1A1A1A' }}>{startIndex + 1}</strong> to <strong style={{ color: '#1A1A1A' }}>{Math.min(startIndex + itemsPerPage, payments.length)}</strong> of <strong style={{ color: '#C58F3B' }}>{payments.length.toLocaleString()}</strong> rows unrolled
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', backgroundColor: currentPage === 1 ? '#f5f5f5' : '#1A1A1A', color: currentPage === 1 ? '#aaa' : '#C58F3B', border: 'none', borderRadius: 6, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }} onClick={() => handlePageChange(1)} disabled={currentPage === 1}>First</button>
                <button style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', backgroundColor: currentPage === 1 ? '#f5f5f5' : '#1A1A1A', color: currentPage === 1 ? '#aaa' : '#C58F3B', border: 'none', borderRadius: 6, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }} onClick={() => handlePageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>Prev</button>
                <span style={{ padding: '0 10px', fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>Page {currentPage} of {totalPages}</span>
                <button style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', backgroundColor: currentPage === totalPages ? '#f5f5f5' : '#1A1A1A', color: currentPage === totalPages ? '#aaa' : '#C58F3B', border: 'none', borderRadius: 6, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }} onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>Next</button>
                <button style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', backgroundColor: currentPage === totalPages ? '#f5f5f5' : '#1A1A1A', color: currentPage === totalPages ? '#aaa' : '#C58F3B', border: 'none', borderRadius: 6, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }} onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}>Last</button>
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  )
}