'use client';

import { useState, useEffect } from 'react';
import { Search, UserPlus, MoreVertical, Phone, Mail } from 'lucide-react';
import Link from 'next/link';
import { getClients } from '@/lib/actions/clients';

export default function ClientList() {
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await getClients(search);
        setClients(data || []);
      } catch (err) {
        console.error('Fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetch, 300);
    return () => clearTimeout(timeoutId);
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brandAccent/30" size={18} />
          <input 
            type="text" 
            placeholder="Search by name, mobile, or email..." 
            className="input pl-11"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Link href="/dashboard/clients/new" className="btn-primary flex items-center inline-flex">
          <UserPlus size={18} className="mr-2" />
          <span>Add Client</span>
        </Link>
      </div>

      <div className="brand-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-brandAccent/10 text-[10px] uppercase tracking-widest font-bold text-brandAccent/40">
                <th className="p-4 text-left">Client Info</th>
                <th className="p-4 text-left">Contact</th>
                <th className="p-4 text-left">Type/Membership</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-4"><div className="h-4 bg-gray-100 rounded w-32"></div></td>
                    <td className="p-4"><div className="h-4 bg-gray-100 rounded w-40"></div></td>
                    <td className="p-4"><div className="h-4 bg-gray-100 rounded w-24"></div></td>
                    <td className="p-4"></td>
                  </tr>
                ))
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-brandAccent/40">
                    No clients found matching your search.
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="border-t border-brandAccent/5 hover:bg-brandBackground/10 transition-colors">
                    <td className="p-4">
                      <Link href={`/dashboard/clients/${client.id}`} className="font-semibold text-brandAccent hover:underline">
                        {client.full_name}
                      </Link>
                      <div className="text-[10px] text-brandAccent/40 uppercase tracking-wider">{client.gender || 'N/A'}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone size={13} className="text-brandAccent/40" />
                        {client.mobile_number}
                      </div>
                      {client.email && (
                        <div className="flex items-center gap-2 text-xs text-brandAccent/60">
                          <Mail size={13} className="text-brandAccent/40" />
                          {client.email}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center bg-brandAccent/5 text-brandAccent/70 px-2.5 py-0.5 rounded-pill text-[9px] font-semibold">
                        {client.client_type || 'Regular'}
                      </span>
                      <div className="text-[10px] text-brandAccent/50 mt-0.5">{client.membership_type || 'No Membership'}</div>
                    </td>
                    <td className="p-4 text-right">
                      <Link href={`/dashboard/clients/${client.id}`} className="inline-flex items-center gap-1.5 text-[10px] font-bold text-brandAccent/40 hover:text-brandAccent uppercase tracking-widest transition-all">
                        View Profile
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
