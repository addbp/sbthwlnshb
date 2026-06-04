'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ─────────────────────────────────────────────────────────────
interface BookingRecord {
  uniqueRowKey: string;
  id: string;
  client_name: string;
  service_name: string;
  amount: number;
  price: number;
  appointment_date: string;
  appointment_time: string;
  therapist_name: string;
  status: string;
  created_at: string;
}

interface StaffMember {
  id: string | number;
  name: string;
  role: string;
}

const TIME_SLOTS = [
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
  '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
  '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM',
  '8:00 PM', '8:30 PM', '9:00 PM', '9:30 PM', '10:00 PM', '10:30 PM',
  '11:00 PM', '11:30 PM', '12:00 AM'
];

const STATUS_OPTIONS = ['Pending', 'Ongoing', 'Completed', 'Hold'];

export default function OverviewDashboard() {
  const supabase = useRef(createClient()).current
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')

  const [calendarDate, setCalendarDate] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  })

  // ─── DATA ENGINE: PULL AND SYNCHRONIZE LEDGER DATA ───
  const refreshDashboardData = useCallback(async () => {
    try {
      const [bookingsRes, staffRes] = await Promise.all([
        supabase.from('bookings').select('*').order('appointment_date', { ascending: false }).order('appointment_time', { ascending: true }).limit(5000),
        supabase.from('staff').select('*').order('name', { ascending: true }).limit(1000)
      ])

      if (bookingsRes.data) {
        const isolatedRows = bookingsRes.data.map((b: any, index: number) => ({
          uniqueRowKey: `row-bkg-${b.id || b.booking_id || index}-${index}`,
          id: String(b.id || b.booking_id || ''),
          client_name: b.client_name || 'Guest',
          service_name: b.service_name || b.service || '—',
          amount: Number(b.amount || 0),
          price: Number(b.price || b.amount || 0),
          appointment_date: b.appointment_date || '',
          appointment_time: b.appointment_time || '',
          therapist_name: b.therapist_name || 'Unassigned',
          status: b.status || 'Pending',
          created_at: b.created_at || ''
        }))
        setBookings(isolatedRows)
      }

      if (staffRes.data) {
        setStaff(staffRes.data.map(t => ({
          id: t.id,
          name: t.name || t.full_name || 'Staff Member',
          role: t.role || 'Therapist'
        })))
      }
    } catch (err) {
      console.error("Dashboard ingestion pipeline error:", err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // ─── REALTIME DATABASE LISTENER SUBSCRIPTION ───
  useEffect(() => {
    refreshDashboardData()

    const realTimeChannel = supabase
      .channel('realtime-dashboard-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          refreshDashboardData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(realTimeChannel)
    }
  }, [refreshDashboardData, supabase])

  // ─── LIVE STATUS INDIVIDUAL TRANSACTION CONTROL ───
  const handleStatusTransition = async (targetRowKey: string, dbId: string, nextStatus: string) => {
    setBookings(prev => prev.map(b => b.uniqueRowKey === targetRowKey ? { ...b, status: nextStatus } : b))

    const { error } = await supabase.from('bookings').update({ status: nextStatus }).eq('id', dbId)
    if (error) {
      await supabase.from('bookings').update({ status: nextStatus }).eq('booking_id', dbId)
    }
  }

  // ─── CALCULATED METRICS FOR STATUS PLACECARDS ───
  const activeTodayBookings = bookings.filter(b => b.appointment_date === calendarDate)

  // Strictly calculated counts instead of price/revenue summaries
  const completedSessionsCount = bookings.filter(b => b.status === 'Completed').length
  const pendingApprovalsCount = bookings.filter(b => b.status === 'Pending').length
  const ongoingSessionsCount = bookings.filter(b => b.status === 'Ongoing').length
  const holdSessionsCount = bookings.filter(b => b.status === 'Hold').length

  const getStatusBadgeStyle = (status: string) => {
    const s = status.trim().toUpperCase()
    if (s === 'COMPLETED') return { backgroundColor: 'rgba(61,122,74,0.1)', color: '#3D7A4A' }
    if (s === 'ONGOING') return { backgroundColor: 'rgba(197,143,59,0.1)', color: '#C58F3B' }
    if (s === 'HOLD') return { backgroundColor: 'rgba(139,58,58,0.1)', color: '#8B3A3A' }
    return { backgroundColor: '#f5f5f5', color: '#666' }
  }

  return (
    <>
      <style>{`
        .ctrl-select { border: 1px solid rgba(26,26,26,0.12); padding: 6px 10px; border-radius: 6px; background-color: #fff; font-size: 12px; font-weight: 700; cursor: pointer; outline: none; transition: all 150ms ease; }
        .ctrl-select:hover { border-color: #C58F3B; }
        .grid-scroll::-webkit-scrollbar { height: 8px; }
        .grid-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.02); }
        .grid-scroll::-webkit-scrollbar-thumb { background: rgba(197,143,59,0.25); border-radius: 4px; }
        .date-picker-input { padding: 6px 12px; border: 1px solid rgba(197,143,59,0.3); border-radius: 8px; background-color: #fff; font-family: inherit; font-size: 12px; font-weight: 700; color: #1A1A1A; outline: none; }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Inter',system-ui,sans-serif" }}>

        {/* Top Header Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C58F3B', margin: '0 0 5px' }}>Live Operation Streams</p>
            <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 32, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Management Overview</h2>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="date" className="date-picker-input" value={calendarDate} onChange={(e) => setCalendarDate(e.target.value)} title="Select schedule validation focus day" />
            <button onClick={refreshDashboardData} style={{ padding: '0 16px', height: 38, border: '1px solid rgba(197,143,59,0.45)', borderRadius: 9, backgroundColor: 'transparent', color: '#C58F3B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>
              {loading ? 'Refreshing...' : 'Live Synced'}
            </button>
          </div>
        </div>

        {/* ─── METRIC PLACECARDS SHOWING COUNTS INSTEAD OF AMOUNT ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 8px', letterSpacing: '0.05em' }}>COMPLETED</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#3D7A4A', margin: 0 }}>{completedSessionsCount.toLocaleString()}</p>
          </div>
          <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 8px', letterSpacing: '0.05em' }}>PENDING</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{pendingApprovalsCount.toLocaleString()}</p>
          </div>
          <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 8px', letterSpacing: '0.05em' }}>ONGOING</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#C58F3B', margin: 0 }}>{ongoingSessionsCount.toLocaleString()}</p>
          </div>
          <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 14, padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#7A6E65', margin: '0 0 8px', letterSpacing: '0.05em' }}>HOLD</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#8B3A3A', margin: 0 }}>{holdSessionsCount.toLocaleString()}</p>
          </div>
        </div>

        {/* Tab Selection Row */}
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid rgba(26,26,26,0.1)', paddingBottom: 10 }}>
          <button onClick={() => setViewMode('list')} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', border: 'none', cursor: 'pointer', backgroundColor: viewMode === 'list' ? '#1A1A1A' : 'transparent', color: viewMode === 'list' ? '#C58F3B' : '#666' }}>
            List Track view
          </button>
          <button onClick={() => setViewMode('calendar')} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', border: 'none', cursor: 'pointer', backgroundColor: viewMode === 'calendar' ? '#1A1A1A' : 'transparent', color: viewMode === 'calendar' ? '#C58F3B' : '#666' }}>
            Daily Schedule Grid
          </button>
        </div>

        {/* Primary Views */}
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: '#fff', borderRadius: 16, border: '1px solid rgba(26,26,26,0.09)' }}>Synchronizing workspace data matrices...</div>
        ) : viewMode === 'list' ? (

          /* ─── LIVE DATA ENGINE TABLE VIEW ─── */
          <div style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8F4EE', borderBottom: '1px solid rgba(26,26,26,0.09)' }}>
                    {['Date', 'Client', 'Service', 'Revenue (Final Amount)', 'Status Control', 'Assigned Staff'].map(h => (
                      <th key={h} style={{ padding: '14px 20px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C58F3B', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    const badgeStyle = getStatusBadgeStyle(b.status)
                    return (
                      <tr key={b.uniqueRowKey} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                        <td style={{ padding: '16px 20px', color: '#666', whiteSpace: 'nowrap' }}>{b.appointment_date}</td>
                        <td style={{ padding: '16px 20px', fontWeight: 600, color: '#1A1A1A' }}>{b.client_name}</td>
                        <td style={{ padding: '16px 20px', color: '#2A2A2A' }}>{b.service_name}</td>
                        <td style={{ padding: '16px 20px', fontWeight: 700, color: '#1A1A1A' }}>₱{b.price.toLocaleString()}</td>

                        {/* Dropdown status update matrix layout interface */}
                        <td style={{ padding: '16px 20px' }}>
                          <select
                            value={b.status}
                            onChange={(e) => handleStatusTransition(b.uniqueRowKey, b.id, e.target.value)}
                            className="ctrl-select"
                            style={{ backgroundColor: badgeStyle.backgroundColor, color: badgeStyle.color, borderColor: badgeStyle.color }}
                          >
                            {STATUS_OPTIONS.map(opt => (
                              <option key={opt} value={opt} style={{ backgroundColor: '#fff', color: '#1A1A1A' }}>{opt}</option>
                            ))}
                          </select>
                        </td>

                        <td style={{ padding: '16px 20px', color: '#666', fontWeight: 500 }}>{b.therapist_name || 'Unassigned'}</td>
                      </tr>
                    )
                  })}
                  {bookings.length === 0 && <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No transactions recorded.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

        ) : (

          /* ─── REALTIME INTERLOCKING TIMELINE MATRIX GRID (REALIGNED AND FIXED) ─── */
          <div className="grid-scroll" style={{ backgroundColor: '#fff', border: '1px solid rgba(26,26,26,0.09)', borderRadius: 16, overflowX: 'auto', boxShadow: '0 3px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(197,143,59,0.2)' }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#1A1A1A', fontFamily: "'Cormorant Garamond',Georgia,serif" }}>
                Timeline Grid Scheduler — Realtime Verification Target Date: {calendarDate}
              </h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 1400, tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8F4EE', borderBottom: '1px solid rgba(26,26,26,0.09)' }}>
                  <th style={{ padding: '14px 20px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C58F3B', position: 'sticky', left: 0, backgroundColor: '#F8F4EE', zIndex: 10, borderRight: '1px solid rgba(26,26,26,0.09)', width: '220px', boxSizing: 'border-box' }}>
                    Staff Member
                  </th>
                  {TIME_SLOTS.map(t => (
                    <th key={t} style={{ padding: '14px 10px', fontSize: 10, fontWeight: 700, color: '#666', borderRight: '1px solid rgba(26,26,26,0.05)', width: '160px', boxSizing: 'border-box', textAlign: 'center' }}>
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(26,26,26,0.06)' }}>
                    <td style={{ padding: '14px 20px', position: 'sticky', left: 0, backgroundColor: '#fff', zIndex: 9, borderRight: '1px solid rgba(26,26,26,0.09)', boxShadow: '2px 0 5px rgba(0,0,0,0.02)', boxSizing: 'border-box' }}>
                      <div style={{ fontWeight: 700, color: '#1A1A1A', fontSize: 13, marginBottom: 2 }}>{s.name}</div>
                      <div style={{ fontSize: 9, color: '#888', textTransform: 'uppercase' }}>{s.role}</div>
                    </td>

                    {TIME_SLOTS.map(slotTime => {
                      const scheduleBlock = activeTodayBookings.find(b =>
                        b.therapist_name?.trim().toLowerCase() === s.name.trim().toLowerCase() &&
                        b.appointment_time?.trim().toUpperCase().replace(/\s+/g, ' ') === slotTime.trim().toUpperCase().replace(/\s+/g, ' ') &&
                        b.status !== 'Cancelled'
                      )

                      return (
                        <td key={slotTime} style={{ padding: '6px', borderRight: '1px solid rgba(26,26,26,0.05)', backgroundColor: scheduleBlock ? 'rgba(197,143,59,0.03)' : 'transparent', verticalAlign: 'top', boxSizing: 'border-box' }}>
                          {scheduleBlock ? (
                            <div style={{ padding: '8px', backgroundColor: '#fff', border: '1px solid rgba(197,143,59,0.3)', borderRadius: 6, borderLeft: '4px solid #C58F3B', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#1A1A1A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {scheduleBlock.client_name}
                              </div>
                              <div style={{ fontSize: 10, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                                {scheduleBlock.service_name}
                              </div>
                              <div style={{ marginTop: 6, display: 'inline-block', padding: '2px 6px', borderRadius: 4, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', ...getStatusBadgeStyle(scheduleBlock.status) }}>
                                {scheduleBlock.status}
                              </div>
                            </div>
                          ) : null}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {staff.length === 0 && <tr><td colSpan={TIME_SLOTS.length + 1} style={{ padding: '30px', textAlign: 'center', color: '#666' }}>No therapist profiles located to map timeline grid parameters.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}