'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Search,
  User,
  CreditCard,
  ChevronRight,
  PlusCircle,
  DollarSign,
  Percent,
  Tag,
  Banknote,
  Smartphone,
  Building2,
  Wallet,
  Receipt,
  Calendar,
  FileText
} from 'lucide-react';
import { createTransactionAction } from '@/lib/actions/transactions';
import { findPossibleClientMatches, getClientDiscount } from '@/lib/actions/clients';
import { getServices } from '@/lib/actions/services';
import { getDiscounts } from '@/lib/actions/clients';
import Link from 'next/link';

interface PaymentFormProps {
  initialClientId?: string | null;
  initialBookingId?: string | null;
  initialServiceId?: string | null;
  initialAmount?: number | null;
  clientsData?: any;
}

export default function PaymentForm({ initialClientId, initialBookingId, initialServiceId, initialAmount, clientsData }: PaymentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Data
  const [services, setServices] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);

  // Client Lookup
  const [clientSearchValue, setClientSearchValue] = useState('');
  const [exactMatch, setExactMatch] = useState<any | null>(null);
  const [nameMatches, setNameMatches] = useState<any[]>([]);
  const [searchingClient, setSearchingClient] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(clientsData || null);

  // Payment Fields
  const [selectedServiceId, setSelectedServiceId] = useState(initialServiceId || '');
  const [bookingId, setBookingId] = useState(initialBookingId || '');
  const [originalAmount, setOriginalAmount] = useState<number>(initialAmount || 0);
  const [discountId, setDiscountId] = useState<string>('');
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [finalAmount, setFinalAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [discountOverridden, setDiscountOverridden] = useState(false);

  useEffect(() => {
    async function loadData() {
      const [s, d] = await Promise.all([getServices(), getDiscounts()]);
      setServices(s);
      setDiscounts(d);
    }
    loadData();
  }, []);

  // Auto-calculate discount and final amounts
  const recalculate = useCallback((amount: number, pct: number) => {
    const dAmt = Math.round((amount * pct / 100) * 100) / 100;
    const fAmt = Math.round((amount - dAmt) * 100) / 100;
    setDiscountAmount(dAmt);
    setFinalAmount(fAmt < 0 ? 0 : fAmt);
  }, []);

  useEffect(() => {
    recalculate(originalAmount, discountPercentage);
  }, [originalAmount, discountPercentage, recalculate]);

  // Auto-load client discount when client selected
  useEffect(() => {
    if (!selectedClient || discountOverridden) return;
    async function loadClientDiscount() {
      const result = await getClientDiscount(selectedClient.id);
      if (result.isMember && result.percentage > 0) {
        setDiscountPercentage(result.percentage);
        // Find matching discount_id
        const match = discounts.find(d => d.name === result.name);
        if (match) setDiscountId(match.id);
      }
    }
    loadClientDiscount();
  }, [selectedClient, discounts, discountOverridden]);

  // Client Lookup
  useEffect(() => {
    if (clientSearchValue.length < 3 || selectedClient) {
      setExactMatch(null);
      setNameMatches([]);
      return;
    }

    const handler = setTimeout(async () => {
      setSearchingClient(true);
      try {
        const result = await findPossibleClientMatches({
          mobile: clientSearchValue.match(/^[0-9+ ]+$/) ? clientSearchValue : undefined,
          email: clientSearchValue.includes('@') ? clientSearchValue : undefined,
          name: !clientSearchValue.includes('@') && !clientSearchValue.match(/^[0-9+ ]+$/) ? clientSearchValue : undefined
        });
        setExactMatch(result.exactMatch);
        setNameMatches(result.nameMatches);
      } catch (err) {
        console.error('Client lookup error:', err);
      } finally {
        setSearchingClient(false);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [clientSearchValue, selectedClient]);

  // Service change => auto-fill amount
  const handleServiceChange = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    const service = services.find(s => s.id === serviceId);
    if (service) {
      setOriginalAmount(parseFloat(service.price));
    }
  };

  // Discount select
  const handleDiscountChange = (dId: string) => {
    setDiscountOverridden(true);
    setDiscountId(dId);
    if (dId === '' || dId === 'none') {
      setDiscountPercentage(0);
      setDiscountId('');
      return;
    }
    const disc = discounts.find(d => d.id === dId);
    if (disc) {
      setDiscountPercentage(parseFloat(disc.discount_percentage));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedClient) {
      setError('Please select a client before recording a payment.');
      return;
    }
    if (originalAmount <= 0) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await createTransactionAction({
        client_id: selectedClient.id,
        booking_id: bookingId || null,
        service_id: selectedServiceId || null,
        original_amount: originalAmount,
        discount_id: discountId || null,
        discount_percentage: discountPercentage,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        payment_method: paymentMethod as 'cash' | 'gcash' | 'card' | 'bank_transfer' | 'other',
        payment_status: paymentStatus as 'unpaid' | 'partial' | 'paid' | 'refunded',
        reference_number: referenceNumber || null,
        notes: notes || null,
      });

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/dashboard/payments';
      }, 1500);
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Unable to save payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const paymentMethodOptions = [
    { value: 'cash', label: 'Cash', icon: <Banknote size={18} /> },
    { value: 'gcash', label: 'GCash', icon: <Smartphone size={18} /> },
    { value: 'card', label: 'Card', icon: <CreditCard size={18} /> },
    { value: 'bank_transfer', label: 'Bank Transfer', icon: <Building2 size={18} /> },
    { value: 'other', label: 'Other', icon: <Wallet size={18} /> },
  ];

  return (
    <div className="space-y-10">
      {/* Client Select */}
      <div className="bg-brandBackground/30 p-6 rounded-card border border-brandAccent/10 space-y-6">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <User size={18} className="text-brandAccent" />
            <h3 className="font-bold text-sm uppercase tracking-widest text-brandAccent">Client Selection</h3>
          </div>
          {!selectedClient && (
            <Link href="/dashboard/clients/new" className="text-[10px] font-bold text-brandAccent hover:underline flex items-center gap-1">
              <PlusCircle size={12} /> Register New Client
            </Link>
          )}
        </div>

        {!selectedClient ? (
          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Lookup Client by Mobile, Email, or Name..."
                className="input pl-10 h-12 shadow-sm"
                value={clientSearchValue}
                onChange={(e) => setClientSearchValue(e.target.value)}
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-brandAccent/40">
                {searchingClient ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              </div>
            </div>

            {exactMatch && (
              <div className="p-4 bg-white border border-brandAccent/20 rounded-base flex justify-between items-center animate-in slide-in-from-top-2">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-brandAccent text-white flex items-center justify-center font-bold">
                    {exactMatch.full_name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">{exactMatch.full_name}</h4>
                    <span className="text-xs text-brandAccent/40">{exactMatch.mobile_number || 'No Mobile'}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedClient(exactMatch)}
                  className="px-4 py-1.5 bg-brandAccent text-white text-[10px] font-bold rounded-pill hover:bg-opacity-90 flex items-center gap-1"
                >
                  Select <ChevronRight size={12} />
                </button>
              </div>
            )}

            {!exactMatch && nameMatches.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-brandAccent/60 uppercase tracking-widest ml-1">Possible Matches</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {nameMatches.map(match => (
                    <div key={match.id} className="p-3 bg-white border border-brandAccent/5 rounded-base flex justify-between items-center hover:border-brandAccent/20 transition-all">
                      <div className="truncate">
                        <p className="font-bold text-xs truncate">{match.full_name}</p>
                        <p className="text-[10px] text-brandAccent/40">{match.mobile_number || 'No Mobile'}</p>
                      </div>
                      <button onClick={() => setSelectedClient(match)} className="text-[10px] font-bold text-brandAccent p-2">Select</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-5 bg-white border border-brandAccent/10 rounded-base flex items-center justify-between border-l-4 border-l-brandAccent shadow-sm">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-full bg-brandSecondary/30 text-brandAccent flex items-center justify-center font-bold text-xl">
                {selectedClient.full_name?.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h4 className="font-bold text-lg">{selectedClient.full_name}</h4>
                <div className="text-xs text-brandAccent/60 mt-0.5">
                  {selectedClient.mobile_number || 'No Mobile'} &bull; {selectedClient.email || 'No Email'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setSelectedClient(null); setDiscountOverridden(false); setDiscountPercentage(0); setDiscountId(''); }}
              className="text-[10px] font-bold text-red-500/60 hover:text-red-500 uppercase tracking-widest"
            >
              Change
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-base flex items-center gap-3 text-red-600 text-sm font-bold animate-shake">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-base flex items-center gap-3 text-emerald-700 text-sm font-bold animate-in fade-in">
          <CheckCircle2 size={18} />
          Payment recorded successfully! Redirecting...
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Column 1: Service & Amount */}
          <div className="space-y-10">
            <div className="border-l-4 border-brandAccent pl-5">
              <h3 className="brand-heading text-2xl">Payment Details</h3>
              <p className="text-xs text-brandAccent/60 mt-1 uppercase tracking-wider font-medium">Service & Pricing</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="label">Service (Optional)</label>
                <select
                  value={selectedServiceId}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  className="input h-14"
                >
                  <option value="">No Service / General Payment</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.service_name} — P{s.price}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="label">Original Amount (PHP) *</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={originalAmount || ''}
                    onChange={(e) => setOriginalAmount(parseFloat(e.target.value) || 0)}
                    className="input h-14 pl-10"
                    placeholder="0.00"
                    required
                  />
                  <DollarSign size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-brandAccent/40" />
                </div>
              </div>

              {/* Discount Section */}
              <div className="p-5 bg-brandBackground/30 rounded-base border border-brandAccent/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-brandAccent uppercase tracking-widest">
                    <Percent size={14} />
                    Discount
                  </div>
                  {discountPercentage > 0 && !discountOverridden && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-pill font-bold">Auto-Applied</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="label text-[10px]">Discount Program</label>
                    <select
                      value={discountId}
                      onChange={(e) => handleDiscountChange(e.target.value)}
                      className="input h-12 text-sm"
                    >
                      <option value="">No Discount</option>
                      {discounts.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({parseFloat(d.discount_percentage).toFixed(0)}%)</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="label text-[10px]">Override %</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={discountPercentage}
                      onChange={(e) => { setDiscountOverridden(true); setDiscountPercentage(parseFloat(e.target.value) || 0); }}
                      className="input h-12 text-sm"
                    />
                  </div>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-base border border-emerald-100 text-sm animate-in fade-in">
                    <span className="text-emerald-700 font-medium">Discount Applied</span>
                    <span className="text-emerald-700 font-bold">-P{discountAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>

              {/* Final Amount Display */}
              <div className="p-6 bg-brandAccent text-white rounded-base text-center space-y-2">
                <div className="text-[10px] uppercase tracking-widest font-bold opacity-60">Amount Due</div>
                <div className="text-4xl font-body font-bold">P{finalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          {/* Column 2: Method & Status */}
          <div className="space-y-10">
            <div className="border-l-4 border-brandAccent pl-5">
              <h3 className="brand-heading text-2xl">Settlement</h3>
              <p className="text-xs text-brandAccent/60 mt-1 uppercase tracking-wider font-medium">Method & Status</p>
            </div>

            <div className="space-y-6">
              {/* Payment Method Grid */}
              <div className="space-y-2">
                <label className="label">Payment Method *</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {paymentMethodOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPaymentMethod(opt.value)}
                      className={`p-4 rounded-base border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === opt.value
                          ? 'border-brandAccent bg-brandAccent/5 text-brandAccent shadow-sm'
                          : 'border-brandAccent/10 text-brandAccent/40 hover:border-brandAccent/30'
                        }`}
                    >
                      {opt.icon}
                      <span className="text-xs font-bold uppercase tracking-widest">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Status */}
              <div className="space-y-2">
                <label className="label">Payment Status</label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="input h-14"
                >
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>

              {/* Reference Number */}
              <div className="space-y-2">
                <label className="label">Reference Number (Optional)</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="input h-14"
                  placeholder="GCash ref, receipt #, etc..."
                />
              </div>

              {/* Booking ID */}
              <div className="space-y-2">
                <label className="label">Linked Booking ID (Optional)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={bookingId}
                    onChange={(e) => setBookingId(e.target.value)}
                    className="input h-14 pl-10"
                    placeholder="Paste booking UUID..."
                  />
                  <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-brandAccent/40" />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="label">Internal Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input min-h-[120px] resize-none py-4"
                  placeholder="Payment remarks, tips, special conditions..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-end gap-5 border-t border-brandAccent/10 pt-12">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="px-10 h-16 text-brandAccent/60 font-bold hover:text-brandAccent transition-all uppercase tracking-widest text-xs"
          >
            Discard
          </button>
          <button
            type="submit"
            disabled={loading || !selectedClient}
            className="btn-primary h-16 min-w-[280px] flex items-center justify-center gap-4 group"
          >
            {loading ? <Loader2 size={24} className="animate-spin" /> : <Receipt size={24} className="group-hover:rotate-12 transition-transform" />}
            <span className="uppercase tracking-widest text-sm font-bold">Record Payment</span>
          </button>
        </div>
      </form>
    </div>
  );
}