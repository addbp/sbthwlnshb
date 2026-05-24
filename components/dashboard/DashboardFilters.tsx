'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Loader2 } from 'lucide-react';

const PRESETS = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Last 7 Days', value: '7d' },
    { label: 'Last 30 Days', value: '30d' },
];

function toDateString(d: Date) {
    return d.toISOString().split('T')[0];
}

export default function DashboardFilters({
    currentRange,
    currentFrom,
    currentTo,
}: {
    currentRange: string;
    currentFrom: string;
    currentTo: string;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const isCustom = !!(currentFrom && currentTo);
    const activePreset = isCustom ? 'custom' : (currentRange || 'today');

    const [showCustom, setShowCustom] = useState(isCustom);
    const [customFrom, setCustomFrom] = useState(currentFrom || toDateString(new Date()));
    const [customTo, setCustomTo] = useState(currentTo || toDateString(new Date()));

    function applyPreset(preset: string) {
        if (preset === 'custom') { setShowCustom(true); return; }
        setShowCustom(false);
        startTransition(() => { router.push(`/dashboard?range=${preset}`); });
    }

    function applyCustomRange() {
        if (!customFrom || !customTo) return;
        startTransition(() => {
            router.push(`/dashboard?from=${customFrom}&to=${customTo}`);
        });
    }

    return (
        <div className="flex flex-wrap items-center gap-3">
            {/* Preset pills */}
            <div className="flex items-center gap-1 bg-brandBackground/60 border border-brandAccent/10 rounded-pill p-1">
                {PRESETS.map(p => (
                    <button
                        key={p.value}
                        type="button"
                        onClick={() => applyPreset(p.value)}
                        className={`px-4 py-1.5 rounded-pill text-xs font-bold uppercase tracking-widest transition-all ${activePreset === p.value
                                ? 'bg-brandAccent text-white shadow-sm'
                                : 'text-brandAccent/60 hover:text-brandAccent'
                            }`}
                    >
                        {p.label}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => applyPreset('custom')}
                    className={`px-4 py-1.5 rounded-pill text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-1.5 ${activePreset === 'custom'
                            ? 'bg-brandAccent text-white shadow-sm'
                            : 'text-brandAccent/60 hover:text-brandAccent'
                        }`}
                >
                    <CalendarDays size={11} /> Custom
                </button>
            </div>

            {/* Custom date pickers */}
            {showCustom && (
                <div className="flex items-center gap-2 animate-in slide-in-from-top-1 duration-200">
                    <input
                        type="date"
                        value={customFrom}
                        onChange={e => setCustomFrom(e.target.value)}
                        className="input h-9 text-xs px-3 w-36"
                    />
                    <span className="text-xs text-brandAccent/40 font-bold">→</span>
                    <input
                        type="date"
                        value={customTo}
                        min={customFrom}
                        onChange={e => setCustomTo(e.target.value)}
                        className="input h-9 text-xs px-3 w-36"
                    />
                    <button
                        type="button"
                        onClick={applyCustomRange}
                        disabled={isPending || !customFrom || !customTo}
                        className="btn-primary h-9 px-5 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50"
                    >
                        {isPending && <Loader2 size={11} className="animate-spin" />}
                        Apply
                    </button>
                </div>
            )}

            {isPending && !showCustom && (
                <Loader2 size={14} className="animate-spin text-brandAccent/40" />
            )}

            <span className="text-[10px] text-brandAccent/30 italic ml-auto hidden md:block">
                🔗 Shareable via URL
            </span>
        </div>
    );
}