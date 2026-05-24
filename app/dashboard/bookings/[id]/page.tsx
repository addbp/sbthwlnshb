import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CalendarDays,
  User,
  Scissors,
  Clock,
  CreditCard,
  FileText,
  Pencil,
} from 'lucide-react'
import type { Metadata } from 'next'
import BookingStatusBadge from '@/components/bookings/BookingStatusBadge'
import BookingStatusActions from '@/components/bookings/BookingStatusActions'
import type { BookingStatus } from '@/lib/actions/booking-status'

export const metadata: Metadata = { title: 'Booking Detail' }

const PAYMENT_STATUS_CLASSES: Record<string, string> = {
  paid: 'bg-green-100 text-green-800 border border-green-200',
  partial: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  unpaid: 'bg-red-100 text-red-800 border border-red-200',
  refunded: 'bg-stone-100 text-stone-600 border border-stone-200',
}

/** booking_date = Postgres date string "2025-06-15" */
function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** booking_time = Postgres time string "09:30:00" */
function formatTime(timeStr: string | null) {
  if (!timeStr) return '—'
  const [h, m] = timeStr.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

const PIPELINE_STEPS: BookingStatus[] = [
  'pending',
  'confirmed',
  'checked_in',
  'in_progress',
  'completed',
]

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // ── Step 1: Fetch booking — only confirmed schema columns ──────────────
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(
      'id, client_id, service_id, therapist_id, booking_date, booking_time, duration_minutes, booking_source, booking_status, payment_status, notes, created_at, updated_at'
    )
    .eq('id', id)
    .single()

  if (bookingError || !booking) {
    console.error('[BookingDetail] fetch error:', {
      code: bookingError?.code ?? null,
      message: bookingError?.message ?? String(bookingError),
      details: bookingError?.details ?? null,
      hint: bookingError?.hint ?? null,
      fullError: JSON.stringify(bookingError, null, 2),
    })
    notFound()
  }

  // ── Step 2: Fetch related records separately ───────────────────────────
  const [clientRes, serviceRes, therapistRes] = await Promise.all([
    booking.client_id
      ? supabase
        .from('clients')
        .select('id, full_name, mobile_number, email, client_type')
        .eq('id', booking.client_id)
        .single()
      : Promise.resolve({ data: null, error: null }),

    booking.service_id
      ? supabase
        .from('services')
        .select('id, service_name, duration_minutes, price')
        .eq('id', booking.service_id)
        .single()
      : Promise.resolve({ data: null, error: null }),

    booking.therapist_id
      ? supabase
        .from('staff')
        .select('id, full_name')
        .eq('id', booking.therapist_id)
        .single()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (clientRes.error) {
    console.error('[BookingDetail] client fetch error:', {
      code: clientRes.error.code,
      message: clientRes.error.message,
      details: clientRes.error.details,
      hint: clientRes.error.hint,
    })
  }
  if (serviceRes.error) {
    console.error('[BookingDetail] service fetch error:', {
      code: serviceRes.error.code,
      message: serviceRes.error.message,
      details: serviceRes.error.details,
      hint: serviceRes.error.hint,
    })
  }
  if (therapistRes.error) {
    console.error('[BookingDetail] therapist fetch error:', {
      code: therapistRes.error.code,
      message: therapistRes.error.message,
      details: therapistRes.error.details,
      hint: therapistRes.error.hint,
    })
  }

  // ── Step 3: Merge ──────────────────────────────────────────────────────
  const client = clientRes.data
  const service = serviceRes.data
  const therapist = therapistRes.data

  const currentStatus = booking.booking_status as BookingStatus
  const isTerminal = ['cancelled', 'no_show', 'completed'].includes(currentStatus)
  const currentPipelineIdx = PIPELINE_STEPS.indexOf(currentStatus)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back nav */}
      <Link
        href="/dashboard/bookings"
        className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800 transition-colors font-ui"
      >
        <ArrowLeft size={15} />
        Back to Bookings
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="brand-heading text-3xl">
            {client?.full_name ?? 'Booking'}
          </h1>
          <p className="text-sm text-stone-500 font-ui">
            #{booking.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <BookingStatusBadge status={currentStatus} size="md" />
          <Link
            href={`/dashboard/bookings/${id}/edit`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 text-sm text-stone-600 hover:bg-stone-50 transition-colors font-ui"
          >
            <Pencil size={14} />
            Edit
          </Link>
        </div>
      </div>

      {/* Status Workflow Card */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brandAccent/10 flex items-center justify-center">
            <CalendarDays size={16} className="text-brandAccent" />
          </div>
          <h2 className="font-semibold text-stone-800 font-ui">Status Workflow</h2>
        </div>

        {/* Pipeline steps */}
        <div className="flex items-center gap-1 flex-wrap">
          {PIPELINE_STEPS.map((step, i) => {
            const isDone =
              currentPipelineIdx > i &&
              !['cancelled', 'no_show'].includes(currentStatus)
            const isCurrent = step === currentStatus

            return (
              <div key={step} className="flex items-center gap-1">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${isCurrent && !['cancelled', 'no_show'].includes(currentStatus)
                      ? 'bg-brandAccent text-white'
                      : isDone
                        ? 'bg-green-100 text-green-700'
                        : 'bg-stone-100 text-stone-400'
                    }`}
                >
                  {step.replace(/_/g, ' ')}
                </span>
                {i < PIPELINE_STEPS.length - 1 && (
                  <span className="text-stone-300 text-xs">→</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Terminal outcome badge */}
        {['cancelled', 'no_show'].includes(currentStatus) && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400 font-ui">Outcome:</span>
            <BookingStatusBadge status={currentStatus} />
          </div>
        )}

        {/* Action buttons */}
        <BookingStatusActions
          bookingId={booking.id}
          currentStatus={currentStatus}
          layout="full"
        />

        {isTerminal && (
          <p className="text-xs text-stone-400 font-ui">
            This booking is finalized. No further status changes are available.
          </p>
        )}
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Client */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center">
              <User size={15} className="text-stone-500" />
            </div>
            <h3 className="font-semibold text-stone-800 font-ui">Client</h3>
          </div>
          {client ? (
            <div className="space-y-1.5 font-ui text-sm">
              <Link
                href={`/dashboard/clients/${client.id}`}
                className="font-medium text-brandAccent hover:underline"
              >
                {client.full_name}
              </Link>
              {client.mobile_number && (
                <p className="text-stone-500">{client.mobile_number}</p>
              )}
              {client.email && (
                <p className="text-stone-500">{client.email}</p>
              )}
              {client.client_type && (
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600 capitalize">
                  {client.client_type.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-stone-300 font-ui italic">
              Client not found
            </p>
          )}
        </div>

        {/* Service */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center">
              <Scissors size={15} className="text-stone-500" />
            </div>
            <h3 className="font-semibold text-stone-800 font-ui">Service</h3>
          </div>
          {service ? (
            <div className="space-y-1.5 font-ui text-sm">
              <p className="font-medium text-stone-800">{service.service_name}</p>
              {(service.duration_minutes ?? booking.duration_minutes) != null && (
                <p className="text-stone-500 flex items-center gap-1">
                  <Clock size={13} />
                  {service.duration_minutes ?? booking.duration_minutes} minutes
                </p>
              )}
              {service.price != null && (
                <p className="text-stone-600">
                  ₱
                  {Number(service.price).toLocaleString('en-PH', {
                    minimumFractionDigits: 2,
                  })}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-stone-300 font-ui italic">
              Service not found
            </p>
          )}
        </div>

        {/* Appointment */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center">
              <CalendarDays size={15} className="text-stone-500" />
            </div>
            <h3 className="font-semibold text-stone-800 font-ui">Appointment</h3>
          </div>
          <div className="space-y-2 text-sm font-ui">
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wide mb-0.5">
                Date
              </p>
              <p className="text-stone-700">{formatDate(booking.booking_date)}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wide mb-0.5">
                Time
              </p>
              <p className="text-stone-700">{formatTime(booking.booking_time)}</p>
            </div>
            {therapist ? (
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wide mb-0.5">
                  Therapist
                </p>
                <p className="text-stone-700">{therapist.full_name}</p>
              </div>
            ) : (
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wide mb-0.5">
                  Therapist
                </p>
                <p className="text-stone-300 italic">Not assigned</p>
              </div>
            )}
            {booking.booking_source && (
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wide mb-0.5">
                  Source
                </p>
                <p className="text-stone-700 capitalize">
                  {booking.booking_source.replace(/_/g, ' ')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Payment */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center">
              <CreditCard size={15} className="text-stone-500" />
            </div>
            <h3 className="font-semibold text-stone-800 font-ui">Payment</h3>
          </div>
          <div className="space-y-2 text-sm font-ui">
            <div className="flex items-center justify-between">
              <span className="text-stone-400">Status</span>
              {booking.payment_status ? (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_STATUS_CLASSES[booking.payment_status] ??
                    'bg-stone-100 text-stone-600'
                    }`}
                >
                  {booking.payment_status}
                </span>
              ) : (
                <span className="text-stone-400">—</span>
              )}
            </div>
            {booking.payment_status !== 'paid' && (
              <Link
                href={`/dashboard/payments/new?booking_id=${booking.id}${client ? `&client_id=${client.id}` : ''
                  }`}
                className="inline-flex items-center gap-1 text-xs text-brandAccent hover:underline pt-1"
              >
                <CreditCard size={12} />
                Record Payment →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      {booking.notes && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center">
              <FileText size={15} className="text-stone-500" />
            </div>
            <h3 className="font-semibold text-stone-800 font-ui">Notes</h3>
          </div>
          <p className="text-sm text-stone-600 font-ui leading-relaxed">
            {booking.notes}
          </p>
        </div>
      )}

      {/* Metadata */}
      <div className="text-xs text-stone-400 font-ui space-y-0.5 pb-4">
        <p>Created: {formatDateTime(booking.created_at)}</p>
        {booking.updated_at && booking.updated_at !== booking.created_at && (
          <p>Last updated: {formatDateTime(booking.updated_at)}</p>
        )}
      </div>
    </div>
  )
}