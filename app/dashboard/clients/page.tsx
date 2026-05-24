'use client'

// app/dashboard/clients/page.tsx  —  Phase 4 Clients
// · Full client list from Supabase bookings (deduplicated by mobile)
// · Fixed: `client_mobile` crash via select('*')
// · Fixed: Session Cookie bug via createBrowserClient

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { type SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface ClientSummary {
  mobile: string
  name: string
  email: string
  visitCount: number
  totalSpend: number
  lastVisit: string
  topService: string
  topTherapist: string
}

interface VisitRecord {
  id: string
  service_name: string
  therapist_name: string
  amount: number
  status: string
  created_at: string
  appt_date: string
  appt_time: string
  payment_method: string
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const fmt = (n: number) => '₱' + n.toLocaleString('en-PH')

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'
}

const AVATAR_COLORS = [
  '#3D7A4A',
  '#2A6A8A',
  '#A07530',
  '#6A3D7A',
  '#7A3D40',
  '#3D5A7A',
  '#6E7A3D',
  '#7A4E3D',
]

function avatarColor(name: string) {
  return AVATAR_COLORS[((name.charCodeAt(0) ?? 65) - 65) % AVATAR_COLORS.length]
}

function mapVisit(row: Record<string, unknown>): VisitRecord {
  let apptTime = '--:--'
  let apptDate = ''

  try {
    if (row.appointment_time) {
      apptTime = String(row.appointment_time).slice(0, 5)
    } else if (row.created_at) {
      const d = new Date(String(row.created_at))

      if (!isNaN(d.getTime())) {
        apptTime = d.toLocaleTimeString('en-PH', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      }
    }

    apptDate = row.appointment_date
      ? String(row.appointment_date)
      : new Date(String(row.created_at)).toISOString().split('T')[0]
  } catch {
    // silent
  }

  return {
    id: String(row.id ?? ''),
    service_name: String(row.service_name ?? row.service ?? 'Service'),
    therapist_name: String(row.therapist_name ?? row.therapist ?? 'Staff'),
    amount: Number(row.amount ?? 0),
    status: String(row.status ?? 'unknown'),
    created_at: String(row.created_at ?? ''),
    appt_date: apptDate,
    appt_time: apptTime,
    payment_method: String(row.payment_method ?? '—'),
  }
}

function aggregateClients(rows: Record<string, unknown>[]): ClientSummary[] {
  const map: Record<string, { rows: Record<string, unknown>[] }> = {}

  for (const row of rows) {
    // Flexible mapping to grab whatever column the mobile number is actually in
    const mobile =
      String(row.client_mobile ?? row.mobile ?? '').trim() ||
      String(row.client_name ?? 'unknown')

    if (!map[mobile]) map[mobile] = { rows: [] }

    map[mobile].rows.push(row)
  }

  return Object.entries(map)
    .map(([mobile, { rows: r }]) => {
      const latestRow = r.sort((a, b) =>
        String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
      )[0]

      const totalSpend = r.reduce(
        (sum, x) => sum + (x.status === 'completed' ? Number(x.amount ?? 0) : 0),
        0
      )

      const therapistCounts: Record<string, number> = {}

      for (const x of r) {
        const t = String(x.therapist_name ?? x.therapist ?? '')

        if (t) therapistCounts[t] = (therapistCounts[t] ?? 0) + 1
      }

      const topTherapist =
        Object.entries(therapistCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

      const serviceCounts: Record<string, number> = {}

      for (const x of r) {
        const s = String(x.service_name ?? x.service ?? '')

        if (s) serviceCounts[s] = (serviceCounts[s] ?? 0) + 1
      }

      const topService =
        Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

      let lastVisit = ''

      try {
        lastVisit = new Date(String(latestRow.created_at ?? '')).toISOString().split('T')[0]
      } catch {
        // silent
      }

      return {
        mobile,
        name: String(latestRow.client_name ?? latestRow.client ?? 'Guest'),
        email: String(latestRow.client_email ?? latestRow.email ?? ''),
        visitCount: r.length,
        totalSpend,
        lastVisit,
        topService,
        topTherapist,
      }
    })
    .sort((a, b) => b.visitCount - a.visitCount)
}

// ─────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────
function Shim({
  w = '100%',
  h = 14,
  r = 6,
}: {
  w?: string | number
  h?: number
  r?: number
}) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: 'linear-gradient(90deg,#EDE8E0 0%,#E0D8CE 50%,#EDE8E0 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.6s linear infinite',
      }}
    />
  )
}

function ListSkeleton() {
  return (
    <>
      <style>{`@keyframes shimmer{from{background-position:-200% center}to{background-position:200% center}}`}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid rgba(26,26,26,0.09)',
              borderRadius: 14,
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <Shim w={48} h={48} r={24} />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Shim w="60%" h={16} />
              <Shim w="40%" h={12} />
            </div>

            <Shim w={80} h={12} />
          </div>
        ))}
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// CLIENT HISTORY PANEL  (full cross-branch history)
// ─────────────────────────────────────────────────────────────
function ClientHistoryPanel({
  client,
  onClose,
}: {
  client: ClientSummary
  onClose: () => void
}) {
  const supabaseRef = useRef<SupabaseClient | null>(null)

  if (!supabaseRef.current) {
    supabaseRef.current = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  const supabase = supabaseRef.current

  const [visits, setVisits] = useState<VisitRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      try {
        const { data, error: dbErr } = await supabase
          .from('bookings')
          .select('*') // CRITICAL: Use * to prevent column errors
          .or(`client_mobile.eq.${client.mobile},mobile.eq.${client.mobile}`)
          .order('created_at', { ascending: false })
          .limit(50)

        if (dbErr) throw new Error(dbErr.message)

        setVisits((data ?? []).map(mapVisit))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [client.mobile, supabase])

  const ac = avatarColor(client.name)

  const STATUS_COLOR: Record<string, string> = {
    completed: '#3D7A4A',
    in_progress: '#2A6A8A',
    confirmed: '#A07530',
    upcoming: '#7A6A50',
    cancelled: '#8B3A3A',
  }

  return (
    <>
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateX(32px)}to{opacity:1;transform:none}}`}</style>

      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          backgroundColor: 'rgba(10,8,6,0.45)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
        role="dialog"
        aria-modal="true"
      >
        <div
          style={{
            width: '100%',
            maxWidth: 460,
            backgroundColor: '#F9F4EB',
            backgroundImage: 'none',
            height: '100%',
            overflowY: 'auto',
            boxShadow: '-24px 0 60px rgba(0,0,0,0.20)',
            animation: 'slideIn 280ms cubic-bezier(0.22,1,0.36,1)',
            fontFamily: "'Inter',system-ui,sans-serif",
          }}
        >
          <div
            style={{
              position: 'sticky',
              top: 0,
              backgroundColor: '#F9F4EB',
              borderBottom: '1px solid rgba(26,26,26,0.10)',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              zIndex: 1,
            }}
          >
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: '50%',
                backgroundColor: ac,
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Cormorant Garamond',Georgia,serif",
                fontSize: 20,
                fontWeight: 400,
                flexShrink: 0,
              }}
            >
              {initials(client.name)}
            </div>

            <div style={{ flex: 1, overflow: 'hidden' }}>
              <h3
                style={{
                  fontFamily: "'Cormorant Garamond',Georgia,serif",
                  fontSize: 22,
                  fontWeight: 400,
                  color: '#1A1A1A',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {client.name}
              </h3>

              <p style={{ fontSize: 12, color: 'rgba(26,26,26,0.45)', margin: 0 }}>
                {client.mobile}
              </p>
            </div>

            <button
              onClick={onClose}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: '1px solid rgba(26,26,26,0.14)',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(26,26,26,0.40)',
                flexShrink: 0,
              }}
              aria-label="Close"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path
                  d="M1.5 1.5l10 10M11.5 1.5l-10 10"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Total Visits', value: String(client.visitCount) },
                { label: 'Total Spend', value: fmt(client.totalSpend) },
                { label: 'Preferred Service', value: client.topService, small: true },
                { label: 'Fave Therapist', value: client.topTherapist, small: true },
                { label: 'Last Visit', value: fmtDate(client.lastVisit), small: true },
                { label: 'Email', value: client.email || '—', small: true },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    backgroundColor: '#FFFFFF',
                    backgroundImage: 'none',
                    border: '1px solid rgba(26,26,26,0.09)',
                    borderRadius: 12,
                    padding: '12px 14px',
                  }}
                >
                  <p
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'rgba(26,26,26,0.40)',
                      margin: '0 0 4px',
                    }}
                  >
                    {s.label}
                  </p>

                  <p
                    style={{
                      fontSize: s.small ? 13 : 18,
                      fontWeight: s.small ? 500 : 700,
                      color: '#1A1A1A',
                      margin: 0,
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(197,143,59,0.08)',
                border: '1px solid rgba(197,143,59,0.22)',
                borderRadius: 10,
                fontSize: 12,
                color: 'rgba(26,26,26,0.55)',
                lineHeight: 1.55,
              }}
            >
              <strong style={{ color: '#C58F3B' }}>Cross-branch history</strong> — showing all
              visits regardless of which branch was booked.
            </div>

            <div>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'rgba(197,143,59,0.65)',
                  margin: '0 0 12px',
                }}
              >
                Visit History
              </p>

              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 12,
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <Shim w="60%" h={14} />
                      <Shim w="40%" h={11} />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div
                  style={{
                    padding: '12px 14px',
                    backgroundColor: 'rgba(139,58,58,0.09)',
                    border: '1px solid rgba(139,58,58,0.25)',
                    borderRadius: 10,
                    color: '#8B3A3A',
                    fontSize: 13,
                  }}
                >
                  {error}
                </div>
              ) : visits.length === 0 ? (
                <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.38)', fontStyle: 'italic' }}>
                  No booking history found for this client.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {visits.map((v) => (
                    <div
                      key={v.id}
                      style={{
                        backgroundColor: '#FFFFFF',
                        backgroundImage: 'none',
                        border: '1px solid rgba(26,26,26,0.09)',
                        borderRadius: 12,
                        padding: '14px 16px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 10,
                          marginBottom: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: '#1A1A1A',
                            lineHeight: 1.3,
                          }}
                        >
                          {v.service_name}
                        </span>

                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: '#1A1A1A',
                            flexShrink: 0,
                          }}
                        >
                          {fmt(v.amount)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'rgba(26,26,26,0.45)' }}>
                          {v.therapist_name}
                        </span>

                        <span style={{ fontSize: 11, color: 'rgba(26,26,26,0.28)' }}>·</span>

                        <span style={{ fontSize: 12, color: 'rgba(26,26,26,0.45)' }}>
                          {fmtDate(v.appt_date || v.created_at)}{' '}
                          {v.appt_time !== '--:--' ? `at ${v.appt_time}` : ''}
                        </span>

                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.10em',
                            textTransform: 'uppercase',
                            color: STATUS_COLOR[v.status] ?? '#7A6A50',
                            padding: '2px 8px',
                            borderRadius: 99,
                            backgroundColor: `${STATUS_COLOR[v.status] ?? '#7A6A50'}18`,
                            border: `1px solid ${STATUS_COLOR[v.status] ?? '#7A6A50'}44`,
                          }}
                        >
                          {v.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default function ClientsPage() {
  const supabaseRef = useRef<SupabaseClient | null>(null)

  if (!supabaseRef.current) {
    supabaseRef.current = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  const supabase = supabaseRef.current

  const [clients, setClients] = useState<ClientSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ClientSummary | null>(null)

  const loadClients = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch all bookings to compile the client list. Using * to avoid column mismatches.
      const { data, error: dbErr } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000)

      if (dbErr) throw new Error(dbErr.message)

      setClients(aggregateClients(data ?? []))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadClients()
  }, [loadClients])

  const filtered = clients.filter((c) => {
    if (!search.trim()) return true

    const q = search.toLowerCase()

    return (
      c.name.toLowerCase().includes(q) ||
      c.mobile.includes(q) ||
      c.email.toLowerCase().includes(q)
    )
  })

  const totalClients = clients.length
  const totalSpendAll = clients.reduce((a, c) => a + c.totalSpend, 0)
  const returningCount = clients.filter((c) => c.visitCount > 1).length

  return (
    <>
      {selected && <ClientHistoryPanel client={selected} onClose={() => setSelected(null)} />}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
          fontFamily: "'Inter',system-ui,sans-serif",
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#C58F3B',
                margin: '0 0 5px',
              }}
            >
              Guest Management
            </p>

            <h2
              style={{
                fontFamily: "'Cormorant Garamond',Georgia,serif",
                fontSize: 'clamp(1.8rem,3vw,2.4rem)',
                fontWeight: 300,
                color: '#1A1A1A',
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              Clients
            </h2>

            <p
              style={{
                color: 'rgba(26,26,26,0.40)',
                fontSize: 13,
                margin: '4px 0 0',
              }}
            >
              Cross-branch visibility — client history follows them regardless of which location
              they visit.
            </p>
          </div>

          <button
            onClick={loadClients}
            style={{
              padding: '0 16px',
              height: 40,
              border: '1px solid rgba(197,143,59,0.45)',
              borderRadius: 10,
              backgroundColor: 'transparent',
              color: '#C58F3B',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>

        {!loading && !error && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,minmax(min(160px,100%),1fr))',
              gap: 12,
            }}
          >
            {[
              { label: 'Total Clients', value: String(totalClients), sub: 'All branches combined' },
              { label: 'Returning', value: String(returningCount), sub: '2 or more visits' },
              {
                label: 'New Clients',
                value: String(totalClients - returningCount),
                sub: 'First-time visitors',
              },
              { label: 'Lifetime Value', value: fmt(totalSpendAll), sub: 'Across all visits' },
            ].map((t) => (
              <div
                key={t.label}
                style={{
                  backgroundColor: '#FFFFFF',
                  backgroundImage: 'none',
                  border: '1px solid rgba(26,26,26,0.09)',
                  borderRadius: 14,
                  padding: '16px 18px',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 14,
                    right: 14,
                    height: 2,
                    backgroundColor: '#C58F3B',
                    opacity: 0.4,
                    borderRadius: '0 0 2px 2px',
                  }}
                />

                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#7A6E65',
                    margin: '0 0 6px',
                  }}
                >
                  {t.label}
                </p>

                <p
                  style={{
                    fontSize: 26,
                    fontWeight: 700,
                    color: '#1A1A1A',
                    margin: '0 0 2px',
                    lineHeight: 1,
                  }}
                >
                  {t.value}
                </p>

                <p style={{ fontSize: 11, color: '#9A8E85', margin: 0 }}>{t.sub}</p>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(26,26,26,0.35)',
                pointerEvents: 'none',
              }}
            >
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M12 12l2.5 2.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, mobile, or email…"
              style={{
                width: '100%',
                height: 44,
                paddingLeft: 40,
                paddingRight: 16,
                border: '1px solid rgba(26,26,26,0.14)',
                borderRadius: 10,
                fontSize: 14,
                color: '#1A1A1A',
                backgroundColor: '#FFFFFF',
                fontFamily: "'Inter',system-ui,sans-serif",
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                padding: '0 14px',
                height: 44,
                borderRadius: 10,
                border: '1px solid rgba(26,26,26,0.14)',
                backgroundColor: 'transparent',
                color: 'rgba(26,26,26,0.50)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <ListSkeleton />
        ) : error ? (
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: 'rgba(139,58,58,0.09)',
              border: '1px solid rgba(139,58,58,0.28)',
              borderRadius: 12,
              color: '#8B3A3A',
              fontSize: 14,
            }}
          >
            {error}

            <button
              onClick={loadClients}
              style={{
                marginLeft: 12,
                padding: '4px 12px',
                borderRadius: 7,
                backgroundColor: 'rgba(139,58,58,0.14)',
                border: '1px solid rgba(139,58,58,0.28)',
                color: '#8B3A3A',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <p
              style={{
                fontFamily: "'Cormorant Garamond',Georgia,serif",
                fontSize: 22,
                fontWeight: 400,
                color: '#1A1A1A',
                margin: '0 0 8px',
              }}
            >
              {clients.length === 0 ? 'No clients yet' : 'No results found'}
            </p>

            <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.40)', margin: 0 }}>
              {clients.length === 0
                ? 'Clients will appear here once bookings are made.'
                : `No clients matching "${search}".`}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((c) => {
              const ac = avatarColor(c.name)

              return (
                <div
                  key={c.mobile}
                  onClick={() => setSelected(c)}
                  style={{
                    backgroundColor: '#FFFFFF',
                    backgroundImage: 'none',
                    border: '1px solid rgba(26,26,26,0.09)',
                    borderRadius: 14,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    cursor: 'pointer',
                    transition: 'all 200ms ease',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'rgba(197,143,59,0.30)'
                    el.style.boxShadow = '0 6px 22px rgba(0,0,0,0.08)'
                    el.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'rgba(26,26,26,0.09)'
                    el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)'
                    el.style.transform = ''
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      backgroundColor: ac,
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: "'Cormorant Garamond',Georgia,serif",
                      fontSize: 20,
                      fontWeight: 400,
                      flexShrink: 0,
                      boxShadow: `0 0 0 3px ${ac}28`,
                    }}
                  >
                    {initials(c.name)}
                  </div>

                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: '#1A1A1A',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.name}
                      </span>

                      {c.visitCount > 1 && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.10em',
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                            borderRadius: 99,
                            backgroundColor: 'rgba(197,143,59,0.12)',
                            color: '#C58F3B',
                            border: '1px solid rgba(197,143,59,0.30)',
                            flexShrink: 0,
                          }}
                        >
                          Returning
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'rgba(26,26,26,0.45)' }}>
                        {c.mobile}
                      </span>

                      {c.email && (
                        <span
                          style={{
                            fontSize: 12,
                            color: 'rgba(26,26,26,0.35)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 200,
                          }}
                        >
                          {c.email}
                        </span>
                      )}
                    </div>

                    <div style={{ marginTop: 5, fontSize: 12, color: 'rgba(26,26,26,0.40)' }}>
                      Fave:{' '}
                      <span style={{ color: 'rgba(26,26,26,0.60)', fontWeight: 500 }}>
                        {c.topService}
                      </span>

                      {c.topTherapist !== '—' && (
                        <>
                          {' '}
                          &middot;{' '}
                          <span style={{ color: 'rgba(26,26,26,0.60)', fontWeight: 500 }}>
                            {c.topTherapist}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>
                      {fmt(c.totalSpend)}
                    </div>

                    <div style={{ fontSize: 12, color: 'rgba(26,26,26,0.40)', marginTop: 2 }}>
                      {c.visitCount} visit{c.visitCount !== 1 ? 's' : ''}
                    </div>

                    {c.lastVisit && (
                      <div style={{ fontSize: 11, color: 'rgba(26,26,26,0.30)', marginTop: 2 }}>
                        {fmtDate(c.lastVisit)}
                      </div>
                    )}
                  </div>

                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    style={{ flexShrink: 0, color: 'rgba(26,26,26,0.25)' }}
                  >
                    <path
                      d="M6 3l5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )
            })}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <p
            style={{
              fontSize: 12,
              color: 'rgba(26,26,26,0.35)',
              textAlign: 'center',
              margin: 0,
            }}
          >
            Showing {filtered.length} of {clients.length} clients
          </p>
        )}
      </div>
    </>
  )
}