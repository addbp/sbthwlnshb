'use client'

import { useState, useTransition } from 'react'
import { updateBookingStatus, type BookingStatus } from '@/lib/actions/booking-status'
import {
    CheckCircle,
    UserCheck,
    PlayCircle,
    XCircle,
    UserX,
    Sparkles,
} from 'lucide-react'

// Which actions are valid from each status
const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['checked_in', 'cancelled'],
    checked_in: ['in_progress', 'no_show', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
    no_show: [],
}

interface ActionDef {
    status: BookingStatus
    label: string
    icon: React.ReactNode
    variant: 'primary' | 'success' | 'danger' | 'warning' | 'ghost'
}

const ACTION_DEFS: ActionDef[] = [
    {
        status: 'confirmed',
        label: 'Confirm',
        icon: <CheckCircle size={15} />,
        variant: 'primary',
    },
    {
        status: 'checked_in',
        label: 'Check In',
        icon: <UserCheck size={15} />,
        variant: 'primary',
    },
    {
        status: 'in_progress',
        label: 'Start Service',
        icon: <PlayCircle size={15} />,
        variant: 'primary',
    },
    {
        status: 'completed',
        label: 'Complete',
        icon: <Sparkles size={15} />,
        variant: 'success',
    },
    {
        status: 'no_show',
        label: 'No Show',
        icon: <UserX size={15} />,
        variant: 'warning',
    },
    {
        status: 'cancelled',
        label: 'Cancel',
        icon: <XCircle size={15} />,
        variant: 'danger',
    },
]

const VARIANT_CLASSES: Record<ActionDef['variant'], string> = {
    primary:
        'bg-brandAccent text-white hover:bg-brandAccent/90 border border-brandAccent',
    success:
        'bg-green-600 text-white hover:bg-green-700 border border-green-600',
    danger:
        'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200',
    warning:
        'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200',
    ghost:
        'bg-stone-50 text-stone-700 hover:bg-stone-100 border border-stone-200',
}

interface BookingStatusActionsProps {
    bookingId: string
    currentStatus: BookingStatus | string
    /** compact = small inline buttons for the list page; full = larger buttons for the detail page */
    layout?: 'compact' | 'full'
}

export default function BookingStatusActions({
    bookingId,
    currentStatus,
    layout = 'full',
}: BookingStatusActionsProps) {
    const [isPending, startTransition] = useTransition()
    const [message, setMessage] = useState<{
        type: 'success' | 'error'
        text: string
    } | null>(null)

    const allowedNext =
        ALLOWED_TRANSITIONS[currentStatus as BookingStatus] ?? []

    const availableActions = ACTION_DEFS.filter((a) =>
        allowedNext.includes(a.status)
    )

    if (availableActions.length === 0) return null

    function handleAction(targetStatus: BookingStatus) {
        setMessage(null)
        startTransition(async () => {
            const result = await updateBookingStatus(bookingId, targetStatus)
            if (result.success) {
                setMessage({
                    type: 'success',
                    text: getSuccessMessage(targetStatus),
                })
                // Clear success after 4s
                setTimeout(() => setMessage(null), 4000)
            } else {
                setMessage({
                    type: 'error',
                    text: result.error ?? 'Something went wrong. Please try again.',
                })
            }
        })
    }

    if (layout === 'compact') {
        return (
            <div className="flex items-center gap-1 flex-wrap">
                {availableActions.map((action) => (
                    <button
                        key={action.status}
                        onClick={() => handleAction(action.status)}
                        disabled={isPending}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 ${VARIANT_CLASSES[action.variant]}`}
                    >
                        {action.icon}
                        {action.label}
                    </button>
                ))}
            </div>
        )
    }

    // Full layout for detail page
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                {availableActions.map((action) => (
                    <button
                        key={action.status}
                        onClick={() => handleAction(action.status)}
                        disabled={isPending}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${VARIANT_CLASSES[action.variant]}`}
                    >
                        {isPending ? (
                            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                            action.icon
                        )}
                        {action.label}
                    </button>
                ))}
            </div>

            {message && (
                <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-ui ${message.type === 'success'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                >
                    {message.type === 'success' ? (
                        <CheckCircle size={15} />
                    ) : (
                        <XCircle size={15} />
                    )}
                    {message.text}
                </div>
            )}
        </div>
    )
}

function getSuccessMessage(status: BookingStatus): string {
    const messages: Record<BookingStatus, string> = {
        confirmed: 'Booking confirmed successfully.',
        checked_in: 'Client checked in.',
        in_progress: 'Service started.',
        completed: 'Booking marked as completed. Client record updated.',
        cancelled: 'Booking cancelled.',
        no_show: 'Booking marked as no show.',
        pending: 'Booking returned to pending.',
    }
    return messages[status] ?? 'Status updated.'
}