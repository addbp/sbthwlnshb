import { getAllWaivers } from '@/lib/actions/waivers';
import { FileText, ShieldCheck, ShieldAlert, ArrowUpRight, User, Calendar, Clock, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';

export default async function WaiversPage() {
  const { data: waivers, error } = await getAllWaivers();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="brand-heading text-4xl">Document Registry</h1>
          <p className="text-brandAccent/60">Digital logs and attached physical health waivers.</p>
        </div>
      </div>

      <div className="brand-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-brandAccent/10">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-brandAccent/50">Client</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-brandAccent/50">Service</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-brandAccent/50">Signed At</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-brandAccent/50 text-center">Documentation</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-brandAccent/50 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brandAccent/5">
              {waivers && waivers.length > 0 ? (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                waivers.map((waiver: any) => {
                  const hasPhysicalDoc = !!waiver.photo_attachment_url;
                  const hasDigitalSig = !!waiver.signature || !!waiver.signature_url;
                  const isValidDoc = hasPhysicalDoc || hasDigitalSig;

                  return (
                    <tr key={waiver.id} className="hover:bg-brandBackground/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-brandAccent/10 text-brandAccent flex items-center justify-center font-bold text-xs shrink-0">
                            {waiver.clients?.full_name?.slice(0, 2).toUpperCase() || '??'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{waiver.clients?.full_name}</p>
                            <p className="text-[10px] text-brandAccent/40 truncate">{waiver.clients?.mobile_number || 'No contact'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-brandAccent/70">
                          <FileText size={14} className="shrink-0" />
                          <span className="text-xs font-medium truncate max-w-[150px]">{waiver.service_availed || 'Unspecified'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold">
                            <Calendar size={12} className="text-brandAccent/30" />
                            {new Date(waiver.signed_at || waiver.created_at || waiver.date_signed).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-brandAccent/40 font-medium">
                            <Clock size={12} className="text-brandAccent/20" />
                            {new Date(waiver.signed_at || waiver.created_at || waiver.date_signed).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          <div title={isValidDoc ? "Legally Documented" : "Action Required"} className={`p-1.5 rounded-full ${isValidDoc ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                            {isValidDoc ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                          </div>

                          {hasPhysicalDoc && (
                            <a href={waiver.photo_attachment_url} target="_blank" rel="noopener noreferrer" title="View Physical Attachment" className="p-1.5 bg-blue-500/10 text-blue-600 rounded-full hover:bg-blue-500/20 transition-colors">
                              <ImageIcon size={16} />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/dashboard/clients/${waiver.client_id}`}
                          className="inline-flex items-center gap-1.5 text-[10px] font-bold text-brandAccent uppercase tracking-widest hover:underline"
                        >
                          Client Profile <ArrowUpRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="space-y-3">
                      <div className="text-brandAccent/20">
                        <FileText size={48} className="mx-auto" />
                      </div>
                      <p className="text-sm font-bold text-brandAccent/40">No waivers have been filed yet.</p>
                      <Link href="/waiver" className="btn-primary inline-block mt-4">Open Intake Form</Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}