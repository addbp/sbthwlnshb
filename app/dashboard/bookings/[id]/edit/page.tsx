import { getBookingById } from '@/lib/actions/bookings';
import BookingForm from '@/components/bookings/BookingForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function EditBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const booking = await getBookingById(id);

  if (!booking) {
    return <div className="p-8 text-center text-brandAccent/60">Booking not found.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="space-y-4">
        <Link href={`/dashboard/bookings/${id}`} className="text-xs font-bold text-brandAccent/60 hover:text-brandAccent flex items-center gap-1 uppercase tracking-widest">
          <ArrowLeft size={14} /> Back to Reservation
        </Link>
        <h1 className="brand-heading text-4xl">Modify Reservation</h1>
      </div>

      <BookingForm initialData={booking} id={id} />
    </div>
  );
}
