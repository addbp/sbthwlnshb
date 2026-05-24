import BookingForm from '@/components/bookings/BookingForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NewBookingPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="space-y-4">
        <Link href="/dashboard/bookings" className="text-xs font-bold text-brandAccent/60 hover:text-brandAccent flex items-center gap-1 uppercase tracking-widest">
          <ArrowLeft size={14} /> Back to Registry
        </Link>
        <h1 className="brand-heading text-4xl">New Reservation</h1>
      </div>

      <BookingForm />
    </div>
  );
}
