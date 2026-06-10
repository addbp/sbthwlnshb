import { getAllWaivers } from '@/lib/actions/waivers';
import { FileText, ShieldCheck, ShieldAlert, ArrowUpRight, User, Calendar, Clock, Image as ImageIcon, CheckCircle } from 'lucide-react';
import Link from 'next/link';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function WaiversPage(props: any) {
  // Gracefully handle Next.js 13/14/15 search params for Server Components
  const searchParams = props.searchParams || {};
  const params = searchParams instanceof Promise ? await searchParams : searchParams;

  // Determine which branch to view (Defaults to Malolos)
  const viewBranch = params?.branch === 'Pulilan' ? 'Sabbath Pulilan' : 'Sabbath Malolos';
  const branchParam = viewBranch === 'Sabbath Pulilan' ? 'Pulilan' : 'Malolos';

  // Fetch all waivers from the server
  const { data: allWaivers, error } = await getAllWaivers();

  // Filter the waivers strictly by the selected branch tab
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const waivers = allWaivers?.filter((w: any) => (w.branch || 'Sabbath Malolos') === viewBranch) || [];

  // Determine if a specific waiver was clicked to open the Modal
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedWaiver = params?.modal ? waivers.find((w: any) => String(w.id) === String(params.modal)) : null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="brand-heading text-4xl">Document Registry</h1>
          <p className="text-brandAccent/60">Digital logs and attached physical health waivers.</p>
        </div>
      </div>

      {/* ── BRANCH TOGGLE TABS ── */}
      <div className="flex gap-2 p-1.5 bg-brandAccent/5 rounded-xl w-fit">
        <Link
          href="?branch=Malolos"
          className={`px-6 py-2.5 rounded-lg text-[13px] font-bold transition-all duration-200 ${viewBranch === 'Sabbath Malolos' ? 'bg-white text-brandAccent shadow-sm' : 'text-brandAccent/50 hover:text-brandAccent/80'}`}
        >
          Malolos Branch
        </Link>
        <Link
          href="?branch=Pulilan"
          className={`px-6 py-2.5 rounded-lg text-[13px] font-bold transition-all duration-200 ${viewBranch === 'Sabbath Pulilan' ? 'bg-white text-brandAccent shadow-sm' : 'text-brandAccent/50 hover:text-brandAccent/80'}`}
        >
          Pulilan Branch
        </Link>
      </div>

      <div className="brand-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-brandAccent/10 bg-[#FDFCF8]">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-brandAccent/50">Client</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-brandAccent/50">Service</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-brandAccent/50">Signed At</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-brandAccent/50 text-center">Attached Photo / Signature</th>
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
                            <p className="font-bold text-sm text-[#1A1A1A] truncate">{waiver.clients?.full_name}</p>
                            <p className="text-[10px] text-brandAccent/50 truncate">{waiver.clients?.mobile_number || 'No contact'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-[#1A1A1A]/80">
                          <FileText size={14} className="shrink-0 text-brandAccent/60" />
                          <span className="text-xs font-semibold truncate max-w-[200px]">{waiver.service_availed || 'Unspecified'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1A1A1A]">
                            <Calendar size={12} className="text-brandAccent/40" />
                            {new Date(waiver.signed_at || waiver.created_at || waiver.date_signed).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-[#1A1A1A]/50 font-medium">
                            <Clock size={12} className="text-brandAccent/30" />
                            {new Date(waiver.signed_at || waiver.created_at || waiver.date_signed).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center items-center gap-2">
                          {hasPhysicalDoc ? (
                            <div className="relative group/img cursor-pointer border border-brandAccent/20 rounded-md overflow-hidden shadow-sm" title="Attached Photo Found">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={waiver.photo_attachment_url} alt="Attached" className="h-10 w-12 object-cover" />
                              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                                <ImageIcon size={14} className="text-white" />
                              </div>
                            </div>
                          ) : hasDigitalSig ? (
                            <div title="Digital Signature Validated" className="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center gap-1.5 text-[10px] font-bold tracking-wider">
                              <ShieldCheck size={14} /> SIGNED
                            </div>
                          ) : (
                            <div title="Action Required" className="px-3 py-1.5 bg-red-500/10 text-red-600 rounded-full flex items-center gap-1.5 text-[10px] font-bold tracking-wider">
                              <ShieldAlert size={14} /> MISSING
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end gap-2">
                          <Link
                            href={`?branch=${branchParam}&modal=${waiver.id}`}
                            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-brandAccent uppercase tracking-widest bg-brandAccent/5 px-3 py-1.5 rounded-md hover:bg-brandAccent/10 hover:text-[#1A1A1A] transition-all"
                          >
                            View Details <ArrowUpRight size={12} />
                          </Link>
                          <Link
                            href={`/dashboard/clients/${waiver.client_id}`}
                            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-brandAccent/50 uppercase tracking-widest hover:text-brandAccent hover:underline"
                          >
                            Client Profile <User size={10} />
                          </Link>
                        </div>
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
                      <p className="text-sm font-bold text-brandAccent/40">No waivers have been filed for {viewBranch} yet.</p>
                      <Link href="/waiver" className="btn-primary inline-block mt-4">Open Intake Form</Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── POPUP MODAL FOR WAIVER DETAILS ─── */}
      {selectedWaiver && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#F9F4EB] w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

            {/* Modal Header */}
            <div className="px-8 py-5 border-b border-black/5 flex justify-between items-center bg-white">
              <div>
                <p className="text-[10px] font-bold tracking-[0.15em] text-[#C58F3B] uppercase mb-1 flex items-center gap-2">
                  <ShieldCheck size={14} /> Verified Health Waiver
                </p>
                <h2 className="font-serif text-3xl text-[#1A1A1A] m-0">{selectedWaiver.clients?.full_name}</h2>
              </div>
              <Link href={`?branch=${branchParam}`} scroll={false} className="text-black/40 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </Link>
            </div>

            {/* Modal Body */}
            <div className="p-8 overflow-y-auto space-y-6">

              {/* Service & Therapist History Block */}
              <div className="bg-white p-6 rounded-xl border border-black/5 shadow-sm">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#C58F3B] mb-4 pb-3 border-b border-black/5">Service & Therapist History</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-black/40 uppercase tracking-wider mb-1">Service Availed</p>
                    <p className="text-sm font-semibold text-[#1A1A1A]">{selectedWaiver.service_availed || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-black/40 uppercase tracking-wider mb-1">Assigned Therapist</p>
                    <p className="text-sm font-semibold text-[#1A1A1A]">{selectedWaiver.therapist_name || selectedWaiver.therapist || 'Unassigned'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-black/40 uppercase tracking-wider mb-1">Session Date & Time</p>
                    <p className="text-sm font-semibold text-[#1A1A1A]">
                      {new Date(selectedWaiver.signed_at || selectedWaiver.created_at || selectedWaiver.date_signed).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Digital Signature / Attached Photo Block */}
              <div className="bg-white p-6 rounded-xl border border-black/5 shadow-sm">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#C58F3B] mb-4 pb-3 border-b border-black/5">Document Verification</h3>

                {selectedWaiver.photo_attachment_url ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg w-fit">
                      <CheckCircle size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider">Physical Photo Attached</span>
                    </div>
                    <div className="bg-black/5 p-2 rounded-xl border border-black/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={selectedWaiver.photo_attachment_url} alt="Waiver Attachment" className="w-full max-h-[400px] object-contain rounded-lg" />
                    </div>
                  </div>
                ) : selectedWaiver.signature_url || selectedWaiver.signature ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-2 rounded-lg w-fit">
                      <ShieldCheck size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider">Digital Signature Validated</span>
                    </div>
                    {selectedWaiver.signature_url && (
                      <div className="bg-white p-6 rounded-xl border border-black/10 flex justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={selectedWaiver.signature_url} alt="Client Digital Signature" className="w-full max-w-sm max-h-48 object-contain" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-5 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-3">
                    <ShieldAlert size={20} />
                    <div>
                      <p className="text-sm font-bold">No documentation found.</p>
                      <p className="text-xs opacity-80 mt-0.5">Please ensure the client signs the waiver or uploads a physical photo copy.</p>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-8 py-5 border-t border-black/5 bg-[#FDFCF8] flex justify-end">
              <Link href={`?branch=${branchParam}`} scroll={false} className="px-6 py-2.5 bg-[#1A1A1A] text-[#C58F3B] font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-black transition-colors">
                Close Details
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}