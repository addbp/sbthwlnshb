'use client'

// app/dashboard/overview/page.tsx
// Phase 35: Omni-Synced Overview POS (Fixed DB Save State, Perfect Responsive Scroll, Auto-Math)
// FULL UN-SHORTENED SOURCE CODE PRESERVED

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// INITIALIZATION & CONSTANTS
// ─────────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const BG = '#F9F4EB'
const BLACK = '#1A1A1A'
const GOLD = '#C58F3B'
const WHITE = '#FFFFFF'
const BODY = "'Inter', system-ui, sans-serif"
const DSP = "'Cormorant Garamond', Georgia, serif"

// Master Time Slots (Connected to Booking Engine)
const ALL_TIME_SLOTS = [
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM',
  '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM',
  '9:00 PM', '9:30 PM', '10:00 PM', '10:30 PM', '11:00 PM', '11:30 PM', '12:00 AM'
];

// ─── UTILITIES ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCurrency(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
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

function formatDateToYYYYMMDD(d: Date | null): string | null {
  if (!d || isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── INTERFACES ───
interface LiveBooking {
  id: string;
  rawId: string;
  source: 'live' | 'import';
  rawDate: string;
  time: string;
  client: string;
  service: string;
  notes: string;
  amount: number;
  discount_pct: number;
  therapist_comm_pct: number;
  payment_method: string;
  payment_status: string;
  ref_no: string;
  receipt_url: string;
  received_payment: number;
  status: string;
  therapist: string | null;
  createdAt: string;
  additional_mins: number;
  additional_price: number;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  off_days: string[];
}

export default function OverviewDashboard() {
  const supabase = useRef(createClient(supabaseUrl, supabaseAnonKey)).current

  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [view, setView] = useState<'LIST' | 'GRID'>('LIST')
  const [selectedDate, setSelectedDate] = useState(getTodayStr())

  // Store the active user's email to pass to the Audit Log
  const [currentUserEmail, setCurrentUserEmail] = useState('Admin (Table Editor)')

  const [allBookings, setAllBookings] = useState<LiveBooking[]>([])
  const [dailyBookings, setDailyBookings] = useState<LiveBooking[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])

  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({ completed: 0, pending: 0, ongoing: 0, hold: 0 })

  const [gridModalBooking, setGridModalBooking] = useState<LiveBooking | null>(null)

  // ─── MASTER DATA FETCHER (UNLIMITED) ───
  const fetchEverything = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setCurrentUserEmail(user.email);
      }

      const fetchUnlimited = async (tableName: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allRecords: any[] = [];
        let start = 0;
        const step = 1000;
        for (; ;) {
          const { data, error } = await supabase.from(tableName).select('*').range(start, start + step - 1);
          if (error) { console.error(`Error fetching ${tableName}:`, error); break; }
          if (!data || data.length === 0) break;
          allRecords.push(...data);
          if (data.length < step) break;
          start += step;
        }
        return allRecords;
      };

      const rawStaff = await fetchUnlimited('staff');
      const mappedStaff = rawStaff.map(t => ({
        id: String(t.id),
        name: String(t.name || t.therapist_name || 'Unnamed Staff').trim(),
        role: String(t.role || t.specialty || 'Staff'),
        off_days: t.off_days ? String(t.off_days).split(',').filter(Boolean) : []
      })).sort((a, b) => a.name.localeCompare(b.name));
      setStaffList(mappedStaff);

      const uniqueRows = new Map<string, LiveBooking>();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const processRow = (r: any, source: 'live' | 'import', idField: string) => {
        const amt = parseCurrency(r.price || r.amount || r.service_amount || 0);
        const addMins = Number(r.additional_mins || 0);
        const addPrice = Number(r.additional_price || 0);
        const discPct = Number(r.discount_pct || 0);

        // Accurate combined net total calculation
        const combinedNetSales = (amt + addPrice) * (1 - (discPct / 100));

        // Smart fallback: if received_payment is completely empty/null, pre-fill it with combinedNetSales
        let recPay = combinedNetSales;
        if (r.received_payment !== null && r.received_payment !== undefined && String(r.received_payment).trim() !== '') {
          recPay = parseCurrency(r.received_payment);
        }

        const client = String(r.client_name || 'Guest').trim();
        const timeStr = String(r.appointment_time || r.time || '—').trim();
        const rawDateStr = String(r.appointment_date || r.date || '').trim();

        let currentStatus = r.status || 'Pending';
        if (currentStatus === 'Pending' && timeStr !== '—') {
          const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (match) {
            let h = parseInt(match[1]);
            const m = parseInt(match[2]);
            if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12;
            if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
            const now = new Date();
            if (formatDateToYYYYMMDD(parseImportDate(rawDateStr)) === getTodayStr()) {
              if (now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m)) {
                currentStatus = 'Ongoing';
              }
            }
          }
        }

        const row: LiveBooking = {
          id: `${source}-${r[idField]}`,
          rawId: r[idField],
          source: source,
          rawDate: rawDateStr,
          time: timeStr,
          client: client,
          service: String(r.service_name || r.service || '—'),
          notes: String(r.notes || ''),
          amount: amt,
          discount_pct: discPct,
          therapist_comm_pct: Number(r.therapist_comm_pct || 0),
          payment_method: String(r.payment_method || 'PAY AT COUNTER').toUpperCase(),
          payment_status: String(r.payment_status || 'UNPAID').toUpperCase(),
          ref_no: String(r.ref_no || ''),
          receipt_url: String(r.receipt_url || ''),
          received_payment: recPay,
          status: currentStatus,
          therapist: r.therapist_name || r.therapist || null,
          createdAt: r.created_at || new Date().toISOString(),
          additional_mins: addMins,
          additional_price: addPrice
        };
        const standardDate = formatDateToYYYYMMDD(parseImportDate(rawDateStr));
        const dedupKey = `${client.toLowerCase()}-${amt}-${timeStr}-${standardDate || rawDateStr}`;
        if (!uniqueRows.has(dedupKey)) uniqueRows.set(dedupKey, row);
      };

      const liveData = await fetchUnlimited('bookings');
      liveData.forEach(b => processRow(b, 'live', 'booking_id'));

      const impData = await fetchUnlimited('bookings_import');
      impData.forEach((r, idx) => processRow(r, 'import', r.id ? 'id' : idx.toString()));

      const finalAllBookings = Array.from(uniqueRows.values());
      finalAllBookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setAllBookings(finalAllBookings);
    } catch (err) {
      console.error('Master Operations Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { fetchEverything() }, [fetchEverything]);

  // ─── DATE FILTERING ───
  useEffect(() => {
    const targetYMD = selectedDate;
    const [y, m, d] = targetYMD.split('-');
    const mNum = parseInt(m, 10);
    const dNum = parseInt(d, 10);
    const monthsArr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mmm = monthsArr[mNum - 1];
    const yy = y.slice(-2);

    const var1 = `${dNum}-${mmm}-${yy}`;
    const var2 = `${String(dNum).padStart(2, '0')}-${mmm}-${yy}`;

    const todaysBookings = allBookings.filter(b => {
      const raw = b.rawDate;
      if (!raw) return false;
      if (raw.includes(targetYMD) || raw.includes(var1) || raw.includes(var2)) return true;
      const parsed = parseImportDate(raw);
      return formatDateToYYYYMMDD(parsed) === targetYMD;
    });

    setDailyBookings(todaysBookings);

    setMetrics({
      completed: todaysBookings.filter(b => b.status === 'Completed').length,
      pending: todaysBookings.filter(b => b.status === 'Pending').length,
      ongoing: todaysBookings.filter(b => b.status === 'Ongoing').length,
      hold: todaysBookings.filter(b => b.status === 'Hold').length,
    });
  }, [selectedDate, allBookings]);


  // ─── SMART DATABASE UPDATES (WITH OPTIONAL DB SAVE FLAG) ───
  const handleUpdate = async (id: string, field: keyof LiveBooking, value: any, dbFieldOverride?: string, saveToDb: boolean = true) => {
    const booking = allBookings.find(b => b.id === id);
    if (!booking) return;

    let updatedBooking = { ...booking, [field]: value };

    // PERFECT PRE-FILL LOGIC: Dynamically re-calculate Net Sales when Base or Surcharge changes locally
    if (field === 'amount' || field === 'additional_price' || field === 'discount_pct') {
      const base = field === 'amount' ? Number(value) : booking.amount;
      const extra = field === 'additional_price' ? Number(value) : Number(booking.additional_price || 0);
      const disc = field === 'discount_pct' ? Number(value) : booking.discount_pct;

      const newNetSales = (base + extra) * (1 - (disc / 100));
      updatedBooking.received_payment = newNetSales; // Instantly overrides the Paid input box visually!
    }

    // Instantly update UI Local State
    setAllBookings(prev => prev.map(b => b.id === id ? updatedBooking : b));

    // If we only want local state updates (for typing in Extra Mins/Prices), exit before DB call
    if (!saveToDb) return;

    try {
      const table = booking.source === 'live' ? 'bookings' : 'bookings_import';
      const idField = booking.source === 'live' ? 'booking_id' : 'id';
      const actualDbField = dbFieldOverride || field;

      const payloadToUpdate: any = {
        [actualDbField]: value,
        receptionist_track: currentUserEmail
      };

      // Ensure the database registers the new auto-calculated 'Paid' value as well
      if (field === 'amount' || field === 'additional_price' || field === 'discount_pct') {
        payloadToUpdate.received_payment = updatedBooking.received_payment;
      }

      const { error } = await supabase.from(table).update(payloadToUpdate).eq(idField, booking.rawId);

      if (error) {
        console.warn(`Could not save ${field}.`, error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ─── EXPLICIT EXTRAS SAVE FUNCTION ───
  const saveExtras = async (booking: LiveBooking) => {
    try {
      const table = booking.source === 'live' ? 'bookings' : 'bookings_import';
      const idField = booking.source === 'live' ? 'booking_id' : 'id';

      const netSales = (booking.amount + Number(booking.additional_price || 0)) * (1 - (booking.discount_pct / 100));

      const { error } = await supabase.from(table).update({
        additional_mins: booking.additional_mins,
        additional_price: booking.additional_price,
        received_payment: netSales,
        receptionist_track: currentUserEmail
      }).eq(idField, booking.rawId);

      if (error) throw error;
      alert("Extension saved successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to save extension.");
    }
  };

  // ─── FILE UPLOAD TO SUPABASE STORAGE ───
  const handleFileUpload = async (id: string, file: File) => {
    const booking = allBookings.find(b => b.id === id);
    if (!booking || !file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const dateFolder = formatDateToYYYYMMDD(parseImportDate(booking.rawDate)) || getTodayStr();
      const safeClientName = booking.client.replace(/[^a-zA-Z0-9]/g, "_").trim();
      const filePath = `${dateFolder}/${safeClientName}/receipt-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, file);
      if (uploadError) {
        alert("Failed to upload receipt. Make sure you created a 'receipts' storage bucket in Supabase and it is public.");
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filePath);
      handleUpdate(id, 'receipt_url', publicUrl);
      alert("Receipt attached successfully!");

    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  // ─── HELPERS ───
  const formatCurrency = (val: number) => `₱${val.toLocaleString('en-PH')}`;
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return { bg: 'rgba(61,122,74,0.1)', color: '#3D7A4A', border: '1px solid rgba(61,122,74,0.3)' };
      case 'Ongoing': return { bg: 'rgba(197,143,59,0.1)', color: '#C58F3B', border: '1px solid rgba(197,143,59,0.3)' };
      case 'Hold': return { bg: 'rgba(200,50,50,0.1)', color: '#C83232', border: '1px solid rgba(200,50,50,0.3)' };
      default: return { bg: 'rgba(26,26,26,0.05)', color: '#666', border: '1px solid rgba(26,26,26,0.2)' };
    }
  };

  const TOTAL_MINUTES = 14 * 60; // 14 hours (11am to 1am)
  const getMinutesFrom11AM = (timeStr: string) => {
    if (!timeStr || timeStr === '—') return 0;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;
    let h = parseInt(match[1]);
    const m = parseInt(match[2]);
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    if (h < 11) h += 24;
    const totalMins = (h * 60) + m;
    const offset = totalMins - (11 * 60);
    return Math.max(0, Math.min(offset, TOTAL_MINUTES));
  };
  const HOURS_MARKERS = ['11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM', '8 PM', '9 PM', '10 PM', '11 PM', '12 AM', '1 AM'];

  return (
    <div style={{ backgroundColor: BG, minHeight: '100vh', padding: 'clamp(16px, 4vw, 40px)', fontFamily: BODY, width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto', width: '100%' }}>

        <div style={{ borderBottom: '1px solid rgba(197,143,59,0.2)', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontFamily: DSP, fontSize: '32px', color: BLACK, margin: 0 }}>Overview POS</h1>
          <div style={{ display: 'flex', gap: 12 }}>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ padding: '0 16px', height: 38, borderRadius: 8, border: '1px solid rgba(26,26,26,0.2)' }} />
            <button onClick={fetchEverything} style={{ padding: '0 16px', height: 38, background: 'none', border: `1px solid ${GOLD}`, color: GOLD, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Live Synced</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 40 }}>
          {[
            { label: 'COMPLETED', value: metrics.completed, color: '#3D7A4A' },
            { label: 'PENDING', value: metrics.pending, color: '#1A1A1A' },
            { label: 'ONGOING', value: metrics.ongoing, color: '#C58F3B' },
            { label: 'HOLD', value: metrics.hold, color: '#C83232' }
          ].map((metric) => (
            <div key={metric.label} style={{ backgroundColor: WHITE, padding: '24px', borderRadius: 12, border: '1px solid rgba(26,26,26,0.08)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#666', margin: '0 0 16px 0' }}>{metric.label}</p>
              <h3 style={{ fontSize: 32, fontWeight: 700, color: metric.color, margin: 0 }}>{metric.value}</h3>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid rgba(26,26,26,0.1)', marginBottom: 20 }}>
          <button onClick={() => setView('LIST')} style={{ padding: '12px 24px', border: 'none', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: view === 'LIST' ? WHITE : '#666', backgroundColor: view === 'LIST' ? BLACK : 'transparent', borderRadius: '8px 8px 0 0', cursor: 'pointer', transition: 'all 0.2s ease' }}>LIST TRACK VIEW (POS)</button>
          <button onClick={() => setView('GRID')} style={{ padding: '12px 24px', border: 'none', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: view === 'GRID' ? WHITE : '#666', backgroundColor: view === 'GRID' ? BLACK : 'transparent', borderRadius: '8px 8px 0 0', cursor: 'pointer', transition: 'all 0.2s ease' }}>DAILY SCHEDULE GRID</button>
        </div>

        {view === 'LIST' && (
          <div style={{ width: '100%', backgroundColor: WHITE, borderRadius: '0 12px 12px 12px', border: '1px solid rgba(26,26,26,0.08)', overflowX: 'auto', WebkitOverflowScrolling: 'touch', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12, minWidth: '1500px' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(249,244,235,0.5)', borderBottom: '1px solid rgba(26,26,26,0.08)' }}>
                  <th style={{ padding: '16px 12px', color: GOLD, fontWeight: 700, letterSpacing: '0.05em', whiteSpace: 'nowrap', minWidth: '240px' }}>TIME & CLIENT</th>
                  <th style={{ padding: '16px 12px', color: GOLD, fontWeight: 700, letterSpacing: '0.05em', minWidth: '240px' }}>SERVICE & NOTES</th>
                  <th style={{ padding: '16px 12px', color: GOLD, fontWeight: 700, letterSpacing: '0.05em', minWidth: '160px' }}>THERAPIST</th>
                  <th style={{ padding: '16px 12px', color: GOLD, fontWeight: 700, letterSpacing: '0.05em', minWidth: '140px' }}>AMOUNT</th>
                  <th style={{ padding: '16px 12px', color: GOLD, fontWeight: 700, letterSpacing: '0.05em', minWidth: '120px' }}>COMMISSION</th>
                  <th style={{ padding: '16px 12px', color: GOLD, fontWeight: 700, letterSpacing: '0.05em', minWidth: '180px' }}>PAYMENT DETAILS</th>
                  <th style={{ padding: '16px 12px', color: GOLD, fontWeight: 700, letterSpacing: '0.05em', minWidth: '130px' }}>PAYMENT STATUS</th>
                  <th style={{ padding: '16px 12px', color: GOLD, fontWeight: 700, letterSpacing: '0.05em', minWidth: '130px' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Fetching operations data...</td></tr>
                ) : dailyBookings.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No appointments scheduled for {selectedDate}.</td></tr>
                ) : (
                  dailyBookings.map((b) => {
                    const extraCost = Number(b.additional_price || 0);
                    const netSales = (b.amount + extraCost) * (1 - (b.discount_pct / 100));
                    const commAmount = netSales * (b.therapist_comm_pct / 100);
                    const isOnlinePay = ['GCASH', 'BANK TRANSFER', 'QRPH', 'MASTERCARD'].includes(b.payment_method);
                    const calculatedChange = Math.max(0, b.received_payment - netSales);

                    return (
                      <tr key={b.id} style={{ borderBottom: '1px solid rgba(26,26,26,0.05)', verticalAlign: 'top' }}>

                        {/* CUSTOM EDITABLE TIME & SURCHARGE BLOCK */}
                        <td style={{ padding: '16px 12px', whiteSpace: 'nowrap' }}>
                          <input
                            type="text"
                            value={b.time}
                            onChange={(e) => handleUpdate(b.id, 'time', e.target.value, 'appointment_time')}
                            placeholder="e.g. 7:15 PM"
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 13, fontWeight: 800, border: '1px solid rgba(197,143,59,0.3)', backgroundColor: '#fff', color: BLACK, outline: 'none', marginBottom: 6, boxSizing: 'border-box' }}
                          />
                          <span style={{ color: '#666', fontWeight: 600, paddingLeft: 4, display: 'block', marginBottom: 10, fontSize: 13 }}>{b.client}</span>

                          <div style={{ padding: '12px', backgroundColor: 'rgba(197,143,59,0.05)', borderRadius: 8, border: '1px dashed rgba(197,143,59,0.4)', marginTop: 12 }}>
                            <label style={{ fontSize: 10, fontWeight: 800, color: GOLD, display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>EXTRA RUNTIME (MINS)</label>
                            <input
                              type="number"
                              value={b.additional_mins === 0 ? '' : b.additional_mins}
                              onChange={(e) => handleUpdate(b.id, 'additional_mins', Number(e.target.value), undefined, false)}
                              placeholder="e.g. 30"
                              style={{ width: '100%', padding: '8px', border: '1px solid rgba(26,26,26,0.1)', borderRadius: 6, fontSize: 12, marginBottom: 12, boxSizing: 'border-box', outline: 'none' }}
                            />

                            <label style={{ fontSize: 10, fontWeight: 800, color: GOLD, display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>SURCHARGE PRICE (₱)</label>
                            <input
                              type="number"
                              value={b.additional_price === 0 ? '' : b.additional_price}
                              onChange={(e) => handleUpdate(b.id, 'additional_price', Number(e.target.value), undefined, false)}
                              placeholder="e.g. 300"
                              style={{ width: '100%', padding: '8px', border: '1px solid rgba(26,26,26,0.1)', borderRadius: 6, fontSize: 12, marginBottom: 12, boxSizing: 'border-box', outline: 'none' }}
                            />

                            <button
                              onClick={() => saveExtras(b)}
                              style={{ width: '100%', padding: '10px', backgroundColor: BLACK, color: GOLD, border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase', transition: 'all 0.2s' }}
                            >
                              Save Extras
                            </button>
                          </div>
                        </td>

                        {/* Service & Notes */}
                        <td style={{ padding: '16px 12px' }}>
                          <textarea
                            value={b.service}
                            onChange={e => handleUpdate(b.id, 'service', e.target.value, b.source === 'live' ? 'service_name' : 'service')}
                            placeholder="Add continuous services..."
                            style={{ width: '100%', minHeight: 60, padding: 10, borderRadius: 6, border: '1px solid rgba(197,143,59,0.4)', backgroundColor: 'rgba(197,143,59,0.02)', fontSize: 12, fontWeight: 600, color: '#2A2A2A', fontFamily: BODY, resize: 'vertical', boxSizing: 'border-box', marginBottom: 10, outline: 'none' }}
                          />
                          <textarea
                            value={b.notes}
                            onChange={e => handleUpdate(b.id, 'notes', e.target.value)}
                            placeholder="Add client notes..."
                            style={{ width: '100%', minHeight: 60, padding: 10, borderRadius: 6, border: '1px solid rgba(26,26,26,0.1)', fontSize: 12, fontFamily: BODY, resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
                          />
                        </td>

                        {/* Therapist */}
                        <td style={{ padding: '16px 12px' }}>
                          <select value={b.therapist || 'Unassigned'} onChange={(e) => handleUpdate(b.id, 'therapist', e.target.value, b.source === 'live' ? 'therapist_name' : 'therapist')} style={{ width: '100%', padding: '8px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px solid rgba(26,26,26,0.15)', color: b.therapist ? BLACK : '#888', outline: 'none', backgroundColor: '#FDFDFD', boxSizing: 'border-box' }}>
                            <option value="Unassigned">Unassigned</option>
                            {staffList.map(staff => <option key={staff.id} value={staff.name}>{staff.name}</option>)}
                          </select>
                        </td>

                        {/* Amount */}
                        <td style={{ padding: '16px 12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                              <span style={{ color: '#666' }}>Base:</span>
                              <input type="number" value={b.amount === 0 ? '' : b.amount} onChange={e => handleUpdate(b.id, 'amount', Number(e.target.value), b.source === 'live' ? 'price' : 'service_amount')} style={{ width: 65, padding: 6, textAlign: 'right', border: '1px solid rgba(197,143,59,0.5)', borderRadius: 4, fontWeight: 700, color: BLACK, outline: 'none' }} />
                            </div>

                            {/* SURCHARGE ADDITION UI */}
                            {extraCost > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                                <span style={{ color: GOLD, fontWeight: 700 }}>Extra:</span>
                                <span style={{ color: GOLD, fontWeight: 700 }}>+{formatCurrency(extraCost)}</span>
                              </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                              <span style={{ color: '#666' }}>Disc %:</span>
                              <input type="number" value={b.discount_pct === 0 ? '' : b.discount_pct} onChange={e => handleUpdate(b.id, 'discount_pct', Number(e.target.value))} style={{ width: 45, padding: 6, textAlign: 'right', border: '1px solid rgba(26,26,26,0.1)', borderRadius: 4, outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, borderTop: '1px solid rgba(26,26,26,0.1)', paddingTop: 6, marginTop: 4 }}>
                              <span style={{ color: GOLD, fontWeight: 700 }}>Net:</span>
                              <strong style={{ color: '#3D7A4A' }}>{formatCurrency(netSales)}</strong>
                            </div>
                          </div>
                        </td>

                        {/* Commission */}
                        <td style={{ padding: '16px 12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                              <span style={{ color: '#666' }}>Comm %:</span>
                              <input type="number" value={b.therapist_comm_pct === 0 ? '' : b.therapist_comm_pct} onChange={e => handleUpdate(b.id, 'therapist_comm_pct', Number(e.target.value))} style={{ width: 45, padding: 6, textAlign: 'right', border: '1px solid rgba(26,26,26,0.1)', borderRadius: 4, outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, borderTop: '1px solid rgba(26,26,26,0.1)', paddingTop: 6, marginTop: 4 }}>
                              <span style={{ color: '#666', fontWeight: 600 }}>Earned:</span>
                              <strong>{formatCurrency(commAmount)}</strong>
                            </div>
                          </div>
                        </td>

                        {/* Payment Details */}
                        <td style={{ padding: '16px 12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <select value={b.payment_method} onChange={(e) => handleUpdate(b.id, 'payment_method', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: '1px solid rgba(26,26,26,0.15)', outline: 'none', boxSizing: 'border-box' }}>
                              <option value="PAY AT COUNTER">PAY AT COUNTER</option>
                              <option value="CASH">CASH</option>
                              <option value="GCASH">GCASH</option>
                              <option value="BANK TRANSFER">BANK TRANSFER</option>
                              <option value="QRPH">QRPH</option>
                              <option value="MASTERCARD">MASTERCARD</option>
                            </select>

                            {isOnlinePay && (
                              <input type="text" placeholder="Ref #..." value={b.ref_no} onChange={e => handleUpdate(b.id, 'ref_no', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 6, fontSize: 11, border: '1px dashed rgba(197,143,59,0.5)', outline: 'none', boxSizing: 'border-box' }} />
                            )}

                            {isOnlinePay && !b.receipt_url && (
                              <input type="file" accept="image/*" onChange={e => e.target.files && handleFileUpload(b.id, e.target.files[0])} style={{ fontSize: 10, maxWidth: '100%' }} />
                            )}

                            {b.receipt_url && (
                              <a href={b.receipt_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: GOLD, fontWeight: 700, textDecoration: 'underline' }}>View Receipt</a>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                              <span style={{ fontSize: 11, color: '#666' }}>Paid:</span>
                              <input type="number" value={b.received_payment === 0 ? '' : b.received_payment} onChange={e => handleUpdate(b.id, 'received_payment', Number(e.target.value))} style={{ width: '100%', padding: 6, fontSize: 12, fontWeight: 700, color: '#3D7A4A', border: '1px solid rgba(61,122,74,0.3)', borderRadius: 4, boxSizing: 'border-box', outline: 'none' }} />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', backgroundColor: 'rgba(26,26,26,0.03)', borderRadius: 4, marginTop: 4 }}>
                              <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>Change:</span>
                              <strong style={{ fontSize: 12, color: BLACK }}>{formatCurrency(calculatedChange)}</strong>
                            </div>
                          </div>
                        </td>

                        {/* Payment Status */}
                        <td style={{ padding: '16px 12px' }}>
                          <select
                            value={b.payment_status}
                            onChange={(e) => handleUpdate(b.id, 'payment_status', e.target.value)}
                            style={{
                              width: '100%', padding: '8px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', outline: 'none', boxSizing: 'border-box',
                              backgroundColor: b.payment_status === 'PAID' ? 'rgba(61,122,74,0.1)' : 'rgba(200,50,50,0.1)',
                              color: b.payment_status === 'PAID' ? '#3D7A4A' : '#C83232',
                              border: b.payment_status === 'PAID' ? '1px solid rgba(61,122,74,0.3)' : '1px solid rgba(200,50,50,0.3)'
                            }}
                          >
                            <option value="UNPAID">UNPAID</option>
                            <option value="PAID">PAID</option>
                          </select>
                        </td>

                        {/* General Status */}
                        <td style={{ padding: '16px 12px' }}>
                          <select value={b.status} onChange={(e) => handleUpdate(b.id, 'status', e.target.value)} style={{ ...getStatusColor(b.status), width: '100%', padding: '8px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', outline: 'none', boxSizing: 'border-box' }}>
                            <option value="Pending">Pending</option><option value="Ongoing">Ongoing</option><option value="Completed">Completed</option><option value="Hold">Hold</option><option value="Cancelled">Cancelled</option>
                          </select>
                        </td>

                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── EXACT MINUTE SCHEDULE GRID (GANTT VIEW WITH EXTENSIONS) ─── */}
        {view === 'GRID' && (
          <div style={{ width: '100%', backgroundColor: WHITE, borderRadius: '0 12px 12px 12px', border: '1px solid rgba(26,26,26,0.08)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(26,26,26,0.08)', backgroundColor: '#FDFCF8' }}>
              <span style={{ fontSize: 13, color: '#666' }}>Timeline Grid Scheduler — Width dynamically adjusts based on custom runtime extensions.</span>
            </div>

            <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ minWidth: '1200px' }}>
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(26,26,26,0.08)', backgroundColor: 'rgba(249,244,235,0.5)' }}>
                  <div style={{ width: '220px', flexShrink: 0, padding: '16px 20px', borderRight: '1px solid rgba(26,26,26,0.08)' }}>
                    <span style={{ color: GOLD, fontWeight: 700, letterSpacing: '0.1em', fontSize: 10 }}>THERAPIST</span>
                  </div>
                  <div style={{ display: 'flex', flexGrow: 1, position: 'relative' }}>
                    {HOURS_MARKERS.slice(0, -1).map((hour, i) => (
                      <div key={i} style={{ flex: 1, borderRight: i < 13 ? '1px dashed rgba(26,26,26,0.1)' : 'none', padding: '16px 0', textAlign: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#666' }}>{hour}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {loading ? (
                  <div style={{ padding: '60px', textAlign: 'center', color: '#666' }}>Generating timeline visualization...</div>
                ) : (
                  [{ id: 'unassigned-row', name: 'Unassigned', role: 'Requires Assignment', off_days: [] }, ...staffList].map((staff) => {
                    const staffBookings = dailyBookings.filter(b => {
                      const dbTherapist = String(b.therapist || 'unassigned').trim().toLowerCase();
                      const targetTherapist = staff.name.toLowerCase();
                      return dbTherapist === targetTherapist;
                    });

                    // Off-Duty Calculation
                    let isOffDuty = false;
                    if (selectedDate && staff.name !== 'Unassigned') {
                      const [y, m, d] = selectedDate.split('-').map(Number);
                      const selectedDateObj = new Date(y, m - 1, d);
                      const dayName = selectedDateObj.toLocaleDateString('en-US', { weekday: 'long' });
                      if (staff.off_days && staff.off_days.includes(dayName)) {
                        isOffDuty = true;
                      }
                    }

                    return (
                      <div key={staff.name} style={{ display: 'flex', borderBottom: '1px solid rgba(26,26,26,0.08)', minHeight: '90px' }}>
                        <div style={{ width: '220px', flexShrink: 0, padding: '20px', borderRight: '1px solid rgba(26,26,26,0.08)', backgroundColor: staff.name === 'Unassigned' || isOffDuty ? '#FAFAFA' : '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: isOffDuty ? '#aaa' : BLACK }}>{staff.name.toUpperCase()}</span>
                          {staff.role && <span style={{ fontSize: 9, color: staff.name === 'Unassigned' ? '#C83232' : '#888', marginTop: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{isOffDuty ? 'OFF DUTY TODAY' : staff.role}</span>}
                        </div>

                        <div style={{ flexGrow: 1, position: 'relative', backgroundColor: isOffDuty ? 'rgba(26,26,26,0.03)' : 'transparent', backgroundImage: isOffDuty ? 'none' : 'linear-gradient(to right, transparent 99%, rgba(26,26,26,0.05) 100%)', backgroundSize: `${100 / 14}% 100%` }}>

                          {isOffDuty && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                              <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.2em', color: '#1A1A1A' }}>UNAVAILABLE</span>
                            </div>
                          )}

                          {!isOffDuty && staffBookings.map(b => {
                            if (!b.time || b.time === '—') return null;
                            const startMins = getMinutesFrom11AM(b.time);
                            const leftPercent = (startMins / TOTAL_MINUTES) * 100;

                            // ─── DYNAMIC WIDTH ENGINE (Base 60 min + Custom Surcharge Mins) ───
                            const totalDuration = 60 + Number(b.additional_mins || 0);
                            const widthPercent = (totalDuration / TOTAL_MINUTES) * 100;
                            const colors = getStatusColor(b.status);

                            return (
                              <div
                                key={b.id}
                                onClick={() => setGridModalBooking(b)}
                                style={{
                                  position: 'absolute', left: `${leftPercent}%`, top: '10px', bottom: '10px',
                                  width: `calc(${widthPercent}% - 4px)`, minWidth: '140px', backgroundColor: WHITE,
                                  border: '1px solid rgba(26,26,26,0.15)', borderLeft: `4px solid ${colors.color}`,
                                  borderRadius: '6px', padding: '8px 12px', display: 'flex', flexDirection: 'column',
                                  gap: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', zIndex: 10, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.1s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                              >
                                <span style={{ fontSize: 11, fontWeight: 800, color: BLACK }}>{b.time} <span style={{ color: GOLD }}>({totalDuration}m)</span></span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: BLACK, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{b.client}</span>
                                <span style={{ fontSize: 10, color: '#666', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{b.service}</span>
                                <span style={{ display: 'inline-block', backgroundColor: colors.bg, color: colors.color, padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, width: 'fit-content', marginTop: 'auto' }}>
                                  {b.status.toUpperCase()}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── GRID BOOKING INFO POPUP ─── */}
        {gridModalBooking && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: WHITE, borderRadius: '16px', width: '100%', maxWidth: '500px', padding: '30px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: GOLD, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{gridModalBooking.time}</span>
                  <h2 style={{ fontFamily: DSP, fontSize: 28, color: BLACK, margin: '4px 0 0' }}>{gridModalBooking.client}</h2>
                </div>
                <button onClick={() => setGridModalBooking(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#666' }}>&times;</button>
              </div>
              <div style={{ backgroundColor: '#FDFCF8', padding: 16, borderRadius: 8, border: '1px solid rgba(26,26,26,0.05)', marginBottom: 20 }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#666' }}><strong style={{ color: BLACK }}>Service:</strong> {gridModalBooking.service}</p>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#666' }}><strong style={{ color: BLACK }}>Assigned:</strong> {gridModalBooking.therapist || 'Unassigned'}</p>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#666' }}><strong style={{ color: BLACK }}>Added Runtime:</strong> {gridModalBooking.additional_mins || 0} minutes</p>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#666' }}><strong style={{ color: BLACK }}>Status:</strong> <span style={{ color: getStatusColor(gridModalBooking.status).color, fontWeight: 700 }}>{gridModalBooking.status}</span></p>
                <p style={{ margin: '0', fontSize: 13, color: '#666' }}><strong style={{ color: BLACK }}>Notes:</strong> {gridModalBooking.notes || 'None'}</p>
              </div>
              <button onClick={() => { setGridModalBooking(null); setView('LIST'); }} style={{ width: '100%', padding: '12px', backgroundColor: BLACK, color: GOLD, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>GO TO POS VIEW TO EDIT</button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}