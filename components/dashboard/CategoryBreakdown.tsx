import { CategorySales } from '@/lib/actions/sales';
import { Scissors, TrendingDown } from 'lucide-react';

interface Props {
  breakdown: CategorySales[];
  totalCommission: number;
}

export default function CategoryBreakdown({ breakdown, totalCommission }: Props) {
  const fmt = (n: number) =>
    `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pct = (rate: number) => `${(rate * 100).toFixed(0)}%`;
  const totalRevenue = breakdown.reduce((sum, row) => sum + row.revenue, 0);
  if (breakdown.length === 0) {
    return (
      <div className="brand-card flex items-center justify-center h-48">
        <p className="text-[10px] uppercase tracking-widest font-bold text-brandAccent/30">
          No category data for this period
        </p>
      </div>
    );
  }
  return (
    <div className="brand-card space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="brand-heading text-lg">Category Breakdown</h2>
          <p className="text-[10px] uppercase tracking-widest text-brandAccent/40 font-bold">
            Revenue by service category
          </p>
        </div>
        <div className="p-2 bg-amber-500/10 rounded-base">
          <TrendingDown size={18} className="text-amber-600" />
        </div>
      </div>
      <div className="space-y-4">
        {breakdown.map((row) => {
          const share = totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0;
          return (
            <div key={row.category} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scissors size={12} className="text-brandAccent/40 shrink-0" />
                  <span className="text-xs font-bold text-brandAccent uppercase tracking-wider">{row.category}</span>
                  <span className="text-[9px] font-bold text-brandAccent/30 uppercase tracking-widest">{row.booking_count} bookings</span>
                </div>
                <span className="text-xs font-bold text-brandAccent">{fmt(row.revenue)}</span>
              </div>
              <div className="h-1.5 w-full bg-brandPrimary/60 rounded-full overflow-hidden">
                <div className="h-full bg-brandAccent rounded-full transition-all duration-500" style={{ width: `${share.toFixed(1)}%` }} />
              </div>
              <div className="flex items-center justify-between text-[9px] font-medium text-brandAccent/40">
                <span>{share.toFixed(0)}% of revenue</span>
                <span className="text-amber-600 font-bold">Commission {pct(row.commissionRate)} = {fmt(row.commission)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-base">
        <span className="text-[9px] font-bold uppercase tracking-widest text-amber-700">Total Commission Owed</span>
        <span className="text-sm font-bold text-amber-700">{fmt(totalCommission)}</span>
      </div>
    </div>
  );
}
