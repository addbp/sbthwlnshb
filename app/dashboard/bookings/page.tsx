'use client'

// Phase 18: Live Daily Operations Tracker & Staff Assigner (FIXED STYLES)

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

interface LiveBooking {
  id: string;
  date: string;
  client: string;
  service: string;
  amount: number;
  status: string;
  therapist: string | null;
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

  const [selectedDate, setSelectedDate] = useState(getTodayStr())
  const [dailyBookings, setDailyBookings] = useState<LiveBooking[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)

  const [metrics, setMetrics] = useState({ completed: 0, pending: 0, ongoing: 0, hold: 0 })

  useEffect(() => {
    async function loadStaff() {
      const { data } = await supabase.from('staff').select('id, name, role').order('name');
      if (data) setStaffList(data);
    }
    loadStaff();
  }, [supabase]);

  const fetchDailyOperations = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('booking_id, appointment_date, client_name, service_name, price, status, therapist_name')
        .eq('appointment_date', selectedDate)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const mappedData = data.map(b => ({
          id: b.booking_id,
          date: b.appointment_date,
          client: b.client_name,
          service: b.service_name,
          amount: Number(b.price || 0),
          status: b.status || 'Pending',
          therapist: b.therapist_name
        }));

        setDailyBookings(mappedData);

        setMetrics({
          completed: mappedData.filter(b => b.status === 'Completed').length,
          pending: mappedData.filter(b => b.status === 'Pending').length,
          ongoing: mappedData.filter(b => b.status === 'Ongoing').length,
          hold: mappedData.filter(b => b.status === 'Hold').length,
        });
      }
    } catch (err) {
      console.error('Operations Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedDate]);

  useEffect(() => {
    fetchDailyOperations();
  }, [fetchDailyOperations]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setDailyBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
    await supabase.from('bookings').update({ status: newStatus }).eq('booking_id', id);
    fetchDailyOperations();
  };

  const handleStaffChange = async (id: string, newStaffName: string) => {
    const finalStaff = newStaffName === 'Unassigned' ? null : newStaffName;
    setDailyBookings(prev => prev.map(b => b.id === id ? { ...b, therapist: finalStaff } : b));
    await supabase.from('bookings').update({ therapist_name: finalStaff }).eq('booking_id', id);
  };

  const formatCurrency = (val: number) => `₱${val.toLocaleString('en-PH')}`;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return { bg: 'rgba(61,122,74,0.1)', color: '#3D7A4A', border: '1px solid rgba(61,122,74,0.3)' };
      case 'Ongoing': return { bg: 'rgba(197,143,59,0.1)', color: '#C58F3B', border: '1px solid rgba(197,143,59,0.3)' };
      case 'Hold': return { bg: 'rgba(200,50,50,0.1)', color: '#C83232', border: '1px solid rgba(200,50,50,0.3)' };
      default: return { bg: 'rgba(26,26,26,0.05)', color: '#666', border: '1px solid rgba(26,26,26,0.2)' };
    }
  };

  return (
    <div style={{ backgroundColor: BG, minHeight: '100vh', padding: '40px', fontFamily: BODY }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

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
              style={{ padding: '0 16px', height: 38, borderRadius: 8, border: '1px solid rgba(26,26,26,0.2)', fontFamily: BODY, fontSize: 13, outline: 'none' }}
            />
            <button
              onClick={fetchDailyOperations}
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

        {/* TABS (FIXED STYLES) */}
        <div style={{ display: 'flex', gap: 20, borderBottom: '1px solid rgba(26,26,26,0.1)', marginBottom: 20 }}>
          <button style={{ padding: '12px 24px', border: 'none', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: WHITE, backgroundColor: BLACK, borderRadius: '8px 8px 0 0', cursor: 'pointer' }}>
            LIST TRACK VIEW
          </button>
          <button style={{ padding: '12px 24px', border: 'none', background: 'none', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: '#666', cursor: 'not-allowed' }}>
            DAILY SCHEDULE GRID (WIP)
          </button>
        </div>

        {/* DATA GRID */}
        <div style={{ backgroundColor: WHITE, borderRadius: '0 12px 12px 12px', border: '1px solid rgba(26,26,26,0.08)', overflowX: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(249,244,235,0.5)', borderBottom: '1px solid rgba(26,26,26,0.08)' }}>
                <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em' }}>DATE</th>
                <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em' }}>CLIENT</th>
                <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em' }}>SERVICE</th>
                <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em' }}>REVENUE</th>
                <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em' }}>STATUS CONTROL</th>
                <th style={{ padding: '16px 20px', color: GOLD, fontWeight: 700, letterSpacing: '0.1em' }}>ASSIGNED STAFF</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Syncing live schedule...</td></tr>
              ) : dailyBookings.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No appointments scheduled for {selectedDate}.</td></tr>
              ) : (
                dailyBookings.map((b) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid rgba(26,26,26,0.05)' }}>
                    <td style={{ padding: '16px 20px', color: '#666' }}>{b.date}</td>
                    <td style={{ padding: '16px 20px', fontWeight: 600, color: BLACK }}>{b.client}</td>
                    <td style={{ padding: '16px 20px', color: '#2A2A2A', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.service}</td>
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
                          padding: '6px 10px', borderRadius: 6, fontSize: 12, fontFamily: BODY,
                          border: '1px solid rgba(26,26,26,0.1)', color: b.therapist ? BLACK : '#888',
                          cursor: 'pointer', outline: 'none', backgroundColor: 'transparent',
                          maxWidth: '180px'
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

      </div>
    </div>
  )
}