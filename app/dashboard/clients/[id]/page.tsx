import { getClientById } from '@/lib/actions/clients';
import { getWaiversByClient } from '@/lib/actions/waivers';
import { getTransactionsByClient } from '@/lib/actions/transactions';
import WaiverCard from '@/components/waivers/WaiverCard';
import Link from 'next/link';
import {
  ArrowLeft,
  Edit,
  Phone,
  Mail,
  Map,
  Calendar,
  FileText,
  CreditCard,
  Clock,
  Sparkles,
  Percent,
  Award,
  Banknote,
  Smartphone,
  Building2,
  Wallet,
  Plus
} from 'lucide-react';

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return <div className="p-8 text-center text-brandAccent/60">Invalid client ID</div>;
  const client = await getClientById(id);
  const waivers = await getWaiversByClient(id);
  const { data: transactions } = await getTransactionsByClient(id);

  if (!client) {
    return <div className="p-8 text-center text-brandAccent/60">Client not found.</div>;
  }

  const isMember = !!client.discount_id || (client.membership_tier && client.membership_tier !== 'none');

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote size={14} />;
      case 'gcash': return <Smartphone size={14} />;
      case 'card': return <CreditCard size={14} />;
      case 'bank_transfer': return <Building2 size={14} />;
      default: return <Wallet size={14} />;
    }
  };

  const formatMethod = (method: string) => {
    switch (method) {
      case 'cash': return 'Cash';
      case 'gcash': return 'GCash';
      case 'card': return 'Card';
      case 'bank_transfer': return 'Bank';
      default: return 'Other';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-100 text-emerald-700';
      case 'partial': return 'bg-amber-100 text-amber-700';
      case 'unpaid': return 'bg-red-100 text-red-700';
      case 'refunded': return 'bg-purple-100 text-purple-700';
      default: return 'bg-brandAccent/10 text-brandAccent/60';
    }
  };

  const totalSpent = (transactions ?? [])
    .filter((t: any) => t.payment_status === 'paid')
    .reduce((sum: number, t: any) => sum + parseFloat(t.final_amount || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-start">
        <div className="space-y-4">
          <Link href="/dashboard/clients" className="text-xs font-bold text-brandAccent/60 hover:text-brandAccent flex items-center gap-1 uppercase tracking-widest">
            <ArrowLeft size={14} /> Back to Clients
          </Link>
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-brandSecondary/30 border border-brandAccent/10 flex items-center justify-center text-brandAccent text-3xl font-bold">
                {client.full_name?.slice(0, 2).toUpperCase() || '??'}
              </div>
              {isMember && (
                <div className="absolute -bottom-1 -right-1 bg-brandAccent text-white p-1.5 rounded-full border-4 border-brandBackground">
                  <Award size={16} />
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="brand-heading text-4xl">{client.full_name}</h1>
                {isMember ? (
                  <span className="bg-brandAccent text-white text-[10px] font-bold px-3 py-1 rounded-pill uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                    <Sparkles size={10} /> Member
                  </span>
                ) : (
                  <span className="bg-brandAccent/10 text-brandAccent/60 text-[10px] font-bold px-3 py-1 rounded-pill uppercase tracking-widest">
                    Non-Member
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center text-brandAccent/60 text-xs font-bold uppercase tracking-wider">
                  {client.client_type || 'Regular'} Client
                </span>
                <span className="text-brandAccent/20">&bull;</span>
                <span className="text-xs text-brandAccent/40">Registered {client.created_at ? new Date(client.created_at).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
        <Link href={`/dashboard/clients/${client.id}/edit`} className="btn-secondary flex items-center gap-2">
          <Edit size={18} />
          <span>Edit Profile</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          {/* Contact Details Card */}
          <div className="brand-card p-6 space-y-6">
            <h3 className="brand-heading text-xl border-b border-brandAccent/10 pb-2 flex items-center gap-2">
              <UserCardIcon icon={<Phone size={16} />} />
              Contact Details
            </h3>
            <div className="space-y-4">
              <ProfileInfoItem label="Mobile" value={client.mobile_number} icon={<Phone size={16} />} />
              <ProfileInfoItem label="Email" value={client.email} icon={<Mail size={16} />} />
              <ProfileInfoItem label="Address" value={client.address} icon={<Map size={16} />} />
            </div>
          </div>

          {/* Membership & Discount Card */}
          <div className="brand-card p-6 bg-brandPrimary/10 border-brandAccent/20 space-y-6">
            <h3 className="brand-heading text-xl border-b border-brandAccent/10 pb-2 flex items-center gap-2">
              <UserCardIcon icon={<CreditCard size={16} />} />
              Loyalty Profile
            </h3>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-brandAccent/40 font-bold mb-1">Membership Tier</div>
                  <div className="font-bold flex items-center gap-2 text-brandAccent">
                    <span className="capitalize">{client.membership_tier && client.membership_tier !== 'none' ? client.membership_tier : 'Standard'}</span>
                  </div>
                </div>
                <div className="bg-brandAccent/5 p-2 rounded-base">
                  <Award size={20} className="text-brandAccent" />
                </div>
              </div>

              <div className="p-4 bg-white/50 border border-brandAccent/10 rounded-base space-y-3">
                <div className="text-[10px] uppercase tracking-widest text-brandAccent/40 font-bold">Active Benefits</div>
                {client.discounts ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-brandText">{client.discounts.name}</span>
                      <span className="flex items-center gap-1 text-emerald-600 font-bold text-sm">
                        <Percent size={14} />
                        {parseFloat(client.discounts.discount_percentage).toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-[10px] text-brandAccent/60 italic leading-relaxed">
                      This discount will be applied automatically during checkout.
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-brandAccent/40 italic">
                    No active discount found for this client.
                  </div>
                )}
              </div>

              {/* Total Spent */}
              <div className="p-3 bg-brandAccent/5 rounded-base flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-brandAccent/40 font-bold">Lifetime Spend</span>
                <span className="font-bold text-brandAccent">P{totalSpent.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* Digital Waivers Section */}
          <div className="brand-card p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-brandAccent/10 pb-2">
              <h3 className="brand-heading text-xl flex items-center gap-2">
                <FileText size={16} className="text-brandAccent/40" />
                Digital Waivers
              </h3>
              <Link href={`/dashboard/clients/${id}/waivers/new`} className="btn-primary text-sm py-1.5 px-4">
                New Waiver
              </Link>
            </div>

            {waivers && waivers.length > 0 ? (
              <div className="space-y-4">
                {waivers.map((waiver: any) => (
                  <WaiverCard key={waiver.id} waiver={waiver} />
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-brandPrimary/5 rounded-base border border-brandAccent/10">
                <FileText size={32} className="mx-auto text-brandAccent/20 mb-3" />
                <div className="text-brandAccent/60 font-bold mb-1">No waivers signed yet</div>
                <p className="text-xs text-brandAccent/40">This client has not signed any digital waivers.</p>
              </div>
            )}
          </div>

          {/* Booking History */}
          <div className="brand-card p-6 space-y-6">
            <h3 className="brand-heading text-xl border-b border-brandAccent/10 pb-2 flex items-center gap-2">
              <Calendar size={16} className="text-brandAccent/40" />
              Booking History
            </h3>
            {client.bookings && client.bookings.length > 0 ? (
              <div className="space-y-3">
                {client.bookings.slice(0, 5).map((booking: any) => (
                  <Link key={booking.id} href={`/dashboard/bookings/${booking.id}`} className="block p-4 bg-brandBackground/30 rounded-base border border-brandAccent/5 hover:border-brandAccent/20 transition-all">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <Calendar size={14} className="text-brandAccent/40" />
                        <span className="font-bold text-sm">{new Date(booking.booking_date).toLocaleDateString()}</span>
                        <span className="text-xs text-brandAccent/40">{booking.booking_time?.slice(0, 5)}</span>
                      </div>
                      <span className="px-2 py-0.5 bg-brandAccent/10 text-brandAccent rounded-pill text-[10px] font-bold uppercase">{booking.booking_status}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-brandPrimary/5 rounded-base border border-brandAccent/10">
                <Clock size={32} className="mx-auto text-brandAccent/20 mb-3" />
                <div className="text-brandAccent/60 font-bold mb-1">No bookings yet</div>
                <p className="text-xs text-brandAccent/40">This client has no booking history.</p>
              </div>
            )}
          </div>

          {/* Transaction History */}
          <div className="brand-card p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-brandAccent/10 pb-2">
              <h3 className="brand-heading text-xl flex items-center gap-2">
                <CreditCard size={16} className="text-brandAccent/40" />
                Transaction History
              </h3>
              <Link href={`/dashboard/payments/new?client_id=${id}`} className="btn-primary text-sm py-1.5 px-4 flex items-center gap-1.5">
                <Plus size={14} /> Record Payment
              </Link>
            </div>

            {transactions && transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.map((txn: any) => (
                  <Link key={txn.id} href={`/dashboard/payments/${txn.id}`} className="block p-4 bg-brandBackground/30 rounded-base border border-brandAccent/5 hover:border-brandAccent/20 transition-all">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className="text-brandAccent/40">
                          {getMethodIcon(txn.payment_method)}
                        </div>
                        <div>
                          <div className="font-bold text-sm flex items-center gap-2">
                            P{parseFloat(txn.final_amount || txn.total_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            {parseFloat(txn.discount_amount) > 0 && (
                              <span className="text-[10px] text-emerald-600 font-bold">
                                -{parseFloat(txn.discount_percentage).toFixed(0)}% off
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-brandAccent/40 mt-0.5">
                            {txn.service?.service_name || 'General'} &bull; {formatMethod(txn.payment_method)} &bull; {new Date(txn.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-pill text-[10px] font-bold uppercase tracking-widest ${getStatusColor(txn.payment_status)}`}>
                        {txn.payment_status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-brandPrimary/5 rounded-base border border-brandAccent/10">
                <CreditCard size={32} className="mx-auto text-brandAccent/20 mb-3" />
                <div className="text-brandAccent/60 font-bold mb-1">No transactions recorded</div>
                <p className="text-xs text-brandAccent/40">Record a payment to see transaction history here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UserCardIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="text-brandAccent/40">
      {icon}
    </div>
  );
}

function ProfileInfoItem({ label, value, icon }: { label: string, value?: string, icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 text-brandAccent/30">{icon}</div>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-brandAccent/40 font-bold mb-0.5">{label}</div>
        <div className="font-medium text-sm">{value || 'Not provided'}</div>
      </div>
    </div>
  );
}