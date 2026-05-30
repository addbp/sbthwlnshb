'use client'

// app/dashboard/layout.tsx
// Dashboard Shell — Black sidebar (#1A1A1A) · Beige content area (#F9F4EB)
// Tablet-first · Gold icons · Supabase sign-out

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────
// NAV CONFIG
// ─────────────────────────────────────────────────────────────
const NAV_MAIN = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="1" y="1" width="7" height="7" rx="1.5" stroke="#C58F3B" strokeWidth="1.5" />
        <rect x="12" y="1" width="7" height="7" rx="1.5" stroke="#C58F3B" strokeWidth="1.5" />
        <rect x="12" y="12" width="7" height="7" rx="1.5" stroke="#C58F3B" strokeWidth="1.5" />
        <rect x="1" y="12" width="7" height="7" rx="1.5" stroke="#C58F3B" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    href: '/dashboard/bookings',
    label: 'Bookings',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="3" width="16" height="15" rx="2" stroke="#C58F3B" strokeWidth="1.5" />
        <path d="M2 8h16" stroke="#C58F3B" strokeWidth="1.3" />
        <path d="M6 1v4M14 1v4" stroke="#C58F3B" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M6 12l2.5 2.5 5-5" stroke="#C58F3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/clients',
    label: 'Clients',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="8" cy="6" r="3.5" stroke="#C58F3B" strokeWidth="1.5" />
        <path d="M2 18v-1a6 6 0 0 1 12 0v1" stroke="#C58F3B" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M15 8a3 3 0 0 1 0 6M17 18v-1a6 6 0 0 0-2-4.47" stroke="#C58F3B" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/staff',
    label: 'Staff',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="6" r="3.5" stroke="#C58F3B" strokeWidth="1.5" />
        <path d="M3 18v-1a7 7 0 0 1 14 0v1" stroke="#C58F3B" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/payments',
    label: 'Payments',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="1" y="4" width="18" height="13" rx="2" stroke="#C58F3B" strokeWidth="1.5" />
        <path d="M1 9h18" stroke="#C58F3B" strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    href: '/dashboard/reports',
    label: 'Waivers', // <--- CHANGED FROM REPORTS
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M11 2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-4-5z" stroke="#C58F3B" strokeWidth="1.5" />
        <path d="M11 2v5h4" stroke="#C58F3B" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M7 11h6M7 14h4" stroke="#C58F3B" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
]

const NAV_BOTTOM = [
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="2.5" stroke="#C58F3B" strokeWidth="1.5" />
        <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="#C58F3B" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
]

// ─────────────────────────────────────────────────────────────
// LAYOUT
// ─────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
    })
  }, [])

  // Close mobile nav on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  // Initial for avatar
  const initial = userEmail?.[0]?.toUpperCase() ?? 'S'

  return (
    <>
      <style>{`
        /* FORCED BACKGROUND COLOR FOR ALL PAGES */
        html, body, #__next { background-color: #F9F4EB !important; }

        /* Sidebar nav item */
        .sb-item {
          display:      flex;
          align-items:  center;
          gap:          12px;
          padding:      0 14px;
          min-height:   50px;
          border-radius:10px;
          text-decoration: none;
          color:        rgba(243,233,224,0.52);
          font-size:    14px;
          font-weight:  400;
          transition:   background-color 180ms ease, color 180ms ease;
          position:     relative;
        }
        .sb-item:hover { background-color:rgba(197,143,59,0.10); color:#F3E9E0; }
        .sb-item.active { background-color:rgba(197,143,59,0.14); color:#F3E9E0; }
        .sb-item.active::after {
          content:'';
          position:absolute;
          right:0; top:50%; transform:translateY(-50%);
          width:3px; height:20px; border-radius:99px;
          background-color:#C58F3B;
        }

        /* Sign out button */
        .sb-signout {
          display:      flex;
          align-items:  center;
          gap:          10px;
          width:        100%;
          padding:      0 14px;
          min-height:   44px;
          border:       none;
          background:   transparent;
          color:        rgba(243,233,224,0.38);
          font-size:    13px;
          font-family:  'Inter', system-ui, sans-serif;
          cursor:       pointer;
          border-radius:10px;
          transition:   background-color 180ms ease, color 180ms ease;
          text-align:   left;
        }
        .sb-signout:hover { background-color:rgba(160,80,80,0.12); color:#d07070; }

        /* Mobile overlay */
        .mob-overlay {
          position:fixed; inset:0; background:rgba(0,0,0,0.65);
          backdrop-filter:blur(3px); z-index:38;
        }

        @media (min-width:768px) {
          .mob-menu-btn { display:none !important; }
          .sidebar      { transform:translateX(0) !important; }
        }
        @media (max-width:767px) {
          .dashboard-main { margin-left:0 !important; }
          .dashboard-header { padding-left:16px !important; }
        }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F9F4EB' }}>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="mob-overlay" onClick={() => setMobileOpen(false)} />
        )}

        {/* ── SIDEBAR ────────────────────────────────────── */}
        <aside
          className="sidebar"
          style={{
            position: 'fixed',
            top: 0, left: 0, bottom: 0,
            width: 276,
            backgroundColor: '#1A1A1A',
            backgroundImage: 'none',
            borderRight: '1px solid rgba(197,143,59,0.14)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 40,
            overflowY: 'auto',
            transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 300ms cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          {/* Brand — logo only */}
          <div style={{ padding: '20px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/sabbath-logo.png" alt="Sabbath Logo" style={{ width: 72, height: 72, objectFit: 'contain' }} />
          </div>

          <div style={{ height: 1, margin: '0 20px', backgroundColor: 'rgba(197,143,59,0.18)' }} />

          <div style={{ padding: '14px 20px 6px', fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(197,143,59,0.55)' }}>
            Navigation
          </div>

          <nav style={{ padding: '4px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV_MAIN.map(item => (
              <Link key={item.href} href={item.href} className={`sb-item${isActive(item.href) ? ' active' : ''}`}>
                <span style={{ flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          <div style={{ flex: 1 }} />

          <div style={{ height: 1, margin: '0 20px', backgroundColor: 'rgba(197,143,59,0.18)' }} />

          <nav style={{ padding: '8px 10px 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV_BOTTOM.map(item => (
              <Link key={item.href} href={item.href} className={`sb-item${isActive(item.href) ? ' active' : ''}`}>
                <span style={{ flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
            <button onClick={signOut} className="sb-signout">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M13 3h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M9 14l4-4-4-4M13 10H3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sign out
            </button>
          </nav>

          {/* User pill */}
          <div style={{ margin: '10px 14px 16px', padding: '12px 14px', backgroundColor: 'rgba(197,143,59,0.08)', border: '1px solid rgba(197,143,59,0.16)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: '#C58F3B', color: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 16, fontWeight: 600, flexShrink: 0 }}>
              {initial}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#F3E9E0', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userEmail ?? 'Staff'}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(197,143,59,0.65)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Logged in
              </div>
            </div>
          </div>
        </aside>

        {/* ── MAIN AREA ───────────────────────────────────── */}
        <div
          className="dashboard-main"
          style={{
            marginLeft: 276,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            backgroundColor: '#F9F4EB',  // Sabbath Beige
            backgroundImage: 'none',
          }}
        >
          {/* Header */}
          <header style={{
            position: 'sticky', top: 0, zIndex: 30,
            height: 68,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 32px',
            backgroundColor: 'rgba(249,244,235,0.92)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid rgba(197,143,59,0.14)',
          }}>
            {/* Mobile menu toggle */}
            <button
              className="mob-menu-btn"
              onClick={() => setMobileOpen(v => !v)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, border: '1px solid rgba(197,143,59,0.28)', borderRadius: 8, backgroundColor: 'transparent', color: '#1A1A1A', cursor: 'pointer', flexShrink: 0 }}
              aria-label="Toggle navigation"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>

            {/* Page title */}
            <h1 style={{ flex: 1, fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(1.3rem,2.5vw,1.8rem)', fontWeight: 400, color: '#1A1A1A', margin: 0, letterSpacing: '0.01em' }}>
              {NAV_MAIN.find(i => isActive(i.href))?.label ?? 'Dashboard'}
            </h1>
          </header>

          {/* Page content */}
          <main style={{ flex: 1, padding: '32px', maxWidth: 1400, width: '100%' }}>
            {children}
          </main>
        </div>
      </div>
    </>
  )
}