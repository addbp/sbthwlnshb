'use client'

// app/dashboard/overview/page.tsx
// Phase 22: Bulletproof Limitless Overview (Fixed Supabase Column Mismatch)

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const BG = '#F9F4EB'
const BLACK = '#1A1A1A'
const GOLD = '#C58F3B'
const WHITE = '#FFFFFF'
const BODY = "'Inter', system-ui, sans-serif"
const DSP = "'Cormorant Garamond', Georgia, serif"

// ─── UTILITIES ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCurrency(val: any): number {
  if (!val) return 0;
  return Number(String(val).replace(/[^0-9.-]+/g, '')) || 0;
}

function parseImportDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const clean = String(raw).trim();

  // 1. Try Live Bookings Format (YYYY-MM-DD)
  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]), 12, 0, 0);
  }

  // 2. Try Import Format (DD-MMM-YY)
  const dashMatch = clean.match(/^(\d{1,2})[-\s/]+([A-Za-z]{3,})[-\s/]+(\d{2,4})$/);
  if (dashMatch) {
    let year = dashMatch[3];
    if (year.length === 2) year = '20' + year;
    const d = new Date(`${dashMatch[2]} ${dashMatch[1]}, ${year}`);
    if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  }

  // 3. Fallback standard parsing
  const fallback = new Date(clean);
  if (!isNaN(fallback.getTime())) return fallback;
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
  amount: number;
  status: string;
  therapist: string | null;
  createdAt: string;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
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

  const [allBookings, setAllBookings] = useState<LiveBooking[]>([])
  const [dailyBookings, setDailyBookings] = useState<LiveBooking[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])

  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({ completed: 0, pending: 0, ongoing: 0, hold: 0 })

  // ─── MASTER DATA FETCHER (UNLIMITED) ───
  const fetchEverything = useCallback(async () => {
    setLoading(true);
    try {
      // Bulletproof generic fetcher that grabs ALL columns (*) to prevent Supabase crashes
      const fetchUnlimited = async (tableName: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allRecords: any[] = [];
        let start = 0;
        const step = 1000;
        for (; ;) {
          const { data, error } = await supabase.from(tableName).select('*').range(start, start + step - 1);
          if (error) {
            console.error(`Error fetching ${tableName}:`, error);
            break;
          }
          if (!data || data.length === 0) break;
          allRecords.push(...data);
          if (data.length < step) break;
          start += step;
        }
        return allRecords;
      };

      // 1. Fetch Staff
      const rawStaff = await fetchUnlimited('staff');
      const mappedStaff = rawStaff.map(t => ({
        id: String(t.id),
        name: String(t.name || t.therapist_name || 'Unnamed Staff').trim(),
        role: String(t.role || t.specialty || 'Staff')
      })).sort((a, b) => a.name.localeCompare(b.name));
      setStaffList(mappedStaff);

      const uniqueRows = new Map<string, LiveBooking>();

      // 2. Fetch Live Bookings Safely
      const liveData = await fetchUnlimited('bookings');
      liveData.forEach(b => {
        const amt = parseCurrency(b.price || b.amount || b.received_payment);
        const client = String(b.client_name || 'Guest').trim();
        const timeStr = String(b.appointment_time || '—').trim();
        const rawDateStr = b.appointment_date;

        const row: LiveBooking = {
          id: `live-${b.booking_id}`,
          rawId: b.booking_id,
          source: 'live',
          rawDate: rawDateStr,
          time: timeStr,
          client: client,
          service: String(b.service_name || b.service || '—'),
          amount: amt,
          status: b.status || 'Pending',
          therapist: b.therapist_name || null,
          createdAt: b.created_at || new Date().toISOString()
        };

        const standardDate = formatDateToYYYYMMDD(parseImportDate(rawDateStr));
        const dedupKey = `${client.toLowerCase()}-${amt}-${timeStr}-${standardDate}`;
        uniqueRows.set(dedupKey, row);
      });

      // 3. Fetch Import Bookings Safely
      const impData = await fetchUnlimited('bookings_import');
      impData.forEach((r, idx) => {
        const amt = parseCurrency(r.amount || r.received_payment || r.service_amount);
        const client = String(r.client_name || 'Guest').trim();
        const timeStr = String(r.time || r.appointment_time || '—').trim();
        const rawDateStr = r.date;

        const row: LiveBooking = {
          id: `imp-${r.id || idx}`,
          rawId: r.id,
          source: 'import',
          rawDate: rawDateStr,
          time: timeStr,
          client: client,
          service: String(r.service || '—'),
          amount: amt,
          status: r.status || 'Completed',
          therapist: r.therapist || null,
          createdAt: r.created_at || new Date().toISOString()
        };

        const standardDate = formatDateToYYYYMMDD(parseImportDate(rawDateStr));
        const dedupKey = `${client.toLowerCase()}-${amt}-${timeStr}-${standardDate}`;

        if (!uniqueRows.has(dedupKey)) {
          uniqueRows.set(dedupKey, row);
        }
      });

      const finalAllBookings = Array.from(uniqueRows.values());
      finalAllBookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setAllBookings(finalAllBookings);

    } catch (err) {
      console.error('Master Operations Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Load everything ONCE when the page mounts
  useEffect(() => {
    fetchEverything();
  }, [fetchEverything]);

  // ─── INSTANT IN-MEMORY DATE FILTERING ───
  useEffect(() => {
    const targetDateStr = selectedDate;

    const todaysBookings = allBookings.filter(b => {
      const parsed = parseImportDate(b.rawDate);
      const formatted = formatDateToYYYYMMDD(parsed);
      return formatted === targetDateStr;
    });

    setDailyBookings(todaysBookings);

    setMetrics({
      completed: todaysBookings.filter(b => b.status === 'Completed').length,
      pending: todaysBookings.filter(b => b.status === 'Pending').length,
      ongoing: todaysBookings.filter(b => b.status === 'Ongoing').length,
      hold: todaysBookings.filter(b => b.status === 'Hold').length,
    });
  }, [selectedDate, allBookings]);


  // ─── SMART DUAL-TABLE DATABASE UPDATES ───
  const handleStatusChange = async (id: string, newStatus: string) => {
    const booking = allBookings.find(b => b.id === id);
    if (!booking) return;

    // Fast UI Update
    setAllBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));

    // Accurate Database Routing Update
    if (booking.source === 'live') {
      await supabase.from('bookings').update({ status: newStatus }).eq('booking_id', booking.rawId);
    } else {
      await supabase.from('bookings_import').update({ status: newStatus }).eq('id', booking.rawId);
    }
  };

  const handleStaffChange = async (id: string, newStaffName: string) => {
    const booking = allBookings.find(b => b.id === id);
    if (!booking) return;

    const finalStaff = newStaffName === 'Unassigned' ? null : newStaffName;

    // Fast UI Update
    setAllBookings(prev => prev.map(b => b.id === id ? { ...b, therapist: finalStaff } : b));

    // Accurate Database Routing Update
    if (booking.source === 'live') {
      await supabase.from('bookings').update({ therapist_name: finalStaff }).eq('booking_id', booking.rawId);
    } else {
      await supabase.from('bookings_import').update({ therapist: finalStaff }).eq('id', booking.rawId);
    }
  };

  // ─── HELPERS ───
  const formatCurrency = (val: number) => `₱${val.toLocaleString('en-PH')}`;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return { bg: 'rgba(61,122,74,0.1)', color: '#3D7A4A', border: '1px solid rgba(61,122,74,0.3)' };
      case 'Ongoing': return { bg: 'rgba(197,143,59,0.1)', color: '#C58F3B', border: '1px solid rgba(197,143,59,0.3)' };
      case 'Hold': return { bg: 'rgba(200,50,50,0.1)', color: '#C83232', border: '1px solid rgba(200,50,50,0.3)' };
      default: return { bg: 'rgba(26,26,26,0.05)', color: '#666', border: '1px solid rgba(26,26,26,0.2)' }; // Pending
    }
  };

  // ─── EXACT MINUTE TIMELINE CALCULATION LOGIC ───
  const TOTAL_MINUTES = 14 * 60; // 11:00 AM to 1:00 AM = 14 Hours

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

  const HOURS_MARKERS = [
    '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM',
    '6 PM', '7 PM', '8 PM', '9 PM', '10 PM', '11 PM', '12 AM', '1 AM'
  ];

  return (
    <div style={{ backgroundColor: BG, minHeight: '100vh', padding: '40px', fontFamily: BODY }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* HEADER */}
        <div style={{ borderBottom: '1px solid rgba(197,143,59,0.2)', paddingBottom: '20px', marginBottom: '30px' }}>
          <h1 style={{ fontFamily: DSP, fontSize: '32px', color: BLACK, margin: 0 }}>Overview</h1>
        </div>

        {/* CONTROLS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', color: GOLD, textTransform: 'uppercase', margin: '0 0 8px 0' }}>LIVE OPERATION STREAMS</p>
            <h2 style={{ fontFamily: DSP, fontSize: '28px', color: BLACK, margin: 0 }}>Management Overview</h2>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: '0 16px', height: 38, borderRadius: 8, border: '1px solid rgba(26,26,26,0.2)', fontFamily: BODY, fontSize: 13, outline: 'none', cursor: 'pointer' }}
            />
            <button
              onClick={fetchEverything}
              style={{ padding: '0 16px', height: 38, backgroundColor: 'transparent', border: `1px solid ${GOLD}`, borderRadius: 8, color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Live Synced
            </button>
          </div>
        </div>

        {/* METRICS CARDS */}
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

        {/* VIEW TABS */}
        <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid rgba(26,26,26,0.1)', marginBottom: 20 }}>
          <button
            onClick={() => setView('LIST')}
            style={{
              padding: '12px 24px', border: 'none', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em',
              color: view === 'LIST' ? WHITE : '#666', backgroundColor: view === 'LIST' ? BLACK : 'transparent',
              borderRadius: '8px 8px 0 0', cursor: 'pointer', transition: 'all 0.2s ease'
            }}
          >
            LIST TRACK VIEW
          </button>
          <button
            onClick={() => setView('GRID')}
            style={{
              padding: '12px 24px', border: 'none', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em',
              color: view === 'GRID' ? WHITE : '#666', backgroundColor: view === 'GRID' ? BLACK : 'transparent',
              borderRadius: '8px 8px 0 0', cursor: 'pointer', transition: 'all 0.2s ease'
            }}
          >
            DAILY SCHEDULE GRID
          </button>
        </div>

        {/* ─── LIST TRACK VIEW ─── */}
        {view === 'LIST' && (
          <div style={{ backgroundColor: WHITE, borderRadius: '0 12px 12px 12px', border: '1px solid rgba(26,26,26,0.08)', overflowX: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(249,244,235,0.5)', borderBottom: '1px solid rgba(26,26,26,0.08)' }}>
                  <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>DATE & TIME</th>
                  <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em' }}>CLIENT</th>
                  <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em' }}>SERVICE</th>
                  <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em' }}>REVENUE</th>
                  <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em' }}>STATUS CONTROL</th>
                  <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em' }}>ASSIGNED STAFF</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Fetching unlimited master data records...</td></tr>
                ) : dailyBookings.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No appointments scheduled for {selectedDate}.</td></tr>
                ) : (
                  dailyBookings.map((b) => (
                    <tr key={b.id} style={{ borderBottom: '1px solid rgba(26,26,26,0.05)' }}>
                      <td style={{ padding: '16px 20px', color: '#666', whiteSpace: 'nowrap' }}>
                        {b.rawDate} <br /> <strong style={{ color: BLACK }}>{b.time}</strong>
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: BLACK }}>{b.client}</td>
                      <td style={{ padding: '16px 20px', color: '#2A2A2A', maxWidth: 250, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.service}</td>
                      <td style={{ padding: '16px 20px', fontWeight: 700, color: BLACK }}>{formatCurrency(b.amount)}</td>

                      {/* LIVE STATUS DROPDOWN */}
                      <td style={{ padding: '16px 20px' }}>
                        <select
                          value={b.status}
                          onChange={(e) => handleStatusChange(b.id, e.target.value)}
                          style={{
                            ...getStatusColor(b.status),
                            padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                            cursor: 'pointer', outline: 'none', appearance: 'none', WebkitAppearance: 'none',
                            backgroundImage: `url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L4 4L7 1' stroke='${encodeURIComponent(getStatusColor(b.status).color)}' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 30
                          }}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Ongoing">Ongoing</option>
                          <option value="Completed">Completed</option>
                          <option value="Hold">Hold</option>
                        </select>
                      </td>

                      {/* LIVE STAFF DROPDOWN */}
                      <td style={{ padding: '16px 20px' }}>
                        <select
                          value={b.therapist || 'Unassigned'}
                          onChange={(e) => handleStaffChange(b.id, e.target.value)}
                          style={{
                            padding: '8px 12px', borderRadius: 6, fontSize: 12, fontFamily: BODY, fontWeight: 600,
                            border: '1px solid rgba(26,26,26,0.15)', color: b.therapist && b.therapist !== 'Unassigned' ? BLACK : '#888',
                            cursor: 'pointer', outline: 'none', backgroundColor: '#FDFDFD',
                            maxWidth: '200px', transition: 'border 0.2s ease'
                          }}
                        >
                          <option value="Unassigned">Unassigned</option>
                          {staffList.map(staff => (
                            <option key={staff.id} value={staff.name}>{staff.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── EXACT MINUTE SCHEDULE GRID (GANTT VIEW) ─── */}
        {view === 'GRID' && (
          <div style={{ backgroundColor: WHITE, borderRadius: '0 12px 12px 12px', border: '1px solid rgba(26,26,26,0.08)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(26,26,26,0.08)', backgroundColor: '#FDFCF8' }}>
              <span style={{ fontSize: 13, color: '#666' }}>Exact Timeline Scheduler — Selected Date: <strong style={{ color: BLACK }}>{selectedDate}</strong></span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: '1200px' }}>

                {/* TIMELINE HEADER (HOURS) */}
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(26,26,26,0.08)', backgroundColor: 'rgba(249,244,235,0.5)' }}>
                  <div style={{ width: '220px', flexShrink: 0, padding: '16px 20px', borderRight: '1px solid rgba(26,26,26,0.08)' }}>
                    <span style={{ color: GOLD, fontWeight: 700, letterSpacing: '0.1em', fontSize: 10 }}>STAFF MEMBER</span>
                  </div>
                  <div style={{ display: 'flex', flexGrow: 1, position: 'relative' }}>
                    {HOURS_MARKERS.slice(0, -1).map((hour, i) => (
                      <div key={i} style={{ flex: 1, borderRight: i < 13 ? '1px dashed rgba(26,26,26,0.1)' : 'none', padding: '16px 0', textAlign: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#666' }}>{hour}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* TIMELINE ROWS (STAFF) */}
                {loading ? (
                  <div style={{ padding: '60px', textAlign: 'center', color: '#666' }}>Generating timeline visualization...</div>
                ) : (
                  [{ name: 'Unassigned', role: 'Requires Assignment' }, ...staffList].map((staff) => {

                    // Filter bookings for this staff member (ignoring case for safety)
                    const staffBookings = dailyBookings.filter(b => {
                      const dbTherapist = String(b.therapist || 'unassigned').trim().toLowerCase();
                      const targetTherapist = staff.name.toLowerCase();
                      return dbTherapist === targetTherapist;
                    });

                    // Hide completely empty rows (unless it is Unassigned)
                    if (staff.name !== 'Unassigned' && staffBookings.length === 0) return null;

                    return (
                      <div key={staff.name} style={{ display: 'flex', borderBottom: '1px solid rgba(26,26,26,0.08)', minHeight: '90px' }}>

                        {/* Staff Info Column */}
                        <div style={{ width: '220px', flexShrink: 0, padding: '20px', borderRight: '1px solid rgba(26,26,26,0.08)', backgroundColor: staff.name === 'Unassigned' ? '#FAFAFA' : '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: BLACK }}>{staff.name.toUpperCase()}</span>
                          {staff.role && <span style={{ fontSize: 9, color: staff.name === 'Unassigned' ? '#C83232' : '#888', marginTop: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{staff.role}</span>}
                        </div>

                        {/* Booking Canvas for this Staff (Continuous Timeline) */}
                        <div style={{ flexGrow: 1, position: 'relative', backgroundImage: 'linear-gradient(to right, transparent 99%, rgba(26,26,26,0.05) 100%)', backgroundSize: `${100 / 14}% 100%` }}>

                          {staffBookings.map(b => {
                            if (!b.time || b.time === '—') return null;

                            const startMins = getMinutesFrom11AM(b.time);
                            const leftPercent = (startMins / TOTAL_MINUTES) * 100;
                            const widthPercent = (60 / TOTAL_MINUTES) * 100;
                            const colors = getStatusColor(b.status);

                            return (
                              <div key={b.id} style={{
                                position: 'absolute',
                                left: `${leftPercent}%`,
                                top: '10px',
                                bottom: '10px',
                                width: `calc(${widthPercent}% - 4px)`,
                                minWidth: '140px',
                                backgroundColor: WHITE,
                                border: '1px solid rgba(26,26,26,0.15)',
                                borderLeft: `4px solid ${colors.color}`,
                                borderRadius: '6px',
                                padding: '8px 12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                zIndex: 10,
                                overflow: 'hidden'
                              }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color: BLACK }}>{b.time}</span>
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

      </div>
    </div>
  )
}