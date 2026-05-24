'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type BookingStatus =
    | 'pending'
    | 'confirmed'
    | 'checked_in'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'no_show'

export interface UpdateBookingStatusResult {
    success: boolean
    error?: string
    newStatus?: BookingStatus
}

export async function updateBookingStatus(
    bookingId: string,
    newStatus: BookingStatus
): Promise<UpdateBookingStatusResult> {
    const supabase = await createClient()

    try {
        // 1. Fetch only the fields we need — no appointment_date, no joins
        const { data: booking, error: fetchError } = await supabase
            .from('bookings')
            .select('id, client_id, booking_status')
            .eq('id', bookingId)
            .single()

        if (fetchError || !booking) {
            console.error('[updateBookingStatus] fetch error:', {
                code: fetchError?.code,
                message: fetchError?.message,
                details: fetchError?.details,
                hint: fetchError?.hint,
            })
            return { success: false, error: 'Booking not found.' }
        }

        // 2. Update booking_status
        const { error: updateError } = await supabase
            .from('bookings')
            .update({
                booking_status: newStatus,
                updated_at: new Date().toISOString(),
            })
            .eq('id', bookingId)

        if (updateError) {
            console.error('[updateBookingStatus] update error:', {
                code: updateError.code,
                message: updateError.message,
                details: updateError.details,
                hint: updateError.hint,
            })
            return { success: false, error: 'Failed to update booking status.' }
        }

        // 3. If completed, update the client record (non-fatal)
        if (newStatus === 'completed' && booking.client_id) {
            await handleCompletedBooking(supabase, booking.client_id)
        }

        // 4. Revalidate relevant pages
        revalidatePath('/dashboard/bookings')
        revalidatePath(`/dashboard/bookings/${bookingId}`)
        revalidatePath('/dashboard/reports')

        return { success: true, newStatus }
    } catch (err) {
        console.error('[updateBookingStatus] unexpected error:', err)
        return { success: false, error: 'An unexpected error occurred.' }
    }
}

async function handleCompletedBooking(
    supabase: Awaited<ReturnType<typeof createClient>>,
    clientId: string
) {
    try {
        const { data: client, error: clientFetchError } = await supabase
            .from('clients')
            .select('id, client_type')
            .eq('id', clientId)
            .single()

        if (clientFetchError || !client) {
            console.error('[handleCompletedBooking] client fetch error:', {
                code: clientFetchError?.code,
                message: clientFetchError?.message,
            })
            return
        }

        const updates: Record<string, unknown> = {
            last_visit_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }

        // Only upgrade first_time → returning; never touch regular or member
        if (client.client_type === 'first_time') {
            updates.client_type = 'returning'
        }

        const { error: clientUpdateError } = await supabase
            .from('clients')
            .update(updates)
            .eq('id', clientId)

        if (clientUpdateError) {
            console.error('[handleCompletedBooking] client update error:', {
                code: clientUpdateError.code,
                message: clientUpdateError.message,
                details: clientUpdateError.details,
                hint: clientUpdateError.hint,
            })
            // Non-fatal — booking status already saved above
        }

        revalidatePath(`/dashboard/clients/${clientId}`)
        revalidatePath('/dashboard/clients')
    } catch (err) {
        // Non-fatal
        console.error('[handleCompletedBooking] unexpected error:', err)
    }
}