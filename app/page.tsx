'use client'

// app/page.tsx
// Sabbath Wellness — Luxury 2x2 Grid Kiosk
// Light spa background (#F9F4EB) · /sabbath-logo.png · Dark charcoal text

import Image from 'next/image'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────
// NAV ITEMS
// ─────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    key: 'booking',
    href: '/booking',
    title: 'Book a Session',
    desc: 'Reserve your appointment · Choose service & therapist',
    icon: <IconCalendar />,
    external: false,
  },
  {
    key: 'waiver',
    href: '/waiver',
    title: 'Digital Waiver',
    desc: 'Health intake form · Liability waiver',
    icon: <IconFileText />,
    external: false,
  },
  {
    key: 'membership',
    href: '/membership',
    title: 'Membership',
    desc: 'Exclusive discounts · VIP packages · Priority booking',
    icon: <IconCrown />,
    external: false,
  },
  {
    key: 'sabasu',
    href: 'https://sabasupos.sabbathspa.com/', // DIRECT EXTERNAL LINK
    title: 'Sabasu',
    desc: 'Order coffee, pasta & pastries to your room',
    icon: <IconCafe />,
    external: true,
  },
] as const

// ─────────────────────────────────────────────────────────────
// ICONS — gold fill/stroke on light background
// ─────────────────────────────────────────────────────────────
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

function IconCafe() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <path d="M18 8H4v7a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6V8z" stroke="#C58F3B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 10h2a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3h-2" stroke="#C58F3B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 3v2M10 2v3M14 3v2" stroke="#C58F3B" strokeWidth="1.6" strokeLinecap="round" />
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
        .anim-nav-0   { animation: slideUp   560ms cubic-bezier(0.22,1,0.36,1) 400ms both; }
        .anim-nav-1   { animation: slideUp   560ms cubic-bezier(0.22,1,0.36,1) 480ms both; }
        .anim-nav-2   { animation: slideUp   560ms cubic-bezier(0.22,1,0.36,1) 560ms both; }
        .anim-nav-3   { animation: slideUp   560ms cubic-bezier(0.22,1,0.36,1) 640ms both; }
        .anim-footer  { animation: dissolve  800ms ease                        820ms both; }

        /* ── Modern 2x2 Grid Layout ── */
        .nav-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          width: 100%;
          margin-bottom: 48px;
        }

        @media (min-width: 768px) {
          .nav-grid {
            grid-template-columns: 1fr 1fr;
            gap: 24px;
          }
        }

        /* ── Nav Card Design ── */
        .nav-card {
          display: flex;
          align-items: flex-start;
          gap: 20px;
          padding: 28px;
          background-color: rgba(255, 255, 255, 0.5);
          border: 1px solid rgba(26,26,26,0.08);
          border-radius: 16px;
          text-decoration: none;
          cursor: pointer;
          transition: all 300ms cubic-bezier(0.22,1,0.36,1);
        }
        
        .nav-card:hover {
          background-color: #FFFFFF;
          border-color: rgba(197,143,59,0.35);
          box-shadow: 0 12px 40px rgba(197,143,59,0.08);
          transform: translateY(-2px);
        }

        .nav-icon  { 
          flex-shrink: 0; 
          margin-top: 4px;
          transition: transform 300ms cubic-bezier(0.22,1,0.36,1); 
        }
        
        .nav-card:hover .nav-icon { 
          transform: scale(1.1); 
        }

        .nav-title {
          color: #1A1A1A;
          transition: color 200ms ease;
        }
        
        .nav-card:hover .nav-title { 
          color: #C58F3B; 
        }

        .nav-desc {
          color: rgba(26,26,26,0.45);
          transition: color 200ms ease;
        }
        
        .nav-card:hover .nav-desc { 
          color: rgba(26,26,26,0.65); 
        }

        .nav-card:focus-visible {
          outline: 2px solid #C58F3B;
          outline-offset: 4px;
        }
      `}</style>

      <main style={{
        backgroundColor: '#F9F4EB',
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

        {/* max-w-4xl centered container to accommodate grid */}
        <div style={{
          width: '100%', maxWidth: 880,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', flex: 1,
        }}>

          {/* ══ LOGO ══ */}
          <div className="anim-logo" style={{ marginBottom: 16 }}>
            <Image
              src="/sabbath-logo.png"
              alt="Sabbath Spa & Wellness Hub"
              width={240}
              height={240}
              priority={true}
              style={{
                objectFit: 'contain',
                width: 'clamp(140px, 28vw, 200px)',
                height: 'clamp(140px, 28vw, 200px)',
                display: 'block',
              }}
            />
          </div>

          {/* ══ TAGLINE ONLY ══ */}
          <p className="anim-tagline" style={{
            fontSize: 'clamp(0.65rem, 1.2vw, 0.75rem)',
            fontWeight: 700,
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            color: '#C58F3B',
            margin: '0 0 48px',
            textAlign: 'center',
          }}>
            Digital Operations Portal
          </p>

          {/* ══ NAVIGATION GRID ══ */}
          <nav className="nav-grid" aria-label="Main navigation">
            {NAV_ITEMS.map((item, i) => {
              const cardClass = `nav-card anim-nav-${i}`

              const CardContent = () => (
                <>
                  <span className="nav-icon">{item.icon}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className="nav-title" style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontSize: 'clamp(1.5rem, 2.5vw, 1.85rem)',
                      fontWeight: 400,
                      lineHeight: 1.1,
                    }}>
                      {item.title}
                    </span>
                    <span className="nav-desc" style={{
                      fontFamily: "'Inter', system-ui, sans-serif",
                      fontSize: 'clamp(0.55rem, 1vw, 0.65rem)',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      lineHeight: 1.4,
                    }}>
                      {item.desc}
                    </span>
                  </span>
                </>
              )

              if (item.external) {
                return (
                  <a
                    key={item.key}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cardClass}
                    aria-label={`Open ${item.title} in new tab`}
                  >
                    <CardContent />
                  </a>
                )
              }

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cardClass}
                  aria-label={`${item.title}: ${item.desc}`}
                >
                  <CardContent />
                </Link>
              )
            })}
          </nav>

          {/* ══ FOOTER ══ */}
          <footer
            className="anim-footer"
            style={{
              width: '100%', textAlign: 'center',
              paddingTop: 24, borderTop: '1px solid rgba(26,26,26,0.08)',
            }}
          >
            <p style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 10, fontWeight: 700,
              letterSpacing: '0.15em', textTransform: 'uppercase',
              color: 'rgba(26,26,26,0.3)',
              margin: 0,
            }}>
              © {year} Sabbath Spa & Wellness Hub · All rights reserved
            </p>
          </footer>
        </div>
      </main>
    </>
  )
}