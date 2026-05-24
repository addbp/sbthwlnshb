function toDateString(d: Date): string {
    return d.toISOString().split('T')[0];
}

export function resolveRangeDates(
    range: string,
    from?: string,
    to?: string,
): { startDate: string; endDate: string; label: string } {
    const today = new Date();
    const todayStr = toDateString(today);

    if (from && to) {
        return { startDate: from, endDate: to, label: `${from} → ${to}` };
    }

    switch (range) {
        case 'yesterday': {
            const y = new Date(today);
            y.setDate(y.getDate() - 1);
            const yStr = toDateString(y);
            return { startDate: yStr, endDate: yStr, label: 'Yesterday' };
        }
        case '7d': {
            const d = new Date(today);
            d.setDate(d.getDate() - 6);
            return { startDate: toDateString(d), endDate: todayStr, label: 'Last 7 Days' };
        }
        case '30d': {
            const d = new Date(today);
            d.setDate(d.getDate() - 29);
            return { startDate: toDateString(d), endDate: todayStr, label: 'Last 30 Days' };
        }
        default:
            return { startDate: todayStr, endDate: todayStr, label: 'Today' };
    }
}