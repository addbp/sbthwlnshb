import { getRecentBookings } from '@/lib/actions/bookings';
import { Calendar, User, Scissors, CreditCard, Minus } from 'lucide-react';

interface Props {
    startDate: string;
    endDate: string;
}

const STATUS_STYLES: Record<string, string> = {
    completed: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
    confirmed: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
    pending: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
    no_show: 'bg-red-500/10 text-red-700 border-red-500/20',
};

const PAYMENT_STYLES: Record<string, string> = {
    paid: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
    unpaid: 'bg-red-500/10 text-red-700 border-red-500/20',
    partial: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
};

function statusStyle(val: string | null) {
    return STATUS_STYLES[val?.toLowerCase() ?? ''] ?? 'bg-brandPrimary/50 text-brandAccent/60 border-brandAccent/10';
}

function paymentStyle(val: string | null) {
    return PAYMENT_STYLES[val?.toLowerCase() ?? ''] ?? 'bg-brandPrimary/50 text-brandAccent/60 border-brandAccent/10';
}

export default async function RecentBookings({ startDate, endDate }: Props) {
    const bookings = await getRecentBookings(startDate, endDate, 10);

    const fmt = (n: number | null) =>
        n == null
            ? '—'
            : `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div className="brand-card space-y-5">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <h2 className="brand-heading text-lg">Recent Bookings</h2>
                    <p className="text-[10px] uppercase tracking-widest text-brandAccent/40 font-bold">
                        Latest {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'} in period
                    </p>
                </div>
                <div className="p-2 bg-blue-500/10 rounded-base">
                    <Calendar size={18} className="text-blue-600" />
                </div>
            </div>

            {/* Empty state */}
            {bookings.length === 0 && (
                <div className="py-10 flex flex-col items-center gap-2">
                    <Minus size={28} className="text-brandAccent/20" />
                    <p className="text-[10px] uppercase tracking-widest font-bold text-brandAccent/30">
                        No bookings for this period
                    </p>
                </div>
            )}

            {/* Table */}
            {bookings.length > 0 && (
                <div className="border border-brandAccent/10 rounded-base overflow-hidden divide-y divide-brandAccent/5">

                    {/* Table header */}
                    <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_auto_auto_auto] gap-4 px-4 py-2 bg-brandBackground/60">
                        {['Client', 'Service', 'Therapist', 'Amount', 'Status', 'Payment'].map((h) => (
                            <span key={h} className="text-[9px] uppercase tracking-widest font-bold text-brandAccent/40">
                                {h}
                            </span>
                        ))}
                    </div>

                    {/* Rows */}
                    {bookings.map((b) => (
                        <div
                            key={b.id}
                            className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto_auto_auto] gap-2 md:gap-4 px-4 py-3 hover:bg-brandBackground/40 transition-colors"
                        >
                            {/* Client */}
                            <div className="flex items-center gap-2">
                                <User size={12} className="text-brandAccent/30 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-brandAccent truncate">
                                        {b.client_name_text ?? 'Unknown'}
                                    </p>
                                    {b.customer_type && (
                                        <p className="text-[9px] text-brandAccent/40 capitalize">{b.customer_type}</p>
                                    )}
                                </div>
                            </div>

                            {/* Service */}
                            <div className="flex items-center gap-2">
                                <Scissors size={12} className="text-brandAccent/30 shrink-0" />
                                <div>
                                    <p className="text-xs font-medium text-brandAccent/80 truncate">
                                        {b.service_name_text ?? '—'}
                                    </p>
                                    {b.category && (
                                        <p className="text-[9px] text-brandAccent/40 uppercase tracking-wider">{b.category}</p>
                                    )}
                                </div>
                            </div>

                            {/* Therapist */}
                            <div className="flex items-center gap-2">
                                <User size={12} className="text-brandAccent/20 shrink-0" />
                                <span className="text-xs text-brandAccent/70 truncate">
                                    {b.therapist_name_text ?? 'Unassigned'}
                                </span>
                            </div>

                            {/* Amount */}
                            <div className="flex items-center gap-1">
                                <CreditCard size={11} className="text-brandAccent/30 shrink-0" />
                                <span className="text-xs font-bold text-brandAccent">
                                    {fmt(b.total_amount)}
                                </span>
                            </div>

                            {/* Booking status */}
                            <span className={`self-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${statusStyle(b.booking_status)}`}>
                                {b.booking_status ?? '—'}
                            </span>

                            {/* Payment status */}
                            <span className={`self-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${paymentStyle(b.payment_status)}`}>
                                {b.payment_status ?? '—'}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}