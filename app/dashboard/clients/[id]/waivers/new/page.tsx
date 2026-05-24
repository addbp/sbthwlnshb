import { getClientById } from '@/lib/actions/clients';
import WaiverForm from '@/components/waivers/WaiverForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function NewWaiverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!id || id === 'undefined') {
    return (
      <div className="p-8 text-center text-brandAccent/60">
        Invalid client ID.
      </div>
    );
  }

  const client = await getClientById(id);

  if (!client) {
    return (
      <div className="p-8 text-center text-brandAccent/60">
        Client not found.
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="space-y-4">
        <Link
          href={`/dashboard/clients/${id}`}
          className="text-xs font-bold text-brandAccent/60 hover:text-brandAccent flex items-center gap-1 uppercase tracking-widest"
        >
          <ArrowLeft size={14} /> Back to Client Profile
        </Link>

        <div className="border-l-4 border-brandAccent pl-5">
          <h1 className="brand-heading text-4xl">Digital Waiver</h1>
          <p className="text-xs text-brandAccent/60 mt-1 uppercase tracking-wider font-medium">
            Health Disclosure & Consent Form
          </p>
        </div>
      </div>

      <WaiverForm clientId={client.id} clientName={client.full_name} />
    </div>
  );
}
