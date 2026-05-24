'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Calendar, 
  Search, 
  Filter, 
  ExternalLink, 
  Clock, 
  User, 
  CheckCircle2, 
  AlertCircle,
  MoreVertical,
  ChevronRight,
  CreditCard,
  Sparkles
} from 'lucide-react';

interface BookingListProps {
  initialBookings: any[];
}

export default function BookingList({ initialBookings }: BookingListProps) {
  const [bookings, setBookings] = useState(initialBookings);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = 
      booking.clients?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.services?.service_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.clients?.mobile_number?.includes(searchTerm);
    
    if (activeFilter === 'all') return matchesSearch;
    return matchesSearch && booking.booking_status === activeFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/10 text-emerald-600';
      case 'pending': return 'bg-amber-500/10 text-amber-600';
      case 'confirmed': return 'bg-blue-500/10 text-blue-600';
      case 'checked_in': return 'bg-purple-500/10 text-purple-600';
      case 'in_progress': return 'bg-indigo-500/10 text-indigo-600';
      case 'cancelled': return 'bg-red-500/10 text-red-600';
      default: return 'bg-brandAccent/10 text-brandAccent/60';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="relative w-full md:w-96">
          <input 
            type="text" 
            placeholder="Search by client, service, or mobile..." 
            className="input pl-10 h-11"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brandAccent/40" size={18} />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-1 w-full md:w-auto">
          {['all', 'pending', 'confirmed', 'checked_in', 'completed', 'cancelled'].map(filter => (
            <button 
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 rounded-pill text-[10px] font-bold uppercase tracking-widest transition-all ${activeFilter === filter ? 'bg-brandAccent text-white' : 'bg-brandBackground text-brandAccent/60 hover:bg-brandAccent/10'}`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="brand-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-brandAccent/10 text-[10px] uppercase tracking-widest font-bold text-brandAccent/40">
                <th className="px-6 py-4">Booking Info</th>
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Service & Staff</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Payment</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brandAccent/5">
              {filteredBookings.length > 0 ? filteredBookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-brandBackground/30 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="text-sm font-semibold flex items-center gap-2">
                       <Calendar size={14} className="text-brandAccent/40" />
                       {new Date(booking.booking_date).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-brandAccent/40 flex items-center gap-2 mt-0.5">
                       <Clock size={12} /> {booking.booking_time?.slice(0, 5)} • {booking.duration_minutes}m
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brandPrimary flex items-center justify-center text-brandAccent font-bold text-xs uppercase">
                        {booking.clients?.full_name?.slice(0, 2) || '??'}
                      </div>
                      <div>
                        <div className="text-sm font-semibold flex items-center gap-2">
                          {booking.clients?.full_name}
                          {booking.clients?.discounts && <Sparkles size={12} className="text-brandAccent" />}
                        </div>
                        <div className="text-xs text-brandAccent/40">{booking.clients?.mobile_number || 'No mobile'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm font-medium">{booking.services?.service_name}</div>
                    <div className="text-[10px] text-brandAccent/40 flex items-center gap-1 mt-0.5 uppercase tracking-tighter">
                      <User size={10} /> {booking.profiles?.full_name || 'Staff Not Assigned'}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-2.5 py-0.5 rounded-pill text-[9px] font-bold uppercase tracking-wider ${getStatusColor(booking.booking_status)}`}>
                      {booking.booking_status}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                     <div className="flex items-center gap-1.5 text-xs font-medium text-brandAccent/60">
                       <CreditCard size={14} className="text-brandAccent/30" />
                       <span className="capitalize">{booking.payment_status}</span>
                     </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <Link 
                      href={`/dashboard/bookings/${booking.id}`} 
                      className="p-2 text-brandAccent/20 hover:text-brandAccent transition-colors inline-block"
                    >
                      <ChevronRight size={20} />
                    </Link>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-brandAccent/40 italic">
                    No bookings found. <Link href="/dashboard/bookings/new" className="text-brandAccent font-bold underline not-italic ml-1">Create your first booking.</Link>
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
