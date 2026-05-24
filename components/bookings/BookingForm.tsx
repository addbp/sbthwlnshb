'use client';

import { useState, useEffect } from 'react';
import {
  Loader2, AlertCircle, CheckCircle2, Search, User,
  Clock, Tag, ChevronRight, PlusCircle, DollarSign,
} from 'lucide-react';
import { createBookingAction, updateBookingAction } from '@/lib/actions/bookings';
import { findPossibleClientMatches } from '@/lib/actions/clients';
import { getServices } from '@/lib/actions/services';
import { getTherapists } from '@/lib/actions/therapists';
import { getProducts, addBookingProducts, getBookingProducts } from '@/lib/actions/products';
import ProductSelector, { CartItem } from '@/components/bookings/ProductSelector';
import Link from 'next/link';

interface BookingFormProps {
  initialData?: any;
  id?: string;
}

export default function BookingForm({ initialData, id }: BookingFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [services, setServices] = useState<any[]>([]);
  const [therapists, setTherapists] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const [clientSearchValue, setClientSearchValue] = useState('');
  const [exactMatch, setExactMatch] = useState<any | null>(null);
  const [nameMatches, setNameMatches] = useState<any[]>([]);
  const [searchingClient, setSearchingClient] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(initialData?.clients || null);

  const [selectedServiceId, setSelectedServiceId] = useState(initialData?.service_id || '');
  const [selectedTherapistId, setSelectedTherapistId] = useState(initialData?.therapist_id || '');
  const [duration, setDuration] = useState(initialData?.duration_minutes || 60);

  const selectedService = services.find(s => s.id === selectedServiceId);
  const serviceTotal = selectedService ? Number(selectedService.price) : 0;
  const cartTotal = cartItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const grandTotal = serviceTotal + cartTotal;
  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  useEffect(() => {
    async function loadData() {
      const [s, t, p] = await Promise.all([getServices(), getTherapists(), getProducts()]);
      setServices(s);
      setTherapists(t);
      setProducts(p);
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!id) return;
    async function loadBookingProducts() {
      try {
        const existing = await getBookingProducts(id!);
        if (existing && existing.length > 0) {
          const mapped: CartItem[] = existing.map((bp: any) => ({
            product_id: bp.products?.id ?? bp.product_id,
            name: bp.products?.name ?? 'Unknown',
            unit_price: Number(bp.unit_price),
            quantity: bp.quantity,
          }));
          setCartItems(mapped);
        }
      } catch (err) {
        console.log('[BookingForm] failed to load booking_products:', err);
      }
    }
    loadBookingProducts();
  }, [id]);

  useEffect(() => {
    if (id || clientSearchValue.length < 3 || selectedClient) {
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
          name: !clientSearchValue.includes('@') && !clientSearchValue.match(/^[0-9+ ]+$/) ? clientSearchValue : undefined,
        });
        setExactMatch(result.exactMatch);
        setNameMatches(result.nameMatches);
      } catch (err) {
        console.log('[BookingForm] client lookup error:', err);
      } finally {
        setSearchingClient(false);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [clientSearchValue, id, selectedClient]);

  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const serviceId = e.target.value;
    setSelectedServiceId(serviceId);
    const service = services.find(s => s.id === serviceId);
    if (service) setDuration(service.duration_minutes);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedClient && !id) {
      setError('Please select or create a client for this booking.');
      return;
    }
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      client_id: selectedClient?.id ?? initialData?.client_id ?? null,
      service_id: formData.get('service_id') || null,
      therapist_id: formData.get('therapist_id') || null,
      booking_date: formData.get('booking_date') as string,
      booking_time: formData.get('booking_time') as string,
      duration_minutes: parseInt(formData.get('duration_minutes') as string) || 60,
      booking_source: formData.get('booking_source') as string,
      booking_status: formData.get('booking_status') as string,
      payment_status: formData.get('payment_status') as string,
      notes: formData.get('notes') as string || null,
      total_amount: grandTotal > 0 ? grandTotal : null,
    };

    try {
      let bookingId: string;

      if (id) {
        const result = await updateBookingAction(id, data as any);
        if (result.error) throw new Error(result.error);
        bookingId = id;
      } else {
        const result = await createBookingAction(data as any);
        if (result.error) throw new Error(result.error);
        bookingId = result.data.id;
      }

      if (cartItems.length > 0) {
        await addBookingProducts(bookingId, cartItems);
      }

      setSuccess(true);
      setTimeout(() => { window.location.href = '/dashboard/bookings'; }, 1500);
    } catch (err: any) {
      console.log('[BookingForm] submit error:', err);
      setError(err.message || 'Unable to save booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Client Selection */}
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
                <button type="button" onClick={() => setSelectedClient(exactMatch)}
                  className="px-4 py-1.5 bg-brandAccent text-white text-[10px] font-bold rounded-pill hover:bg-opacity-90 flex items-center gap-1">
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
                      <button type="button" onClick={() => setSelectedClient(match)} className="text-[10px] font-bold text-brandAccent p-2">Select</button>
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
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-lg">{selectedClient.full_name}</h4>
                  {selectedClient.discounts && (
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-pill uppercase tracking-tighter">
                      {selectedClient.discounts.name} ({parseFloat(selectedClient.discounts.discount_percentage).toFixed(0)}%)
                    </span>
                  )}
                </div>
                <div className="text-xs text-brandAccent/60 mt-0.5">
                  {selectedClient.mobile_number || 'No Mobile'} · {selectedClient.email || 'No Email'}
                </div>
              </div>
            </div>
            <button type="button" onClick={() => setSelectedClient(null)}
              className="text-[10px] font-bold text-red-500/60 hover:text-red-500 uppercase tracking-widest">
              Change
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-base flex items-center gap-3 text-red-600 text-sm font-bold">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-base flex items-center gap-3 text-emerald-700 text-sm font-bold animate-in fade-in">
          <CheckCircle2 size={18} /> Booking successfully recorded! Redirecting...
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">

          {/* Column 1: Service & Products */}
          <div className="space-y-10">
            <div className="border-l-4 border-brandAccent pl-5">
              <h3 className="brand-heading text-2xl">Service Details</h3>
              <p className="text-xs text-brandAccent/60 mt-1 uppercase tracking-wider font-medium">Session Preferences</p>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="label">Select Service *</label>
                <select name="service_id" required value={selectedServiceId} onChange={handleServiceChange} className="input h-14">
                  <option value="">Choose a Service...</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.service_name} — ₱{s.price}</option>
                  ))}
                </select>
              </div>

              {selectedService && (
                <div className="p-4 bg-brandPrimary/30 rounded-base border border-brandAccent/10 animate-in fade-in">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-xs font-bold text-brandAccent">
                      <Clock size={14} /> Duration: {selectedService.duration_minutes}m
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
                      <DollarSign size={14} /> {fmt(serviceTotal)}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="label">Therapist (Optional)</label>
                <select name="therapist_id" defaultValue={selectedTherapistId} className="input h-14">
                  <option value="">Any Available Therapist</option>
                  {therapists.map(t => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="label">Duration (Minutes)</label>
                  <input name="duration_minutes" type="number" value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))} className="input h-14" required />
                </div>
                <div className="space-y-2">
                  <label className="label">Booking Source</label>
                  <select name="booking_source" defaultValue={initialData?.booking_source || 'admin'} className="input h-14">
                    <option value="admin">Admin Panel</option>
                    <option value="walk_in">Walk-in</option>
                    <option value="phone">Phone Call</option>
                    <option value="facebook">Facebook/Meta</option>
                    <option value="website">Website</option>
                  </select>
                </div>
              </div>

              {/* Food & Drinks — linked to booking_products */}
              <div className="p-5 bg-brandBackground/30 rounded-card border border-brandAccent/10 space-y-4">
                <ProductSelector products={products} initialItems={cartItems} onChange={setCartItems} />
                {cartItems.length > 0 && (
                  <div className="pt-2 border-t border-brandAccent/10 flex justify-between items-center text-xs font-bold text-brandAccent/70">
                    <span>Food &amp; Drinks Subtotal</span>
                    <span>{fmt(cartTotal)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Schedule & Status */}
          <div className="space-y-10">
            <div className="border-l-4 border-brandAccent pl-5">
              <h3 className="brand-heading text-2xl">Scheduling</h3>
              <p className="text-xs text-brandAccent/60 mt-1 uppercase tracking-wider font-medium">Timing &amp; Logistics</p>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="label">Booking Date *</label>
                  <input name="booking_date" type="date" required
                    defaultValue={initialData?.booking_date || new Date().toISOString().split('T')[0]}
                    className="input h-14" />
                </div>
                <div className="space-y-2">
                  <label className="label">Start Time *</label>
                  <input name="booking_time" type="time" required
                    defaultValue={initialData?.booking_time?.slice(0, 5)} className="input h-14" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="label">Booking Status</label>
                  <select name="booking_status" defaultValue={initialData?.booking_status || 'pending'} className="input h-14">
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="checked_in">Checked In</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="no_show">No Show</option>
                    <option value="rescheduled">Rescheduled</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="label">Payment Status</label>
                  <select name="payment_status" defaultValue={initialData?.payment_status || 'unpaid'} className="input h-14">
                    <option value="unpaid">Unpaid</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="label">Internal Notes</label>
                <textarea name="notes" defaultValue={initialData?.notes}
                  className="input min-h-[120px] resize-none py-4"
                  placeholder="Special requests, member preferences, or accessibility needs..." />
              </div>

              {/* Live Bill Summary — always visible */}
              <div className="p-5 bg-brandAccent/5 border border-brandAccent/10 rounded-base space-y-3 animate-in fade-in">
                <div className="text-[10px] uppercase tracking-widest font-bold text-brandAccent/50">Live Bill Summary</div>

                {selectedService ? (
                  <div className="flex justify-between text-xs font-bold text-brandAccent">
                    <span>{selectedService.service_name}</span>
                    <span>{fmt(serviceTotal)}</span>
                  </div>
                ) : (
                  <div className="text-xs text-brandAccent/30 italic">No service selected</div>
                )}

                {cartItems.map(item => (
                  <div key={item.product_id} className="flex justify-between text-xs text-brandAccent/70">
                    <span>{item.name} ×{item.quantity}</span>
                    <span>{fmt(item.unit_price * item.quantity)}</span>
                  </div>
                ))}

                <div className="border-t border-brandAccent/10 pt-3 flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-widest text-brandAccent">Grand Total</span>
                  <span className="text-lg font-bold text-brandAccent">{fmt(grandTotal)}</span>
                </div>
                <p className="text-[10px] text-brandAccent/30 italic">
                  This total is saved to the booking automatically on submit.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-end gap-5 border-t border-brandAccent/10 pt-12">
          <button type="button" onClick={() => window.history.back()}
            className="px-10 h-16 text-brandAccent/60 font-bold hover:text-brandAccent transition-all uppercase tracking-widest text-xs">
            Discard Changes
          </button>
          <button type="submit" disabled={loading || (!selectedClient && !id)}
            className="btn-primary h-16 min-w-[280px] flex items-center justify-center gap-4 group">
            {loading
              ? <Loader2 size={24} className="animate-spin" />
              : <Tag size={24} className="group-hover:rotate-12 transition-transform" />}
            <span className="uppercase tracking-widest text-sm font-bold">
              {id ? 'Update Booking' : 'Finalize Reservation'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}