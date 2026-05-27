'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── INDESTRUCTIBLE DATE PARSER ───
function parseImportDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const clean = String(raw).trim().replace(/,/g, '').replace(/\s+/g, ' ');
  if (!clean) return null;

  const MONTHS: Record<string, number> = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
    may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, september: 8,
    oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
  };

  let year = 0, month = 0, day = 1, matched = false;

  const match1 = clean.match(/^(\d{1,2})[-\s/]+([A-Za-z]{3,})[-\s/]+(\d{2,4})$/);
  if (match1) {
    day = parseInt(match1[1], 10); month = MONTHS[match1[2].toLowerCase()] ?? 0; year = parseInt(match1[3], 10); matched = true;
  }
  if (!matched) {
    const match2 = clean.match(/^([A-Za-z]{3,})[-\s/]+(\d{1,2})[-\s/]+(\d{2,4})$/);
    if (match2) {
      month = MONTHS[match2[1].toLowerCase()] ?? 0; day = parseInt(match2[2], 10); year = parseInt(match2[3], 10); matched = true;
    }
  }
  if (!matched) {
    const match3 = clean.match(/^(\d{4})[-\s/]+(\d{1,2})[-\s/]+(\d{1,2})$/);
    if (match3) {
      year = parseInt(match3[1], 10); month = parseInt(match3[2], 10) - 1; day = parseInt(match3[3], 10); matched = true;
    }
  }

  if (matched) {
    if (year < 100) year += 2000;
    return new Date(year, month, day, 12, 0, 0);
  }

  const d = new Date(clean);
  if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  return null;
}

function fmtDateShort(raw: string): string {
  const d = parseImportDate(raw)
  return d ? d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : String(raw)
}

interface TxRow {
  _key: string; date: string; client: string; service: string; therapist: string;
  amount: number; received: number; method: string; customerType: string;
}

export default function PaymentsPage() {
  const supabase = useRef(createClient()).current
  const [allTx, setAllTx] = useState<TxRow[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const PAGE = 1000
    const all: TxRow[] = []
    let from = 0

    for (; ;) {
      const { data, error } = await supabase.from('bookings_import').select('date,client_name,service,therapist,service_amount,received_payment,payment_method,customer_type').range(from, from + PAGE - 1)
      if (error || !data || data.length === 0) break
      data.forEach((r, i) => {
        all.push({
          _key: `${r.client_name}-${i}-${from}`,
          date: String(r.date ?? ''), client: String(r.client_name ?? 'Guest'),
          service: String(r.service ?? '—'), therapist: String(r.therapist ?? '—'),
          amount: Number(r.service_amount ?? 0), received: Number(r.received_payment ?? 0),
          method: String(r.payment_method ?? '—'), customerType: String(r.customer_type ?? 'Standard'),
        })
      })
      if (data.length < PAGE) break
      from += PAGE
    }

    all.sort((a, b) => {
      const da = parseImportDate(a.date)?.getTime() ?? 0
      const db = parseImportDate(b.date)?.getTime() ?? 0
      return db - da
    })

    setAllTx(all)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const totalReceived = allTx.reduce((a, t) => a + t.received, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Transaction Ledger</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Payments</h2>
        </div>
        <button onClick={loadData} style={{ padding: '0 16px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>Refresh</button>
      </div>

      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: 'rgba(197,143,59,0.07)', borderRadius: 12 }}>Loading payments...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(175px,100%),1fr))', gap: 12 }}>
            <div style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(197,143,59,0.20)', borderRadius: 14, padding: '18px', boxShadow: '0 5px 18px rgba(0,0,0,0.16)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(243,233,224,0.50)', margin: '0 0 8px' }}>Total Received</p>
              <p style={{ fontSize: 'clamp(1.3rem,2.2vw,1.7rem)', fontWeight: 700, color: '#F3E9E0', margin: 0 }}>₱{totalReceived.toLocaleString()}</p>
            </div>
            <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 8px' }}>Total Transactions</p>
              <p style={{ fontSize: 'clamp(1.3rem,2.2vw,1.7rem)', fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{allTx.length.toLocaleString()}</p>
            </div>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(26,26,26,0.09)', backgroundColor: '#F8F4EE' }}>
                    {['Date', 'Client', 'Service', 'Amount', 'Received', 'Mode of Payment', 'Client Type'].map(h => <th key={h} style={{ padding: '10px 13px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#C58F3B', whiteSpace: 'nowrap' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {allTx.slice(0, 1000).map((t) => (
                    <tr key={t._key} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                      <td style={{ padding: '11px 13px', color: '#666', whiteSpace: 'nowrap' }}>{fmtDateShort(t.date)}</td>
                      <td style={{ padding: '11px 13px', fontWeight: 600, color: '#1A1A1A' }}>{t.client}</td>
                      <td style={{ padding: '11px 13px', color: '#2A2A2A' }}>{t.service}</td>
                      <td style={{ padding: '11px 13px', color: '#666' }}>₱{t.amount.toLocaleString()}</td>
                      <td style={{ padding: '11px 13px', fontWeight: 700, color: '#1A1A1A' }}>₱{t.received.toLocaleString()}</td>
                      <td style={{ padding: '11px 13px', color: '#666' }}>
                        <span style={{ padding: '4px 8px', borderRadius: 4, backgroundColor: '#f5f5f5', fontSize: 11 }}>{t.method}</span>
                      </td>
                      <td style={{ padding: '11px 13px', color: '#C58F3B', fontWeight: 600, fontSize: 12 }}>{t.customerType || 'Standard'}</td>
                    </tr>
                  ))}
                  {allTx.length === 0 && <tr><td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: '#666' }}>No payments found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}