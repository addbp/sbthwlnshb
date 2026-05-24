import ClientForm from '@/components/clients/ClientForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getClientById } from '@/lib/actions/clients';

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClientById(id);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="space-y-4">
        <Link href={`/dashboard/clients/${id}`} className="text-xs font-bold text-brandAccent/60 hover:text-brandAccent flex items-center gap-1 uppercase tracking-widest">
          <ArrowLeft size={14} /> Back to Profile
        </Link>
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <h1 className="brand-heading text-4xl">Edit Client Profile</h1>
            <p className="text-brandAccent/60">Update information for {client?.full_name}.</p>
          </div>
        </div>
      </div>

      <div className="brand-card p-8">
        <ClientForm initialData={client} id={id} />
      </div>
    </div>
  );
}
