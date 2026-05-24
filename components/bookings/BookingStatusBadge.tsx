import type { BookingStatus } from '@/lib/actions/booking-status'

const STATUS_CONFIG: Record<
    BookingStatus,
    { label: string; className: string }
> = {
    pending: {
        label: 'Pending',
        className: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    },
    confirmed: {
        label: 'Confirmed',
        className: 'bg-blue-100 text-blue-800 border border-blue-200',
    },
    checked_in: {
        label: 'Checked In',
        className: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    },
    in_progress: {
        label: 'In Progress',
        className: 'bg-purple-100 text-purple-800 border border-purple-200',
    },
    completed: {
        label: 'Completed',
        className: 'bg-green-100 text-green-800 border border-green-200',
    },
    cancelled: {
        label: 'Cancelled',
        className: 'bg-red-100 text-red-800 border border-red-200',
    },
    no_show: {
        label: 'No Show',
        className: 'bg-stone-100 text-stone-600 border border-stone-200',
    },
}

interface BookingStatusBadgeProps {
    status: string
    size?: 'sm' | 'md'
}

export default function BookingStatusBadge({
    status,
    size = 'sm',
}: BookingStatusBadgeProps) {
    const config = STATUS_CONFIG[status as BookingStatus] ?? {
        label: status,
        className: 'bg-stone-100 text-stone-600',
    }

    const sizeClass = size === 'md'
        ? 'px-3 py-1 text-sm font-medium'
        : 'px-2 py-0.5 text-xs font-medium'

    return (
        <span className={`inline-flex items-center rounded-full ${sizeClass} ${config.className}`}>
            {config.label}
        </span>
    )
}

export { STATUS_CONFIG }