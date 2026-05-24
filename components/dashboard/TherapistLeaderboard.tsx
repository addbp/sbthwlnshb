import { TherapistStat } from '@/lib/actions/sales';
import { Crown, User } from 'lucide-react';

interface Props {
  therapistStats: TherapistStat[];
}

export default function TherapistLeaderboard({ therapistStats }: Props) {
  const fmt = (n: number) =>
    `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const top = therapistStats[0];
  const topRevenue = top?.net_sales ?? 0;
  if (therapistStats.length === 0) {
    return (
      <div className="brand-card flex items-center justify-center h-48">
        <p className="text-[10px] uppercase tracking-widest font-bold text-brandAccent/30">
          No therapist data for this period
        </p>
      </div>
    );
  }
  return (
    <div className="brand-card space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="brand-heading text-lg">Therapist Leaderboard</h2>
          <p className="text-[10px] uppercase tracking-widest text-brandAccent/40 font-bold">Ranked by net revenue</p>
        </div>
        <div className="p-2 bg-brandAccent/10 rounded-base">
          <Crown size={18} className="text-brandAccent" />
        </div>
      </div>
      <div className="space-y-2">
        {therapistStats.map((stat, i) => {
          const share = topRevenue > 0 ? (stat.net_sales / topRevenue) * 100 : 0;
          const isFirst = i === 0;
          return (
            <div key={stat.therapist_name} className={`flex items-center gap-3 p-3 rounded-base transition-colors ${isFirst ? 'bg-brandAccent/10 border border-brandAccent/20' : 'hover:bg-brandPrimary/40'}`}>
              <span className={`w-5 text-center text-[10px] font-bold shrink-0 ${isFirst ? 'text-brandAccent' : 'text-brandAccent/30'}`}>
                {isFirst ? <Crown size={14} className="text-brandAccent mx-auto" /> : i + 1}
              </span>
              <div className="w-7 h-7 rounded-full bg-brandPrimary border border-brandAccent/20 flex items-center justify-center shrink-0">
                <User size={13} className="text-brandAccent/60" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-brandAccent truncate">{stat.therapist_name}</span>
                  <span className="text-xs font-bold text-brandAccent shrink-0">{fmt(stat.net_sales)}</span>
                </div>
                <div className="h-1 w-full bg-brandPrimary/60 rounded-full overflow-hidden">
                  <div className="h-full bg-brandAccent/70 rounded-full transition-all duration-500" style={{ width: `${share.toFixed(1)}%` }} />
                </div>
                <span className="text-[9px] text-brandAccent/40 font-medium">{stat.booking_count} {stat.booking_count === 1 ? 'booking' : 'bookings'} · gross {fmt(stat.gross_sales)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
