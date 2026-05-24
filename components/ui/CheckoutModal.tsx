'use client'

/**
 * CheckoutModal.tsx — Sabbath Spa POS / Checkout
 *
 * Workflow
 * ────────
 * 1. Receptionist taps "Check-out" on a Confirmed / In-Progress booking.
 * 2. Modal opens pre-filled with service, price, therapist, client.
 * 3. Choose payment method → optionally enter a discount.
 * 4. "Confirm Payment":
 *      · INSERT row in `payments` table
 *      · UPDATE `bookings` row status → 'completed'
 * 5. Draw-in ✓ animation → auto-closes and notifies parent.
 *
 * BRANCH CONFIG
 * ─────────────
 * MAIN_BRANCH_ID is hardcoded for single-branch launch.
 * Replace with the real UUID from your `branches` table before
 * going multi-branch.
 */

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────
// BRANCH — hardcoded for single-branch launch
// ─────────────────────────────────────────────────────────────
const MAIN_BRANCH_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
// TODO: replace ↑ with your real branch UUID from the branches table.

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
export interface CheckoutBooking {
  id: string
  service: string
  therapist: string
  client: string
  amount: number   // original price in PHP
  time: string
  status: string
}

interface CheckoutModalProps {
  booking: CheckoutBooking
  onClose: () => void
  /** Called after successful payment — parent updates local list */
  onSuccess: (bookingId: string) => void
}

const PAYMENT_METHODS = ['Cash', 'GCash', 'Maya', 'Card'] as const
type PaymentMethod = typeof PAYMENT_METHODS[number]

// ─────────────────────────────────────────────────────────────
// FORMAT HELPERS
// ─────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

// ─────────────────────────────────────────────────────────────
// PAYMENT METHOD ICONS
// ─────────────────────────────────────────────────────────────
function MethodIcon({ method }: { method: PaymentMethod }) {
  // width/height are valid SVG attributes and can be spread safely.
  // flexShrink is a CSS property — it must live inside style={}, never
  // as a direct prop, or React throws "does not recognize flexShrink".
  const s: React.SVGProps<SVGSVGElement> = {
    width: 18,
    height: 18,
    style: { flexShrink: 0 },
  }

  if (method === 'Cash') return (
    <svg {...s} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="1" y="4" width="16" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 9h.5M13.5 9H14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
  if (method === 'GCash') return (
    <svg {...s} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11 7.5H9.5a2 2 0 0 0 0 4H11V10H9.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  if (method === 'Maya') return (
    <svg {...s} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 12l2.5-6 1.5 4 1.5-4L13 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  // Card
  return (
    <svg {...s} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="1" y="4" width="16" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1 7.5h16" stroke="currentColor" strokeWidth="1.4" />
      <rect x="3" y="10" width="4" height="1.5" rx="0.5" fill="currentColor" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// SUCCESS ANIMATION
// ─────────────────────────────────────────────────────────────
function SuccessScreen({
  amount,
  method,
}: {
  amount: number
  method: PaymentMethod
}) {
  return (
    <>
      <style>{`
        @keyframes circleDraw {
          from { stroke-dashoffset: 232; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes checkDraw {
          from { stroke-dashoffset: 52; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes successFade {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .success-circle { animation: circleDraw 550ms cubic-bezier(0.4,0,0.2,1) 80ms  forwards; }
        .success-check  { animation: checkDraw  380ms cubic-bezier(0.4,0,0.2,1) 580ms forwards; }
        .success-text   { animation: successFade 400ms ease                      750ms both; }
      `}</style>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 32px',
        gap: 20,
      }}>
        {/* Animated checkmark circle */}
        <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true">
          {/* Track */}
          <circle cx="44" cy="44" r="37"
            fill="none" stroke="rgba(61,122,74,0.12)" strokeWidth="5"
          />
          {/* Animated circle — stroke-dasharray ≈ 2πr = 232 */}
          <circle cx="44" cy="44" r="37"
            fill="none"
            stroke="#3D7A4A"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="232"
            strokeDashoffset="232"
            transform="rotate(-90 44 44)"
            className="success-circle"
          />
          {/* Animated checkmark — path length ≈ 52 */}
          <path
            d="M28 44l12 12 22-22"
            fill="none"
            stroke="#3D7A4A"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="52"
            strokeDashoffset="52"
            className="success-check"
          />
        </svg>

        <div className="success-text" style={{ textAlign: 'center' }}>
          <p style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 28, fontWeight: 400, color: '#1A1A1A',
            margin: '0 0 8px', lineHeight: 1.1,
          }}>
            Payment Successful
          </p>
          <p style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 14, color: 'rgba(26,26,26,0.55)',
            margin: '0 0 16px',
          }}>
            {fmt(amount)} collected via {method}
          </p>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 16px',
            backgroundColor: 'rgba(61,122,74,0.10)',
            border: '1px solid rgba(61,122,74,0.25)',
            borderRadius: 99,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#3D7A4A',
            fontFamily: "'Inter', system-ui, sans-serif",
          }}>
            Booking marked Completed
          </div>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN MODAL
// ─────────────────────────────────────────────────────────────
export default function CheckoutModal({
  booking,
  onClose,
  onSuccess,
}: CheckoutModalProps) {
  const supabase = createClient()

  const [method, setMethod] = useState<PaymentMethod>('Cash')
  const [discount, setDiscount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const discountAmt = Math.max(0, Math.min(parseFloat(discount) || 0, booking.amount))
  const finalTotal = booking.amount - discountAmt

  // Close on Escape
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !loading && !success) onClose()
  }, [loading, success, onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  // Auto-close 2.2 s after success animation starts
  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => onSuccess(booking.id), 2200)
    return () => clearTimeout(t)
  }, [success, booking.id, onSuccess])

  // ── Supabase: insert payment + update booking ──────────────
  async function confirmPayment() {
    setLoading(true)
    setError(null)

    try {
      // 1. Record the payment
      const { error: payErr } = await supabase
        .from('payments')
        .insert({
          booking_id: booking.id,
          original_amount: booking.amount,
          discount_amount: discountAmt > 0 ? discountAmt : null,
          amount: finalTotal,
          payment_method: method.toLowerCase(),
          branch_id: MAIN_BRANCH_ID,
          status: 'paid',
          paid_at: new Date().toISOString(),
          service_name: booking.service,
          therapist_name: booking.therapist,
          client_name: booking.client,
        })

      if (payErr) throw payErr

      // 2. Mark the booking completed and stamp the payment columns
      //    (therapist_name and amount already exist on the row from
      //     when the booking was created — no need to rewrite them here)
      const { error: bkErr } = await supabase
        .from('bookings')
        .update({
          status: 'completed',
          payment_method: method.toLowerCase(),  // new column: cash | gcash | maya | card
          payment_status: 'paid',                // new column: paid | pending | refunded
          branch_id: MAIN_BRANCH_ID,
          completed_at: new Date().toISOString(),
        })
        .eq('id', booking.id)

      if (bkErr) throw bkErr

      setSuccess(true)

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        /* Payment method pill hover */
        .pm-pill { transition: all 180ms ease; }
        .pm-pill:hover:not(.pm-active) {
          border-color: rgba(197,143,59,0.50) !important;
          color: #1A1A1A !important;
          background-color: rgba(197,143,59,0.07) !important;
        }

        /* Confirm button gold underline */
        .btn-confirm {
          position: relative; overflow: hidden;
          transition: background-color 200ms ease, border-color 220ms ease, color 200ms ease;
        }
        .btn-confirm::after {
          content: ''; position: absolute; bottom: 0; left: 0;
          width: 0; height: 2.5px; background-color: rgba(255,255,255,0.40);
          transition: width 320ms cubic-bezier(0.22,1,0.36,1);
        }
        .btn-confirm:hover:not(:disabled)::after { width: 100%; }
        .btn-confirm:disabled { opacity: 0.45; cursor: not-allowed; }

        /* Cancel link hover */
        .btn-cancel { transition: color 180ms ease; }
        .btn-cancel:hover { color: #1A1A1A !important; }

        /* Discount input */
        .discount-input:focus {
          outline: none;
          border-color: #C58F3B !important;
          box-shadow: 0 0 0 3px rgba(197,143,59,0.16) !important;
        }

        /* Modal slide-up */
        @keyframes modalIn {
          from { opacity:0; transform:translateY(20px) scale(0.98); }
          to   { opacity:1; transform:translateY(0)    scale(1); }
        }
        .modal-card { animation: modalIn 300ms cubic-bezier(0.22,1,0.36,1) both; }
      `}</style>

      {/* ── Backdrop ─────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 16px',
          backgroundColor: 'rgba(10,8,6,0.52)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
        onClick={e => {
          if (e.target === e.currentTarget && !loading && !success) onClose()
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Checkout"
      >

        {/* ── Modal card ───────────────────────────────────── */}
        <div
          className="modal-card"
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 440,
            backgroundColor: '#F9F4EB',
            backgroundImage: 'none',
            borderRadius: 20,
            boxShadow: '0 28px 70px rgba(0,0,0,0.32), 0 8px 24px rgba(0,0,0,0.18)',
            overflow: 'hidden',
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          {/* Gold top bar */}
          <div style={{ height: 3, backgroundColor: '#C58F3B' }} />

          {/* ── SUCCESS STATE ─────────────────────────────── */}
          {success ? (
            <SuccessScreen amount={finalTotal} method={method} />
          ) : (

            /* ── CHECKOUT FORM ─────────────────────────────── */
            <>
              {/* Header */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '22px 24px 18px',
                borderBottom: '1px solid rgba(26,26,26,0.10)',
              }}>
                <div>
                  <p style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
                    textTransform: 'uppercase', color: '#C58F3B',
                    margin: '0 0 4px',
                  }}>
                    Check-out
                  </p>
                  <h2 style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: 22, fontWeight: 400, color: '#1A1A1A',
                    margin: 0, lineHeight: 1.15,
                  }}>
                    {booking.service}
                  </h2>
                  <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.50)', margin: '4px 0 0' }}>
                    {booking.therapist} · {booking.client} · {booking.time}
                  </p>
                </div>

                {/* Close button */}
                <button
                  onClick={onClose}
                  disabled={loading}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: '1px solid rgba(26,26,26,0.15)',
                    backgroundColor: 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0,
                    color: 'rgba(26,26,26,0.45)',
                    transition: 'background-color 150ms ease, color 150ms ease',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.backgroundColor = 'rgba(26,26,26,0.08)'
                    el.style.color = '#1A1A1A'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.backgroundColor = 'transparent'
                    el.style.color = 'rgba(26,26,26,0.45)'
                  }}
                  aria-label="Close"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* ── Payment method ───────────────────────── */}
                <div>
                  <p style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
                    textTransform: 'uppercase', color: 'rgba(26,26,26,0.42)',
                    margin: '0 0 10px',
                  }}>
                    Payment Method
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                    {PAYMENT_METHODS.map(pm => {
                      const isActive = method === pm
                      return (
                        <button
                          key={pm}
                          type="button"
                          onClick={() => setMethod(pm)}
                          className={`pm-pill${isActive ? ' pm-active' : ''}`}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '12px 6px',
                            borderRadius: 10,
                            border: `1.5px solid ${isActive ? '#C58F3B' : 'rgba(26,26,26,0.14)'}`,
                            backgroundColor: isActive ? '#1A1A1A' : '#FFFFFF',
                            color: isActive ? '#C58F3B' : 'rgba(26,26,26,0.45)',
                            cursor: 'pointer',
                            boxShadow: isActive ? '0 4px 14px rgba(0,0,0,0.18)' : 'none',
                          }}
                          aria-pressed={isActive}
                        >
                          <MethodIcon method={pm} />
                          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em' }}>
                            {pm}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* ── Discount ─────────────────────────────── */}
                <div>
                  <p style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
                    textTransform: 'uppercase', color: 'rgba(26,26,26,0.42)',
                    margin: '0 0 8px',
                  }}>
                    Discount (₱)
                  </p>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: 14, top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 15, color: 'rgba(26,26,26,0.40)',
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      pointerEvents: 'none',
                    }}>
                      ₱
                    </span>
                    <input
                      className="discount-input"
                      type="number"
                      min="0"
                      max={booking.amount}
                      step="50"
                      value={discount}
                      onChange={e => setDiscount(e.target.value)}
                      placeholder="0"
                      style={{
                        width: '100%',
                        height: 50,
                        paddingLeft: 32,
                        paddingRight: 16,
                        backgroundColor: '#FFFFFF',
                        border: '1px solid rgba(26,26,26,0.14)',
                        borderRadius: 10,
                        fontSize: 15,
                        color: '#1A1A1A',
                        fontFamily: "'Inter', system-ui, sans-serif",
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 180ms ease, box-shadow 180ms ease',
                      }}
                    />
                  </div>
                  {discountAmt > 0 && (
                    <p style={{ fontSize: 11, color: '#3D7A4A', margin: '5px 0 0', fontWeight: 500 }}>
                      Discount applied: {fmt(discountAmt)}
                    </p>
                  )}
                </div>

                {/* ── Divider ──────────────────────────────── */}
                <div style={{ height: 1, backgroundColor: 'rgba(26,26,26,0.09)' }} />

                {/* ── Total due ────────────────────────────── */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 0',
                }}>
                  <div>
                    <p style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
                      textTransform: 'uppercase', color: 'rgba(26,26,26,0.42)',
                      margin: '0 0 4px',
                    }}>
                      Total Due
                    </p>
                    <p style={{ fontSize: 12, color: 'rgba(26,26,26,0.38)', margin: 0 }}>
                      via {method}
                    </p>
                  </div>

                  {/* Large elegant price — Cormorant Garamond */}
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontSize: 'clamp(2.4rem,6vw,3rem)',
                      fontWeight: 300,
                      color: '#1A1A1A',
                      letterSpacing: '-0.02em',
                      lineHeight: 1,
                    }}>
                      {fmt(finalTotal)}
                    </span>
                    {discountAmt > 0 && (
                      <p style={{
                        fontSize: 12, color: 'rgba(26,26,26,0.35)',
                        textDecoration: 'line-through', margin: '2px 0 0',
                        textAlign: 'right',
                      }}>
                        {fmt(booking.amount)}
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Error banner ─────────────────────────── */}
                {error && (
                  <div style={{
                    padding: '10px 14px',
                    backgroundColor: 'rgba(139,58,58,0.10)',
                    border: '1px solid rgba(139,58,58,0.30)',
                    borderRadius: 8,
                    fontSize: 13,
                    color: '#8B3A3A',
                    lineHeight: 1.55,
                  }}>
                    {error}
                  </div>
                )}

                {/* ── Actions ──────────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {/* Confirm Payment — gold charcoal */}
                  <button
                    onClick={confirmPayment}
                    disabled={loading}
                    className="btn-confirm"
                    style={{
                      width: '100%',
                      height: 54,
                      backgroundColor: '#C58F3B',
                      backgroundImage: 'none',
                      color: '#1A1A1A',
                      border: '1px solid #A07530',
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      fontFamily: "'Inter', system-ui, sans-serif",
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    {loading ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 800ms linear infinite' }}>
                          <circle cx="8" cy="8" r="6" stroke="rgba(26,26,26,0.30)" strokeWidth="2" />
                          <path d="M8 2a6 6 0 0 1 6 6" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                        Processing…
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Confirm Payment — {fmt(finalTotal)}
                      </>
                    )}
                  </button>

                  {/* Cancel */}
                  <button
                    onClick={onClose}
                    disabled={loading}
                    className="btn-cancel"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 500,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'rgba(26,26,26,0.35)',
                      fontFamily: "'Inter', system-ui, sans-serif",
                      padding: '8px 0',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}