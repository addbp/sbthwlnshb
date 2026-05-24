import { getTransactionById } from '@/lib/actions/transactions';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  Calendar,
  CreditCard,
  Tag,
  MessageCircle,
  ExternalLink,
  Banknote,
  Smartphone,
  Building2,
  Wallet,
  Clock,
  FileText
} from 'lucide-react';

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: txn, error } = await getTransactionById(id);

  if (error || !txn) {
    return <div className="p-8 text-center text-brandAccent/60">Transaction not found.</div>;
  }

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote size={20} />;
      case 'gcash': return <Smartphone size={20} />;
      case 'card': return <CreditCard size={20} />;
      case 'bank_transfer': return <Building2 size={20} />;
      default: return <Wallet size={20} />;
    }
  };

  const formatMethod = (method: string) => {
    switch (method) {
      case 'cash': return 'Cash';
      case 'gcash': return 'GCash';
      case 'card': return 'Card';
      case 'bank_transfer': return 'Bank Transfer';
      default: return 'Other';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'partial': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'unpaid': return 'bg-red-100 text-red-700 border-red-200';
      case 'refunded': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-brandAccent/10 text-brandAccent/60';
    }
  };

  const originalAmount = parseFloat(txn.original_amount ?? txn.subtotal ?? 0);
  const discountAmount = parseFloat(txn.discount_amount ?? txn.discount ?? 0);
  const finalAmount = parseFloat(txn.final_amount ?? txn.total_amount ?? 0);
  const discountPct = parseFloat(txn.discount_percentage ?? 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div className="space-y-4">
          <Link href="/dashboard/payments" className="text-xs font-bold text-brandAccent/60 hover:text-brandAccent flex items-center gap-1 uppercase tracking-widest">
            <ArrowLeft size={14} /> Back to Ledger
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="brand-heading text-4xl">Transaction Record</h1>
            <span className="bg-brandAccent/10 text-brandAccent px-3 py-1 rounded-pill text-[10px] font-bold uppercase tracking-widest">
              #{txn.id.slice(0, 8)}
            </span>
          </div>
        </div>
        <div className={`px-4 py-2 rounded-pill text-xs font-bold uppercase tracking-widest border ${getStatusColor(txn.payment_status)}`}>
          {txn.payment_status}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Financial Summary */}
          <div className="brand-card p-10 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-6 bg-brandBackground/30 rounded-base">
                <div className="text-[10px] uppercase tracking-widest text-brandAccent/40 font-bold mb-2">Original</div>
                <div className="text-2xl font-bold font-body">
                  P{originalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="text-center p-6 bg-emerald-50 rounded-base border border-emerald-100">
                <div className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold mb-2">Discount</div>
                <div className="text-2xl font-bold font-body text-emerald-600">
                  {discountAmount > 0
                    ? `-P${discountAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                    : 'None'}
                </div>
                {discountPct > 0 && (
                  <div className="text-xs text-emerald-500 mt-1">{discountPct.toFixed(0)}% applied</div>
                )}
              </div>
              <div className="text-center p-6 bg-brandAccent text-white rounded-base">
                <div className="text-[10px] uppercase tracking-widest opacity-60 font-bold mb-2">Final Amount</div>
                <div className="text-3xl font-bold font-body">
                  P{finalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-6 border-t border-brandAccent/5">
              <div className="space-y-6">
                <SectionHeader icon={<Tag size={20} />} title="Payment Info" />
                <div className="space-y-4">
                  <DetailItem label="Method" value={formatMethod(txn.payment_method)} icon={getMethodIcon(txn.payment_method)} />
                  <DetailItem label="Reference" value={txn.reference_number || 'No reference provided'} />
                  <DetailItem label="Recorded" value={new Date(txn.created_at).toLocaleString()} />
                </div>
              </div>
              <div className="space-y-6">
                <SectionHeader icon={<FileText size={20} />} title="Service Details" />
                <div className="space-y-4">
                  <DetailItem label="Service" value={txn.service?.service_name || 'General Payment'} />
                  {txn.discount_rule && (
                    <DetailItem label="Discount" value={`${txn.discount_rule.discount_name} (${parseFloat(txn.discount_rule.discount_value).toFixed(0)}%)`} />
                  )}
                  {txn.booking && (
                    <DetailItem label="Linked Booking" value={`${new Date(txn.booking.booking_date).toLocaleDateString()} at ${txn.booking.booking_time?.slice(0, 5)}`} />
                  )}
                </div>
              </div>
            </div>

            {txn.notes && (
              <div className="space-y-4 pt-6 border-t border-brandAccent/5">
                <SectionHeader icon={<MessageCircle size={20} />} title="Internal Notes" />
                <div className="p-5 bg-brandBackground/30 rounded-base text-sm leading-relaxed text-brandAccent/70 italic">
                  {txn.notes}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Client Card */}
          <div className="brand-card p-6 space-y-6 border-l-4 border-l-brandAccent shadow-sm">
            <div className="flex justify-between items-start">
              <SectionHeader icon={<User size={18} />} title="Client Profile" />
              {txn.client && (
                <Link href={`/dashboard/clients/${txn.client.id}`} className="p-2 hover:bg-brandAccent/5 rounded-base text-brandAccent transition-all">
                  <ExternalLink size={14} />
                </Link>
              )}
            </div>
            <div className="flex items-center gap-4 py-2">
              <div className="w-12 h-12 rounded-full bg-brandSecondary/30 text-brandAccent flex items-center justify-center font-bold text-xl">
                {txn.client?.full_name?.slice(0, 2).toUpperCase() || '??'}
              </div>
              <div>
                <h4 className="font-bold text-lg">{txn.client?.full_name || 'Unknown Client'}</h4>
                <p className="text-xs text-brandAccent/60">{txn.client?.mobile_number || 'No Mobile'}</p>
              </div>
            </div>
          </div>

          {/* Booking Link Card */}
          {txn.booking && (
            <div className="brand-card p-6 space-y-6">
              <SectionHeader icon={<Calendar size={18} />} title="Linked Booking" />
              <Link href={`/dashboard/bookings/${txn.booking.id}`} className="block p-4 bg-brandBackground/30 rounded-base border border-brandAccent/10 hover:border-brandAccent/30 transition-all">
                <div className="text-sm font-bold">
                  {new Date(txn.booking.booking_date).toLocaleDateString('en-US', { dateStyle: 'full' })}
                </div>
                <div className="text-xs text-brandAccent/40 mt-1 flex items-center gap-1">
                  <Clock size={12} /> {txn.booking.booking_time?.slice(0, 5)}
                </div>
                <div className="mt-2 flex gap-2">
                  <span className="px-2 py-0.5 bg-brandAccent/10 text-brandAccent rounded-pill text-[10px] font-bold uppercase tracking-widest">
                    {txn.booking.booking_status}
                  </span>
                </div>
              </Link>
            </div>
          )}

          {/* Timestamp Card */}
          <div className="brand-card p-6 space-y-4">
            <SectionHeader icon={<Clock size={18} />} title="Record Metadata" />
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-brandAccent/40">Created</span>
                <span className="font-medium">{new Date(txn.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode, title: string }) {
  return (
    <div className="flex items-center gap-2 text-brandAccent">
      {icon}
      <h3 className="font-bold text-xs uppercase tracking-widest">{title}</h3>
    </div>
  );
}

function DetailItem({ label, value, icon }: { label: string, value: string, icon?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-brandAccent/40 uppercase tracking-widest mb-1">{label}</div>
      <div className="font-bold flex items-center gap-2">
        {icon && <span className="text-brandAccent/40">{icon}</span>}
        {value}
      </div>
    </div>
  );
}