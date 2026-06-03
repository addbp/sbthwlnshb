'use client'

// app/page.tsx
// Sabbath Wellness — Luxury Vertical Kiosk
// Light spa background (#F9F4EB) · /sabbath-logo.png · Dark charcoal text

import Image from 'next/image'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────
// NAV ITEMS
// ─────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    key: 'staff',
    href: '/login',
    title: 'Staff Portal',
    desc: 'Management dashboard · Schedules · Client records',
    icon: <IconDashboard />,
  },
  {
    key: 'booking',
    href: '/booking',
    title: 'Book a Session',
    desc: 'Reserve your appointment · Choose service & therapist',
    icon: <IconCalendar />,
  },
  {
    key: 'waiver',
    href: '/waiver',
    title: 'Digital Waiver',
    desc: 'Health intake form · Liability waiver',
    icon: <IconFileText />,
  },
  {
    key: 'membership',
    href: '/membership',
    title: 'Membership',
    desc: 'Exclusive discounts · VIP packages · Priority booking',
    icon: <IconCrown />,
  },
] as const

// ─────────────────────────────────────────────────────────────
// ICONS — gold fill/stroke on light background
// ─────────────────────────────────────────────────────────────
function IconDashboard() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" rx="2" stroke="#C58F3B" strokeWidth="1.6" />
      <rect x="14" y="1" width="9" height="9" rx="2" stroke="#C58F3B" strokeWidth="1.6" />
      <rect x="14" y="14" width="9" height="9" rx="2" stroke="#C58F3B" strokeWidth="1.6" />
      <rect x="1" y="14" width="9" height="9" rx="2" stroke="#C58F3B" strokeWidth="1.6" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <rect x="1" y="4" width="24" height="21" rx="2.5" stroke="#C58F3B" strokeWidth="1.6" />
      <path d="M1 11h24" stroke="#C58F3B" strokeWidth="1.3" />
      <path d="M7 1v5M19 1v5" stroke="#C58F3B" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7 18l3.5 3.5 8-8" stroke="#C58F3B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconFileText() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <path d="M5 2h10l8 8v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="#C58F3B" strokeWidth="1.6" />
      <path d="M15 2v8h8" stroke="#C58F3B" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 15h12M7 19h9" stroke="#C58F3B" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function IconCrown() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <path d="M3 20L5 8L10 14L13 4L16 14L21 8L23 20H3Z" stroke="#C58F3B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default function Home() {
  const year = new Date().getFullYear()

  return (
    <>
      <style>{`
        /* Light spa background — hard guarantee */
        html, body, #__next {
          background-color: #F9F4EB !important;
          background-image: none !important;
        }

        /* ── Entrance animations ── */
        @keyframes slideDown {
          from { opacity:0; transform:translateY(-14px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes slideUp {
          from { opacity:0; transform:translateY(14px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes dissolve {
          from { opacity:0; }
          to   { opacity:1; }
        }

        .anim-logo    { animation: slideDown 680ms cubic-bezier(0.22,1,0.36,1) 60ms  both; }
        .anim-tagline { animation: dissolve  700ms ease                        240ms both; }
        .anim-divider { animation: dissolve  600ms ease                        340ms both; }
        .anim-nav-0   { animation: slideUp   560ms cubic-bezier(0.22,1,0.36,1) 400ms both; }
        .anim-nav-1   { animation: slideUp   560ms cubic-bezier(0.22,1,0.36,1) 480ms both; }
        .anim-nav-2   { animation: slideUp   560ms cubic-bezier(0.22,1,0.36,1) 560ms both; }
        .anim-nav-3   { animation: slideUp   560ms cubic-bezier(0.22,1,0.36,1) 640ms both; }
        .anim-footer  { animation: dissolve  800ms ease                        740ms both; }

        /* ── Nav link — dark text on light background ── */
        .nav-link {
          display:         flex;
          align-items:     center;
          gap:             18px;
          width:           100%;
          padding:         20px 0;
          text-decoration: none;
          position:        relative;
          cursor:          pointer;
          /* Subtle rule on light bg */
          border-bottom:   1px solid rgba(26,26,26,0.10);
          transition:      border-color 260ms ease;
        }
        .nav-link:last-child { border-bottom: none; }
        .nav-link:hover      { border-bottom-color: rgba(26,26,26,0.20); }

        /* Gold underline slides in from left — same motion as before */
        .nav-link::after {
          content:          '';
          position:         absolute;
          bottom:           -1px; left: 0;
          width:            0; height: 2px;
          background-color: #C58F3B;
          transition:       width 340ms cubic-bezier(0.22,1,0.36,1);
        }
        .nav-link:hover::after { width: 100%; }

        /* Icon scale */
        .nav-icon  { flex-shrink:0; transition: transform 280ms cubic-bezier(0.22,1,0.36,1); }
        .nav-link:hover .nav-icon { transform: scale(1.12); }

        /* Title: charcoal on light bg */
        .nav-title {
          color: rgba(26,26,26,0.62);
          transition: color 200ms ease;
        }
        .nav-link:hover .nav-title { color: #1A1A1A; }

        /* Sub-label: muted charcoal */
        .nav-desc {
          color: rgba(26,26,26,0.36);
          transition: color 200ms ease;
        }
        .nav-link:hover .nav-desc { color: rgba(197,143,59,0.80); }

        /* Arrow fade-in */
        .nav-arrow {
          opacity:0; transform:translateX(-8px);
          transition: opacity 230ms ease, transform 270ms cubic-bezier(0.22,1,0.36,1);
        }
        .nav-link:hover .nav-arrow { opacity:1; transform:translateX(0); }

        .nav-link:focus-visible {
          outline:        2px solid #C58F3B;
          outline-offset: 4px;
          border-radius:  4px;
        }
      `}</style>

      <main style={{
        backgroundColor: '#F9F4EB',   /* Light spa beige */
        backgroundImage: 'none',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(48px,9vh,96px) 24px clamp(24px,4vh,48px)',
        fontFamily: "'Inter', system-ui, sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}>

        {/* max-w-2xl centered column */}
        <div style={{
          width: '100%', maxWidth: 672,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', flex: 1,
        }}>

          {/* ══ LOGO — /sabbath-logo.png, priority load ══ */}
          <div className="anim-logo" style={{ marginBottom: 28 }}>
            <Image
              src="/sabbath-logo.png"
              alt="Sabbath Spa & Wellness Hub"
              width={240}
              height={240}
              priority={true}
              style={{
                objectFit: 'contain',
                width: 'clamp(160px, 32vw, 240px)',
                height: 'clamp(160px, 32vw, 240px)',
                display: 'block',
              }}
            />
          </div>

          {/* ══ TAGLINE — gold italic, only text element ══ */}
          <p
            className="anim-tagline"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 'clamp(1rem, 2.6vw, 1.35rem)',
              fontStyle: 'italic',
              fontWeight: 400,
              letterSpacing: '0.07em',
              color: '#C58F3B',
              margin: '0 0 34px',
              textAlign: 'center',
              lineHeight: 1,
            }}
          >
            Embrace the Gift of Rest
          </p>

          {/* ══ ORNAMENTAL DIVIDER ══ */}
          <div
            className="anim-divider"
            aria-hidden="true"
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              width: '100%', marginBottom: 34,
            }}
          >
            {/* Rules are charcoal-tinted on light bg */}
            <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(26,26,26,0.12)' }} />
            <svg width="7" height="7" viewBox="0 0 7 7" fill="#C58F3B" opacity="0.70">
              <polygon points="3.5,0 7,3.5 3.5,7 0,3.5" />
            </svg>
            <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(26,26,26,0.12)' }} />
          </div>

          {/* ══ NAVIGATION LINKS ══ */}
          <nav aria-label="Main navigation" style={{ width: '100%', marginBottom: 48 }}>
            {NAV_ITEMS.map((item, i) => (
              <Link
                key={item.key}
                href={item.href}
                className={`nav-link anim-nav-${i}`}
                aria-label={`${item.title}: ${item.desc}`}
              >
                <span className="nav-icon">{item.icon}</span>

                <span style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  gap: 5, paddingTop: 8, paddingBottom: 8,
                }}>
                  <span className="nav-title" style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: 'clamp(1.55rem, 3.5vw, 2rem)',
                    fontWeight: 400,
                    letterSpacing: '0.02em',
                    lineHeight: 1.1,
                  }}>
                    {item.title}
                  </span>
                  <span className="nav-desc" style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: 'clamp(0.70rem, 1.4vw, 0.78rem)',
                    fontWeight: 400,
                    letterSpacing: '0.09em',
                    textTransform: 'uppercase',
                    lineHeight: 1,
                  }}>
                    {item.desc}
                  </span>
                </span>

                <span className="nav-arrow" aria-hidden="true"
                  style={{ color: '#C58F3B', fontSize: '1.05rem', flexShrink: 0, paddingLeft: 8 }}
                >
                  →
                </span>
              </Link>
            ))}
          </nav>
        </div>

        {/* ══ FOOTER ══ */}
        <footer
          className="anim-footer"
          style={{
            width: '100%', maxWidth: 672, textAlign: 'center',
            paddingTop: 18, borderTop: '1px solid rgba(26,26,26,0.09)',
          }}
        >
          <p style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 11, fontWeight: 400,
            letterSpacing: '0.13em', textTransform: 'uppercase',
            color: 'rgba(26,26,26,0.32)',
            margin: 0,
          }}>
            © {year} Sabbath Spa & Wellness Hub · All rights reserved
          </p>
        </footer>
      </main>
    </>
  )
}