'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  User, 
  Phone, 
  Mail, 
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  CreditCard,
  Percent,
  Sparkles
} from 'lucide-react';
import { createClientAction, updateClientAction, findPossibleClientMatches, getDiscounts } from '@/lib/actions/clients';
import Link from 'next/link';

interface ClientFormProps {
  initialData?: any;
  id?: string;
}

export default function ClientForm({ initialData, id }: ClientFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [lookupValue, setLookupValue] = useState('');
  const [exactMatch, setExactMatch] = useState<any | null>(null);
  const [nameMatches, setNameMatches] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [selectedDiscountId, setSelectedDiscountId] = useState(initialData?.discount_id || 'none');
  const [formFields, setFormFields] = useState({
    full_name: initialData?.full_name || '',
    mobile_number: initialData?.mobile_number || '',
    email: initialData?.email || ''
  });

  useEffect(() => {
    async function loadDiscounts() {
      const data = await getDiscounts();
      setDiscounts(data);
    }
    loadDiscounts();
  }, []);

  useEffect(() => {
    if (id || lookupValue.length < 3) {
      setExactMatch(null);
      setNameMatches([]);
      return;
    }
    const handler = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await findPossibleClientMatches({ 
          mobile: lookupValue.match(/^[0-9+ ]+$/) ? lookupValue : undefined,
          email: lookupValue.includes('@') ? lookupValue : undefined,
          name: !lookupValue.includes('@') && !lookupValue.match(/^[0-9+ ]+$/) ? lookupValue : undefined
        });
        setExactMatch(result.exactMatch);
        setNameMatches(result.nameMatches);
      } catch (err) {
        console.error('Lookup failed:', err);
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [lookupValue, id]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('[ClientForm] Submit started');
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const rawData = Object.fromEntries(formData.entries());
    console.log('[ClientForm] Raw data collected:', { ...rawData, email: rawData.email ? 'EXISTS' : 'NONE' });

    try {
      const result = id 
        ? await updateClientAction(id, rawData as any)
        : await createClientAction(rawData as any);

      console.log('[ClientForm] Server action response:', result);

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard/clients');
        router.refresh();
      }, 1500);
    } catch (err: any) {
      console.error('[ClientForm] Critical catch:', err);
      setError('A connection error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormFields({ ...formFields, [e.target.name]: e.target.value });
  };

  const selectedDiscount = discounts.find(d => d.id === selectedDiscountId);

  return (
    <div className="space-y-10">
      {!id && (
        <div className="bg-brandBackground/30 p-6 rounded-card border border-brandAccent/10 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Search size={18} className="text-brandAccent" />
            <h3 className="font-bold text-sm uppercase tracking-widest text-brandAccent">Client Recognition</h3>
          </div>
          <div className="relative">
            <input type="text" placeholder="Search..." className="input pl-10 h-12 shadow-sm" value={lookupValue} onChange={(e) => setLookupValue(e.target.value)} />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-brandAccent/40">
              {searching ? <Loader2 size={18} className="animate-spin" /> : <User size={18} />}
            </div>
          </div>
          {exactMatch && (
            <div className="p-5 bg-amber-50 border border-amber-200 rounded-base">
              <div className="flex items-center gap-3 text-amber-800 mb-3 font-bold text-sm">
                <ShieldAlert size={20} /> Existing Client Found
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-amber-200/50 flex items-center justify-center text-amber-700">
                    <User size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900">{exactMatch.full_name}</h4>
                    <span className="text-xs text-amber-700/70">{exactMatch.mobile_number || 'No Mobile'}</span>
                  </div>
                </div>
                <Link href={`/dashboard/clients/${exactMatch.id}`} className="px-6 py-2 bg-amber-200 text-amber-900 text-xs font-bold rounded-pill hover:bg-amber-300 transition-all flex items-center gap-2">
                  Use Profile <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-base flex items-center gap-3 text-red-600 text-sm font-bold animate-shake">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-base flex items-center gap-3 text-emerald-700 text-sm font-bold">
          <CheckCircle2 size={18} /> Client record saved! Redirecting...
        </div>
      )}

      <form onSubmit={handleSubmit} className={`space-y-12 ${exactMatch && !id ? 'opacity-30 pointer-events-none' : ''}`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          <div className="space-y-10">
            <div className="border-l-4 border-brandAccent pl-5">
              <h3 className="brand-heading text-2xl">Identity & Reach</h3>
              <p className="text-xs text-brandAccent/60 mt-1 uppercase tracking-wider font-medium">Core Recognition Data</p>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="label">Full Name *</label>
                <input name="full_name" required defaultValue={initialData?.full_name} className="input h-14 text-lg" placeholder="Legal Name" onChange={handleFieldChange} />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="label">Gender</label>
                  <select name="gender" defaultValue={initialData?.gender || 'female'} className="input h-14">
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="label">Birthday</label>
                  <input name="birthday" type="date" defaultValue={initialData?.birthday} className="input h-14" />
                </div>
              </div>
              <div className="space-y-2 mt-8">
                <label className="label">Mobile Number</label>
                <input name="mobile_number" defaultValue={initialData?.mobile_number} className="input h-14" placeholder="09XX XXX XXXX" onChange={handleFieldChange} />
              </div>
              <div className="space-y-2">
                <label className="label">Email Address (Optional)</label>
                <input name="email" type="email" defaultValue={initialData?.email} className="input h-14" placeholder="client@email.com" onChange={handleFieldChange} />
              </div>
            </div>
          </div>

          <div className="space-y-10">
            <div className="border-l-4 border-brandAccent pl-5">
              <h3 className="brand-heading text-2xl">Wellness Profile</h3>
              <p className="text-xs text-brandAccent/60 mt-1 uppercase tracking-wider font-medium">Internal Classifications</p>
            </div>
            <div className="space-y-6">
              <div className="bg-brandPrimary/30 p-6 rounded-card border border-brandAccent/10 space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard size={18} className="text-brandAccent" />
                  <h4 className="font-bold text-xs uppercase tracking-widest text-brandAccent">Membership & Rewards</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="label">Client Classification</label>
                    <select name="client_type" defaultValue={initialData?.client_type || 'regular'} className="input h-12 bg-white">
                      <option value="first_time">First Time</option>
                      <option value="returning">Returning</option>
                      <option value="regular">Regular</option>
                      <option value="member">Member</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="label">Applied Discount</label>
                    <select name="discount_id" value={selectedDiscountId} onChange={(e) => setSelectedDiscountId(e.target.value)} className="input h-12 bg-white pr-10">
                      <option value="none">None / Non-member</option>
                      {discounts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="label">Anniversary (Optional)</label>
                <input name="anniversary" type="date" defaultValue={initialData?.anniversary} className="input h-14" />
              </div>
              <div className="space-y-2">
                <label className="label">Operational Notes</label>
                <textarea name="notes" defaultValue={initialData?.notes} className="input min-h-[140px] resize-none py-4" placeholder="Conditions, preferences..." />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-5 border-t border-brandAccent/10 pt-12">
          <button type="button" onClick={() => router.back()} className="px-10 h-16 text-brandAccent/60 font-bold uppercase tracking-widest text-xs">Cancel</button>
          <button type="submit" disabled={loading || (exactMatch && !id)} className="btn-primary h-16 min-w-[280px] flex items-center justify-center gap-4 group">
            {loading ? <Loader2 size={24} className="animate-spin" /> : <CheckCircle2 size={24} />}
            <span className="uppercase tracking-widest text-sm font-bold">Register Client Record</span>
          </button>
        </div>
      </form>
    </div>
  );
}
