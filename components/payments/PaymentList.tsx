'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  CreditCard,
  ChevronRight,
  User,
  Calendar,
  Banknote,
  Smartphone,
  Building2,
  Wallet,
  CircleDollarSign,
  Filter,
  Receipt
} from 'lucide-react';

interface PaymentListProps {
  initialTransactions: any[];
}

export default function PaymentList({ initialTransactions }: PaymentListProps) {
  const [transactions] = useState(initialTransactions);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');

  const filtered = transactions.filter(txn => {
    const matchesSearch =
      txn.clients?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      txn.clients?.mobile_number?.includes(searchTerm) ||
      txn.services?.service_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      txn.reference_number?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || txn.payment_status === statusFilter;
    const matchesMethod = methodFilter === 'all' || txn.payment_method === methodFilter;

    return matchesSearch && matchesStatus && matchesMethod;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-100 text-emerald-700';
      case 'partial': return 'bg-amber-100 text-amber-700';
      case 'unpaid': return 'bg-red-100 text-red-700';
      case 'refunded': return 'bg-purple-100 text-purple-700';
      default: return 'bg-brandAccent/10 text-brandAccent/60';
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote size={14} />;
      case 'gcash': return <Smartphone size={14} />;
      case 'card': return <CreditCard size={14} />;
      case 'bank_transfer': return <Building2 size={14} />;
      default: return <Wallet size={14} />;
    }
  };

  const formatMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Cash';
      case 'gcash': return 'GCash';
      case 'card': return 'Card';
      case 'bank_transfer': return 'Bank Transfer';
      default: return 'Other';
    }
  };

  // Summary stats
  const totalPaid = filtered
    .filter(t => t.payment_status === 'paid')
    .reduce((sum: number, t: any) => sum + parseFloat(t.final_amount || 0), 0);
  const totalPending = filtered
    .filter(t => t.payment_status === 'unpaid' || t.payment_status === 'partial')
    .reduce((sum: number, t: any) => sum + parseFloat(t.final_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="brand-card p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-brandAccent/40 font-bold">Total Collected</div>
            <div className="text-2xl font-bold text-emerald-600 font-body">P{totalPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="p-2.5 bg-emerald-50 rounded-base"><CircleDollarSign size={20} className="text-emerald-500" /></div>
        </div>
        <div className="brand-card p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-brandAccent/40 font-bold">Outstanding</div>
            <div className="text-2xl font-bold text-amber-600 font-body">P{totalPending.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="p-2.5 bg-amber-50 rounded-base"><Receipt size={20} className="text-amber-500" /></div>
        </div>
        <div className="brand-card p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-brandAccent/40 font-bold">Transactions</div>
            <div className="text-2xl font-bold font-body">{filtered.length}</div>
          </div>
          <div className="p-2.5 bg-brandBackground rounded-base"><CreditCard size={20} className="text-brandAccent/50" /></div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="relative w-full md:w-96">
          <input
            type="text"
            placeholder="Search by client, service, or reference..."
            className="input pl-10 h-11"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brandAccent/40" size={18} />
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1.5">
            {['all', 'paid', 'partial', 'unpaid', 'refunded'].map(filter => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-pill text-[10px] font-bold uppercase tracking-widest transition-all ${statusFilter === filter ? 'bg-brandAccent text-white' : 'bg-brandBackground text-brandAccent/60 hover:bg-brandAccent/10'}`}
              >
                {filter}
              </button>
            ))}
          </div>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="input h-8 text-xs py-0 px-3 w-auto"
          >
            <option value="all">All Methods</option>
            <option value="cash">Cash</option>
            <option value="gcash">GCash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="brand-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-brandBackground/50 border-b border-brandAccent/5 text-[10px] uppercase tracking-widest font-bold text-brandAccent/40">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Service</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4">Method</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brandAccent/5">
              {filtered.length > 0 ? filtered.map((txn: any) => (
                <tr key={txn.id} className="hover:bg-brandBackground/30 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="text-sm font-bold flex items-center gap-2">
                      <Calendar size={14} className="text-brandAccent/40" />
                      {new Date(txn.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-[10px] text-brandAccent/40 mt-0.5">
                      {new Date(txn.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brandPrimary flex items-center justify-center text-brandAccent font-bold text-xs uppercase">
                        {txn.clients?.full_name?.slice(0, 2) || '??'}
                      </div>
                      <div>
                        <div className="text-sm font-bold">{txn.clients?.full_name || 'Unknown'}</div>
                        <div className="text-xs text-brandAccent/40">{txn.clients?.mobile_number || 'No mobile'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm font-medium">{txn.services?.service_name || '—'}</div>
                    {txn.discounts && (
                      <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
                        {txn.discounts.name} ({parseFloat(txn.discount_percentage).toFixed(0)}% off)
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-5 text-right">
                    {txn.discount_amount > 0 && (
                      <div className="text-[10px] text-brandAccent/40 line-through">P{parseFloat(txn.original_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                    )}
                    <div className="text-sm font-bold text-brandText">P{parseFloat(txn.final_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-brandAccent/60">
                      {getMethodIcon(txn.payment_method)}
                      <span>{formatMethodLabel(txn.payment_method)}</span>
                    </div>
                    {txn.reference_number && (
                      <div className="text-[10px] text-brandAccent/40 mt-0.5">Ref: {txn.reference_number}</div>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-pill text-[10px] font-bold uppercase tracking-widest ${getStatusColor(txn.payment_status)}`}>
                      {txn.payment_status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <Link
                      href={`/dashboard/payments/${txn.id}`}
                      className="p-2 text-brandAccent/20 hover:text-brandAccent transition-colors inline-block"
                    >
                      <ChevronRight size={20} />
                    </Link>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-brandAccent/40 italic">
                    No transactions found. <Link href="/dashboard/payments/new" className="text-brandAccent font-bold underline not-italic ml-1">Record your first payment.</Link>
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