'use server';

import { createClient } from '@/lib/supabase/server';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ReportKPIs {
    totalClients: number;
    newClients: number;
    returningClients: number;
    totalBookings: number;
    pendingBookings: number;
    completedBookings: number;
    waiversSigned: number;
    totalSales: number;
}

export interface RecentBooking {
    id: string;
    booking_date: string;
    booking_time: string | null;
    booking_status: string;
    client_name: string | null;
    service_name: string | null;
}

export interface RecentPayment {
    id: string;
    created_at: string;
    payment_method: string | null;
    payment_status: string;
    final_amount: number | null;
    total_amount: number | null;
    client_name: string | null;
}

export interface RecentWaiver {
    id: string;
    created_at: string;
    client_name: string | null;
    service_availed: string | null;
}

export interface ReportsData {
    kpis: ReportKPIs;
    recentBookings: RecentBooking[];
    recentPayments: RecentPayment[];
    recentWaivers: RecentWaiver[];
    error: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function safeCount(data: any[] | null): number {
    return data?.length ?? 0;
}

// ── Main fetch ─────────────────────────────────────────────────────────────

export async function getReportsData(): Promise<ReportsData> {
    const empty: ReportsData = {
        kpis: {
            totalClients: 0,
            newClients: 0,
            returningClients: 0,
            totalBookings: 0,
            pendingBookings: 0,
            completedBookings: 0,
            waiversSigned: 0,
            totalSales: 0,
        },
        recentBookings: [],
        recentPayments: [],
        recentWaivers: [],
        error: null,
    };

    try {
        const supabase = await createClient();

        // ── Clients ──────────────────────────────────────────────────────────
        const { data: allClients, error: clientsErr } = await supabase
            .from('clients')
            .select('id, client_type');

        if (clientsErr) {
            console.error('[reports] clients error:', clientsErr.message);
            return { ...empty, error: 'Failed to load client data.' };
        }

        const totalClients = safeCount(allClients);
        const newClients = (allClients ?? []).filter(
            (c: any) => c.client_type === 'first_time'
        ).length;
        const returningClients = (allClients ?? []).filter((c: any) =>
            ['returning', 'regular', 'member'].includes(c.client_type)
        ).length;

        // ── Bookings ─────────────────────────────────────────────────────────
        const { data: allBookings, error: bookingsErr } = await supabase
            .from('bookings')
            .select('id, booking_status');

        if (bookingsErr) {
            console.error('[reports] bookings error:', bookingsErr.message);
            return { ...empty, error: 'Failed to load booking data.' };
        }

        const totalBookings = safeCount(allBookings);
        const pendingBookings = (allBookings ?? []).filter((b: any) =>
            ['pending', 'confirmed'].includes(b.booking_status)
        ).length;
        const completedBookings = (allBookings ?? []).filter(
            (b: any) => b.booking_status === 'completed'
        ).length;

        // ── Waivers ───────────────────────────────────────────────────────────
        const { data: allWaivers, error: waiversErr } = await supabase
            .from('waivers')
            .select('id');

        if (waiversErr) {
            console.error('[reports] waivers error:', waiversErr.message);
            // Non-fatal — continue with 0
        }

        const waiversSigned = safeCount(allWaivers);

        // ── Transactions (paid only) ──────────────────────────────────────────
        const { data: paidTxns, error: txnErr } = await supabase
            .from('transactions')
            .select('id, final_amount, total_amount')
            .eq('payment_status', 'paid');

        if (txnErr) {
            console.error('[reports] transactions error:', txnErr.message);
            // Non-fatal — continue with 0
        }

        const totalSales = (paidTxns ?? []).reduce(
            (sum: number, t: any) =>
                sum + (t.final_amount !== null && t.final_amount !== undefined
                    ? Number(t.final_amount)
                    : Number(t.total_amount ?? 0)),
            0
        );

        // ── Recent bookings ───────────────────────────────────────────────────
        const { data: recentBookingsRaw, error: recentBookingsErr } = await supabase
            .from('bookings')
            .select('id, booking_date, booking_time, booking_status, client_id, service_id')
            .order('created_at', { ascending: false })
            .limit(5);

        if (recentBookingsErr) {
            console.error('[reports] recent bookings error:', recentBookingsErr.message);
        }

        // Fetch client names for recent bookings
        const bookingClientIds = (recentBookingsRaw ?? [])
            .map((b: any) => b.client_id)
            .filter(Boolean);
        const bookingServiceIds = (recentBookingsRaw ?? [])
            .map((b: any) => b.service_id)
            .filter(Boolean);

        const { data: bookingClients } = bookingClientIds.length
            ? await supabase
                .from('clients')
                .select('id, full_name')
                .in('id', bookingClientIds)
            : { data: [] };

        const { data: bookingServices } = bookingServiceIds.length
            ? await supabase
                .from('services')
                .select('id, service_name')
                .in('id', bookingServiceIds)
            : { data: [] };

        const clientMap = Object.fromEntries(
            (bookingClients ?? []).map((c: any) => [c.id, c.full_name])
        );
        const serviceMap = Object.fromEntries(
            (bookingServices ?? []).map((s: any) => [s.id, s.service_name])
        );

        const recentBookings: RecentBooking[] = (recentBookingsRaw ?? []).map((b: any) => ({
            id: b.id,
            booking_date: b.booking_date,
            booking_time: b.booking_time,
            booking_status: b.booking_status,
            client_name: clientMap[b.client_id] ?? null,
            service_name: serviceMap[b.service_id] ?? null,
        }));

        // ── Recent payments ───────────────────────────────────────────────────
        const { data: recentTxnsRaw, error: recentTxnsErr } = await supabase
            .from('transactions')
            .select('id, created_at, payment_method, payment_status, final_amount, total_amount, client_id')
            .order('created_at', { ascending: false })
            .limit(5);

        if (recentTxnsErr) {
            console.error('[reports] recent transactions error:', recentTxnsErr.message);
        }

        const txnClientIds = (recentTxnsRaw ?? [])
            .map((t: any) => t.client_id)
            .filter(Boolean);

        const { data: txnClients } = txnClientIds.length
            ? await supabase
                .from('clients')
                .select('id, full_name')
                .in('id', txnClientIds)
            : { data: [] };

        const txnClientMap = Object.fromEntries(
            (txnClients ?? []).map((c: any) => [c.id, c.full_name])
        );

        const recentPayments: RecentPayment[] = (recentTxnsRaw ?? []).map((t: any) => ({
            id: t.id,
            created_at: t.created_at,
            payment_method: t.payment_method,
            payment_status: t.payment_status,
            final_amount: t.final_amount,
            total_amount: t.total_amount,
            client_name: txnClientMap[t.client_id] ?? null,
        }));

        // ── Recent waivers ────────────────────────────────────────────────────
        const { data: recentWaiversRaw, error: recentWaiversErr } = await supabase
            .from('waivers')
            .select('id, created_at, client_id, service_availed, preferred_pressure, signed_at')
            .order('created_at', { ascending: false })
            .limit(5);

        if (recentWaiversErr) {
            console.error('[reports] recent waivers error:', recentWaiversErr.message);
        }

        const waiverClientIds = (recentWaiversRaw ?? [])
            .map((w: any) => w.client_id)
            .filter(Boolean);

        const { data: waiverClients } = waiverClientIds.length
            ? await supabase
                .from('clients')
                .select('id, full_name')
                .in('id', waiverClientIds)
            : { data: [] };

        const waiverClientMap = Object.fromEntries(
            (waiverClients ?? []).map((c: any) => [c.id, c.full_name])
        );

        const recentWaivers: RecentWaiver[] = (recentWaiversRaw ?? []).map((w: any) => ({
            id: w.id,
            created_at: w.created_at,
            client_name: waiverClientMap[w.client_id] ?? null,
            service_availed: w.service_availed ?? null,
        }));

        return {
            kpis: {
                totalClients,
                newClients,
                returningClients,
                totalBookings,
                pendingBookings,
                completedBookings,
                waiversSigned,
                totalSales,
            },
            recentBookings,
            recentPayments,
            recentWaivers,
            error: null,
        };
    } catch (err: any) {
        console.error('[reports] unexpected error:', err);
        return {
            ...empty,
            error: err?.message ?? 'An unexpected error occurred loading reports.',
        };
    }
}