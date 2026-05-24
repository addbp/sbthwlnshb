import PaymentForm from '@/components/payments/PaymentForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getClientById } from '@/lib/actions/clients';

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{
    booking_id?: string;
    client_id?: string;
    service_id?: string;
    amount?: string;
  }>;
}) {
  const params = await searchParams;
  const bookingId = params.booking_id || null;
  const clientId = params.client_id || null;
  const serviceId = params.service_id || null;
  const amount = params.amount ? parseFloat(params.amount) : null;

  let clientData = null;
  if (clientId) {
    clientData = await getClientById(clientId);
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="space-y-4">
        <Link href="/dashboard/payments" className="text-xs font-bold text-brandAccent/60 hover:text-brandAccent flex items-center gap-1 uppercase tracking-widest">
          <ArrowLeft size={14} /> Back to Ledger
        </Link>
        <div>
          <h1 className="brand-heading text-4xl">Record Payment</h1>
          <p className="text-brandAccent/60 mt-1">Capture a new financial transaction.</p>
        </div>
      </div>

      <PaymentForm 
        initialBookingId={bookingId}
        initialClientId={clientId}
        initialServiceId={serviceId}
        initialAmount={amount}
        clientsData={clientData}
      />
    </div>
  );
}