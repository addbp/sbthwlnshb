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

interface PaymentRecord {
  _key: string;
  id: string | number | null;
  isLive: boolean;
  parsedDate: Date | null;
  client: string;
  service: string;
  amount: number;
  discounted: number;
  received: number;
  modeOfPayment: string;
  clientType: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Membership { id: string; client_name: string; membership_tier: string; discount_percentage: number }

export default function PaymentsPage() {
  const supabase = useRef(createClient()).current
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [activeMemberships, setActiveMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(true)

  // ─── DYNAMIC PIN SECURITY STATE ───
  const [dbPin, setDbPin] = useState('123456') // Default fallback
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)

  // ─── POS / CASHIER STATES ───
  const [showRevenue, setShowRevenue] = useState(true)
  const [editingReceivedId, setEditingReceivedId] = useState<string | null>(null)
  const [receivedInput, setReceivedInput] = useState('')

  // Discount Modal States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null)
  const [applyDiscount, setApplyDiscount] = useState(false)
  const [detectedMembership, setDetectedMembership] = useState<Membership | null>(null)

  // Pagination Configuration
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 100

  // ─── LIMITLESS PAGINATION UNROLLING ENGINE ───
  const loadPayments = useCallback(async () => {
    setLoading(true)
    const PAGE_SIZE = 1000
    const all: PaymentRecord[] = []
    const allMemberships: Membership[] = []

    try {
      // 1. Fetch the live administrative security PIN
      const { data: pinData } = await supabase.from('admin_settings').select('pin').single()
      if (pinData && pinData.pin) setDbPin(pinData.pin)

      // 2. Fetch ALL Active memberships via limitless pagination unrolling
      let fromMem = 0
      for (; ;) {
        const { data, error } = await supabase
          .from('memberships')
          .select('id, client_name, membership_tier, discount_percentage')
          .eq('status', 'Active')
          .range(fromMem, fromMem + PAGE_SIZE - 1)

        if (error || !data || data.length === 0) break
        allMemberships.push(...(data as Membership[]))
        if (data.length < PAGE_SIZE) break
        fromMem += PAGE_SIZE
      }
      setActiveMemberships(allMemberships)

      // 3. Fetch ALL Live Bookings via limitless pagination unrolling
      let fromLive = 0
      for (; ;) {
        const { data, error } = await supabase
          .from('bookings')
          .select('*')
          .range(fromLive, fromLive + PAGE_SIZE - 1)

        if (error || !data || data.length === 0) break

        data.forEach((r: any) => {
          const originalAmount = parseCurrency(r.amount || r.price);
          const currentPrice = parseCurrency(r.price);
          const received = parseCurrency(r.received_payment);

          all.push({
            _key: `live-${fromLive}-${r.id}`,
            id: r.id,
            isLive: true,
            parsedDate: parseImportDate(r.appointment_date || r.created_at),
            client: String(r.client_name || 'Guest'),
            service: String(r.service_name || r.service || '—'),
            amount: originalAmount,
            discounted: currentPrice,
            received: received,
            modeOfPayment: String(r.payment_method || '—').toUpperCase(),
            clientType: '—'
          })
        })
        if (data.length < PAGE_SIZE) break
        fromLive += PAGE_SIZE
      }

      // 4. Fetch ALL Historical Records via limitless pagination unrolling
      let fromHist = 0
      for (; ;) {
        const { data, error } = await supabase
          .from('bookings_import')
          .select('date, client_name, service, service_amount, received_payment, payment_method')
          .range(fromHist, fromHist + PAGE_SIZE - 1)

        if (error || !data || data.length === 0) break

        data.forEach((r: any, i: number) => {
          const received = parseCurrency(r.received_payment)
          const amount = parseCurrency(r.service_amount)

          if (received > 0 || amount > 0) {
            all.push({
              _key: `hist-${fromHist}-${i}`,
              id: null,
              isLive: false,
              parsedDate: parseImportDate(r.date),
              client: String(r.client_name || 'Guest'),
              service: String(r.service || '—'),
              amount: amount,
              discounted: amount,
              received: received,
              modeOfPayment: String(r.payment_method || '—').toUpperCase(),
              clientType: '—'
            })
          }
        })
        if (data.length < PAGE_SIZE) break
        fromHist += PAGE_SIZE
      }

      // 5. Timeline Sequence Audit Pass (Calculate Retention Matrix Flags)
      all.sort((a, b) => (a.parsedDate?.getTime() || 0) - (b.parsedDate?.getTime() || 0))
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

      // 6. Reverse Chronological View Generation Sort
      all.sort((a, b) => (b.parsedDate?.getTime() || 0) - (a.parsedDate?.getTime() || 0))

      setPayments(all)
    } catch (error) {
      console.error("Limitless processing pipeline fault:", error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadPayments() }, [loadPayments])

  // ─── INLINE CASH MANAGEMENT HANDLERS ───
  const startEditingReceived = (p: PaymentRecord) => {
    if (!p.isLive) return;
    setEditingReceivedId(p._key);
    setReceivedInput(p.received.toString() || '');
  }

  const saveReceivedAmount = async (p: PaymentRecord) => {
    if (!p.id) return;
    const newReceived = parseCurrency(receivedInput);

    setPayments(prev => prev.map(item => item._key === p._key ? { ...item, received: newReceived } : item));
    setEditingReceivedId(null);

    const { error } = await supabase.from('bookings').update({ received_payment: newReceived }).eq('id', p.id);
    if (error) alert("Failed to commit received totals to database instance.");
  }

  // ─── DISCOUNT CONTEXT CASHIER MODAL ───
  const openDiscountModal = (p: PaymentRecord) => {
    if (!p.isLive) {
      alert("Historical data rows are marked static / read-only.");
      return;
    }
    const foundMem = activeMemberships.find(m => m.client_name.toLowerCase().trim() === p.client.toLowerCase().trim());
    setDetectedMembership(foundMem || null);
    setSelectedPayment(p);
    setApplyDiscount(false);
    setIsModalOpen(true);
  }

  const confirmDiscount = async () => {
    if (!selectedPayment || !selectedPayment.id) return;

    let newDiscountedPrice = selectedPayment.amount;
    if (applyDiscount && detectedMembership) {
      const deduction = newDiscountedPrice * (detectedMembership.discount_percentage / 100);
      newDiscountedPrice = newDiscountedPrice - deduction;
    }

    setPayments(prev => prev.map(item => item._key === selectedPayment._key ? { ...item, discounted: newDiscountedPrice } : item));
    setIsModalOpen(false);

    const { error } = await supabase.from('bookings').update({ price: newDiscountedPrice }).eq('id', selectedPayment.id);
    if (error) alert("Failed to modify price column value variables.");
  }

  // ─── PAGINATION EVALUATIONS ───
  const totalReceived = payments.reduce((sum, p) => sum + p.received, 0)
  const totalTransactions = payments.length

  const totalPages = Math.max(1, Math.ceil(payments.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedPayments = payments.slice(startIndex, startIndex + itemsPerPage)

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    padding: '6px 12px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
    backgroundColor: disabled ? '#f5f5f5' : '#1A1A1A', color: disabled ? '#aaa' : '#C58F3B',
    border: 'none', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'opacity 200ms ease'
  })

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pinInput === dbPin) {
      setIsUnlocked(true)
      setPinError(false)
    } else {
      setPinError(true)
      setPinInput('')
    }
  }

  return (
    <>
      <style>{`
        .pos-input { width: 85px; padding: 4px 8px; border: 2px solid #C58F3B; border-radius: 6px; outline: none; font-weight: bold; text-align: center; font-family: inherit; }
        .modal-overlay { position: fixed; inset: 0; z-index: 999; background-color: rgba(10,8,6,0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 20px; }
        .client-name:hover { color: #C58F3B; text-decoration: underline; text-underline-offset: 4px; }
        .received-cell:hover { background-color: rgba(197,143,59,0.05); outline: 1px dashed #C58F3B; border-radius: 4px; }
      `}</style>

      {/* ─── CASHIER DISCOUNTS PORTAL POPUP ─── */}
      {isModalOpen && selectedPayment && (
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
                <span style={{ fontSize: 12, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Original Amount</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>₱{selectedPayment.amount.toLocaleString()}</span>
              </div>
            </div>

            {detectedMembership ? (
              <div style={{ backgroundColor: 'rgba(61,122,74,0.08)', padding: 16, borderRadius: 12, border: '1px solid rgba(61,122,74,0.3)', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 18 }}>👑</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#3D7A4A', textTransform: 'uppercase' }}>{detectedMembership.membership_tier} Record Located</div>
                    <div style={{ fontSize: 12, color: '#4A4A4A' }}>Linked discount variable matches: {detectedMembership.discount_percentage}% OFF</div>
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', backgroundColor: '#fff', borderRadius: 8, border: '1px solid rgba(61,122,74,0.2)' }}>
                  <input type="checkbox" checked={applyDiscount} onChange={(e) => setApplyDiscount(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
                    Execute & Apply {detectedMembership.discount_percentage}% Ledger Deduction
                  </span>
                </label>
              </div>
            ) : (
              <div style={{ padding: 16, backgroundColor: 'rgba(26,26,26,0.04)', borderRadius: 12, border: '1px dashed rgba(26,26,26,0.15)', textAlign: 'center', marginBottom: 24 }}>
                <p style={{ fontSize: 13, color: '#666', margin: 0 }}>No active profiles allocated inside the memberships directory.</p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, padding: '16px 20px', backgroundColor: '#1A1A1A', borderRadius: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>Adjusted Balance</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: '#C58F3B' }}>
                ₱{applyDiscount && detectedMembership
                  ? (selectedPayment.amount - (selectedPayment.amount * (detectedMembership.discount_percentage / 100))).toLocaleString()
                  : selectedPayment.amount.toLocaleString()}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setIsModalOpen(false)} style={{ flex: 1, height: 48, backgroundColor: 'transparent', border: '1px solid rgba(26,26,26,0.2)', borderRadius: 8, color: '#1A1A1A', fontWeight: 700, textTransform: 'uppercase', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmDiscount} style={{ flex: 1, height: 48, backgroundColor: '#1A1A1A', color: '#C58F3B', border: 'none', borderRadius: 8, fontWeight: 700, textTransform: 'uppercase', fontSize: 12, cursor: 'pointer' }}>Confirm Approval</button>
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

        {/* ─── INTEL STAT CARDS (WITH PIN SAFE SHROUD) ─── */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>

          <div style={{ flex: '1 1 250px', backgroundColor: '#1A1A1A', border: '1px solid rgba(197,143,59,0.2)', borderRadius: 14, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: 0, letterSpacing: '0.05em' }}>Total Net Received</p>

              {isUnlocked && (
                <button onClick={() => setShowRevenue(!showRevenue)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                  {showRevenue ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C58F3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  )}
                </button>
              )}
            </div>

            {isUnlocked ? (
              <p style={{ fontSize: 32, fontWeight: 700, color: '#fff', margin: 0 }}>
                {loading ? '...' : showRevenue ? `₱${totalReceived.toLocaleString()}` : '••••••••'}
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

        {/* ─── DATA GRID LEDGER PRESENTATION ─── */}
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
                    {['Date', 'Client', 'Service', 'Amount', 'Discounted', 'Received', 'Mode of Payment', 'Client Type'].map(h => (
                      <th key={h} style={{ padding: '14px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C58F3B', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedPayments.map((p) => (
                    <tr key={p._key} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                      <td style={{ padding: '14px 16px', color: '#666', whiteSpace: 'nowrap' }}>{formatDateToDDMMMYY(p.parsedDate)}</td>

                      {/* INTERACTIVE CLIENT PROFILE CROSS-REFERENCE CELL */}
                      <td
                        onClick={() => openDiscountModal(p)}
                        className={p.isLive ? "client-name" : ""}
                        style={{ padding: '14px 16px', fontWeight: 600, color: '#1A1A1A', cursor: p.isLive ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
                        title={p.isLive ? "Click to verify user profile deduction rules" : "Historical entity instances cannot be overwritten"}
                      >
                        {p.client} {p.isLive && <span style={{ fontSize: 10, color: '#C58F3B', marginLeft: 4, fontWeight: 'bold' }}>+</span>}
                      </td>

                      <td style={{ padding: '14px 16px', color: '#2A2A2A', maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.service}</td>
                      <td style={{ padding: '14px 16px', color: '#666' }}>₱{p.amount.toLocaleString()}</td>

                      {/* COMPUTE LEDGER DISCOUNTS VALUE COLUMN */}
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: p.discounted < p.amount ? '#C58F3B' : '#888' }}>
                        {p.discounted < p.amount ? `₱${p.discounted.toLocaleString()}` : '—'}
                      </td>

                      {/* COMMITTED CASH RECEIVED REGISTER FIELD */}
                      <td
                        onClick={() => startEditingReceived(p)}
                        className={p.isLive ? "received-cell" : ""}
                        style={{ padding: '14px 16px', fontWeight: 700, color: '#3D7A4A', cursor: p.isLive ? 'pointer' : 'default', transition: 'all 200ms' }}
                        title={p.isLive ? "Click to input received currency" : ""}
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
                          `₱${p.received.toLocaleString()}`
                        )}
                      </td>

                      <td style={{ padding: '14px 16px', color: '#666' }}>
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
                  {paginatedPayments.length === 0 && <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No active payment sequences detected.</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{ padding: '16px 20px', backgroundColor: '#FDFCF8', borderTop: '1px solid rgba(26,26,26,0.09)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <span style={{ fontSize: 13, color: '#666' }}>
                Showing <strong style={{ color: '#1A1A1A' }}>{startIndex + 1}</strong> to <strong style={{ color: '#1A1A1A' }}>{Math.min(startIndex + itemsPerPage, payments.length)}</strong> of <strong style={{ color: '#C58F3B' }}>{payments.length.toLocaleString()}</strong> rows unrolled
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
    </>
  )
}