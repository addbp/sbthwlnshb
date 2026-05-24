'use server';

import { createClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategorySales {
    category: string;
    gross_sales: number;
    discount_amount: number;
    net_sales: number;
    booking_count: number;
    commission: number;
    commissionRate: number;
    revenue: number;
}

export interface TherapistStat {
    therapist_name: string;
    gross_sales: number;
    net_sales: number;
    booking_count: number;
}

export interface DailySalesData {
    date: string;
    startDate: string;
    endDate: string;

    // Gross / Net totals (services only)
    grossSales: number;
    grossServices: number;   // alias for grossSales — sum of booking total_amount
    totalDiscount: number;
    netSales: number;

    // Product (F&B) revenue — no commission applied
    grossProducts: number;

    // Combined gross (services + products)
    grossTotal: number;

    // Commission owed to therapists
    totalCommission: number;

    // Net after commission
    netTotal: number;

    // Category breakdown — exposed as both names for compatibility
    categoryBreakdown: CategorySales[];
    breakdown: CategorySales[];

    // Therapist leaderboard
    therapistStats: TherapistStat[];

    // Booking counts
    bookingCount: number;
    newClientCount: number;
    returningClientCount: number;
}

// Row shapes coming back from Supabase
type BookingRow = {
    id: string;
    booking_date: string;
    category: string | null;
    service_name_text: string | null;
    therapist_name_text: string | null;
    client_name_text: string | null;
    customer_type: string | null;
    total_amount: number | null;
    discount_amount: number | null;
    net_sales: number | null;
    payment_status: string | null;
    booking_status: string | null;
};

type ProductRow = {
    unit_price: number;
    quantity: number;
};

// ─── Commission rates by category ─────────────────────────────────────────────
// Adjust these to match your actual business rules
const COMMISSION_RATES: Record<string, number> = {
    SABBATH: 0.3,
    'LE NAILS': 0.2,
    OTHER: 0.0,
};

// ─── Empty state helper ───────────────────────────────────────────────────────

function emptyResult(startDate: string, endDate: string): DailySalesData {
    return {
        date: startDate,
        startDate,
        endDate,
        grossSales: 0,
        grossServices: 0,
        totalDiscount: 0,
        netSales: 0,
        grossProducts: 0,
        grossTotal: 0,
        totalCommission: 0,
        netTotal: 0,
        categoryBreakdown: [],
        breakdown: [],
        therapistStats: [],
        bookingCount: 0,
        newClientCount: 0,
        returningClientCount: 0,
    };
}

// ─── Main function ─────────────────────────────────────────────────────────────

export async function getDailySalesOverview(
    startDate?: string,
    endDate?: string,
): Promise<DailySalesData> {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];
    const resolvedStart = startDate ?? today;
    const resolvedEnd = endDate ?? resolvedStart;

    const empty = emptyResult(resolvedStart, resolvedEnd);

    try {
        // ── 1. Fetch bookings in date range ──────────────────────────────────────
        const { data: rawBookings, error: bookingsError } = await supabase
            .from('bookings')
            .select(`
        id,
        booking_date,
        category,
        service_name_text,
        therapist_name_text,
        client_name_text,
        customer_type,
        total_amount,
        discount_amount,
        net_sales,
        payment_status,
        booking_status
      `)
            .gte('booking_date', resolvedStart)
            .lte('booking_date', resolvedEnd)
            .not('booking_status', 'eq', 'cancelled');

        if (bookingsError) {
            console.error('[sales] bookings fetch error:', bookingsError);
            return empty;
        }

        const bookings = (rawBookings ?? []) as unknown as BookingRow[];
        if (bookings.length === 0) return empty;

        // ── 2. Fetch F&B products for these bookings ─────────────────────────────
        const bookingIds = bookings.map((b) => b.id);
        const { data: rawProducts } = await supabase
            .from('booking_products')
            .select('unit_price, quantity')
            .in('booking_id', bookingIds);

        const products = (rawProducts ?? []) as unknown as ProductRow[];

        // ── 3. Aggregate totals ──────────────────────────────────────────────────
        let grossSales = 0;
        let totalDiscount = 0;
        let netSales = 0;

        const categoryMap = new Map<string, CategorySales>();
        const therapistMap = new Map<string, TherapistStat>();

        let newClientCount = 0;
        let returningClientCount = 0;

        for (const b of bookings) {
            const gross = Number(b.total_amount ?? 0);
            const discount = Number(b.discount_amount ?? 0);
            const net = b.net_sales != null ? Number(b.net_sales) : gross - discount;

            grossSales += gross;
            totalDiscount += discount;
            netSales += net;

            // ── Category split ─────────────────────────────────────────────────────
            const cat = b.category ?? 'OTHER';
            const commissionRate = COMMISSION_RATES[cat] ?? 0;
            const existing = categoryMap.get(cat) ?? {
                category: cat,
                gross_sales: 0,
                discount_amount: 0,
                net_sales: 0,
                booking_count: 0,
                commission: 0,
                commissionRate,
                revenue: 0,
            };
            existing.gross_sales += gross;
            existing.discount_amount += discount;
            existing.net_sales += net;
            existing.booking_count += 1;
            existing.commission += net * commissionRate;
            existing.revenue = existing.net_sales;
            categoryMap.set(cat, existing);

            // ── Therapist leaderboard ──────────────────────────────────────────────
            const therapist = b.therapist_name_text?.trim() || 'Unassigned';
            const tExisting = therapistMap.get(therapist) ?? {
                therapist_name: therapist,
                gross_sales: 0,
                net_sales: 0,
                booking_count: 0,
            };
            tExisting.gross_sales += gross;
            tExisting.net_sales += net;
            tExisting.booking_count += 1;
            therapistMap.set(therapist, tExisting);

            // ── New vs Returning ───────────────────────────────────────────────────
            const ct = b.customer_type?.toLowerCase() ?? '';
            if (ct === 'new' || ct === 'first_time' || ct === 'walk_in') {
                newClientCount += 1;
            } else if (ct === 'returning') {
                returningClientCount += 1;
            }
        }

        // ── 4. F&B product revenue ───────────────────────────────────────────────
        const grossProducts = products.reduce(
            (sum, p) => sum + Number(p.unit_price) * p.quantity,
            0,
        );

        // ── 5. Commission total (sum across all categories) ──────────────────────
        const totalCommission = Array.from(categoryMap.values()).reduce(
            (sum, c) => sum + c.commission,
            0,
        );

        // ── 6. Sort therapist leaderboard by net_sales desc ──────────────────────
        const therapistStats = Array.from(therapistMap.values()).sort(
            (a, b) => b.net_sales - a.net_sales,
        );

        // ── 7. Sort categories (SABBATH first) ───────────────────────────────────
        const categoryBreakdown = Array.from(categoryMap.values()).sort((a, b) => {
            const order = ['SABBATH', 'LE NAILS'];
            return order.indexOf(a.category) - order.indexOf(b.category);
        });

        const result: DailySalesData = {
            date: resolvedStart,
            startDate: resolvedStart,
            endDate: resolvedEnd,
            grossSales,
            grossServices: grossSales,   // same value, surfaced under the expected name
            totalDiscount,
            netSales,
            grossProducts,
            grossTotal: grossSales + grossProducts,
            totalCommission,
            netTotal: netSales + grossProducts - totalCommission,
            categoryBreakdown,
            breakdown: categoryBreakdown,  // same array, both names point to it
            therapistStats,
            bookingCount: bookings.length,
            newClientCount,
            returningClientCount,
        };

        return result;
    } catch (err) {
        console.error('[sales] getDailySalesOverview critical failure:', err);
        return empty;
    }
}