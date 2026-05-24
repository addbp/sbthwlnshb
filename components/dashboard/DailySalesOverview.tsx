import { getDailySalesOverview } from '@/lib/actions/sales';
import { TrendingUp, TrendingDown, Minus, ShoppingBag, Scissors } from 'lucide-react';

interface Props {
    date?: string;
}

export default async function DailySalesOverview({ date }: Props) {
    const sales = await getDailySalesOverview(date);

    const fmt = (n: number) =>
        `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const pct = (rate: number) => `${(rate * 100).toFixed(0)}%`;

    return (
        <div className="brand-card space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <h2 className="brand-heading text-xl">Daily Sales Overview</h2>
                    <p className="text-[10px] uppercase tracking-widest text-brandAccent/50 font-bold">
                        {new Date(sales.date + 'T00:00:00').toLocaleDateString('en-PH', {
                            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                        })}
                    </p>
                </div>
                <div className="p-2 bg-emerald-500/10 rounded-base">
                    <TrendingUp size={20} className="text-emerald-600" />
                </div>
            </div>

            {/* Top 3 KPI Cards */}
            <div className="grid grid-cols-3 gap-4">
                <KpiCard
                    label="Gross Sales"
                    value={fmt(sales.grossTotal)}
                    sub={`Services ${fmt(sales.grossServices)} · F&B ${fmt(sales.grossProducts)}`}
                    color="blue"
                />
                <KpiCard
                    label="Total Commission"
                    value={fmt(sales.totalCommission)}
                    sub="Owed to therapists"
                    color="amber"
                    icon={<TrendingDown size={14} className="text-amber-500" />}
                />
                <KpiCard
                    label="Net Sales"
                    value={fmt(sales.netTotal)}
                    sub="After commission"
                    color="emerald"
                    icon={<TrendingUp size={14} className="text-emerald-500" />}
                />
            </div>

            {/* Category Breakdown */}
            {sales.breakdown.length > 0 && (
                <div className="space-y-2">
                    <div className="text-[10px] uppercase tracking-widest font-bold text-brandAccent/50 px-1">
                        Commission Breakdown by Category
                    </div>
                    <div className="divide-y divide-brandAccent/5 border border-brandAccent/10 rounded-base overflow-hidden">
                        {/* Table header */}
                        <div className="grid grid-cols-4 px-4 py-2 bg-brandBackground/50">
                            {['Category', 'Revenue', 'Rate', 'Commission'].map(h => (
                                <span key={h} className="text-[9px] uppercase tracking-widest font-bold text-brandAccent/40">
                                    {h}
                                </span>
                            ))}
                        </div>
                        {/* Rows */}
                        {sales.breakdown.map(row => (
                            <div key={row.category} className="grid grid-cols-4 px-4 py-3 hover:bg-brandBackground/30 transition-colors">
                                <div className="flex items-center gap-2">
                                    <Scissors size={12} className="text-brandAccent/30 shrink-0" />
                                    <span className="text-xs font-bold text-brandAccent truncate">{row.category}</span>
                                </div>
                                <span className="text-xs font-bold text-brandAccent">{fmt(row.revenue)}</span>
                                <span className="text-xs font-medium text-amber-600">{pct(row.commissionRate)}</span>
                                <span className="text-xs font-bold text-red-500">− {fmt(row.commission)}</span>
                            </div>
                        ))}
                        {/* F&B row */}
                        {sales.grossProducts > 0 && (
                            <div className="grid grid-cols-4 px-4 py-3 bg-brandBackground/20">
                                <div className="flex items-center gap-2">
                                    <ShoppingBag size={12} className="text-brandAccent/30 shrink-0" />
                                    <span className="text-xs font-bold text-brandAccent">Food & Drinks</span>
                                </div>
                                <span className="text-xs font-bold text-brandAccent">{fmt(sales.grossProducts)}</span>
                                <span className="text-xs text-brandAccent/40">—</span>
                                <span className="text-xs text-brandAccent/40">No commission</span>
                            </div>
                        )}
                        {/* Total row */}
                        <div className="grid grid-cols-4 px-4 py-3 bg-brandAccent/5 border-t border-brandAccent/10">
                            <span className="text-xs font-bold text-brandAccent uppercase tracking-wider">Total</span>
                            <span className="text-xs font-bold text-brandAccent">{fmt(sales.grossTotal)}</span>
                            <span className="text-xs text-brandAccent/40">—</span>
                            <span className="text-xs font-bold text-red-500">− {fmt(sales.totalCommission)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Net callout */}
            <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-base">
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
                    Net Revenue (Take-Home)
                </span>
                <span className="text-xl font-bold text-emerald-700">{fmt(sales.netTotal)}</span>
            </div>

            {/* Empty state */}
            {sales.breakdown.length === 0 && sales.grossProducts === 0 && (
                <div className="py-8 text-center space-y-2">
                    <Minus size={28} className="text-brandAccent/20 mx-auto" />
                    <p className="text-xs font-bold text-brandAccent/40 uppercase tracking-widest">
                        No completed bookings recorded today
                    </p>
                </div>
            )}
        </div>
    );
}

function KpiCard({
    label, value, sub, color, icon,
}: {
    label: string;
    value: string;
    sub: string;
    color: 'blue' | 'amber' | 'emerald';
    icon?: React.ReactNode;
}) {
    const colors = {
        blue: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        amber: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
        emerald: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    };
    return (
        <div className={`p-4 rounded-base border space-y-1 ${colors[color]}`}>
            <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-widest font-bold opacity-70">{label}</span>
                {icon}
            </div>
            <div className="text-lg font-bold leading-tight">{value}</div>
            <div className="text-[9px] opacity-60 font-medium leading-tight">{sub}</div>
        </div>
    );
}