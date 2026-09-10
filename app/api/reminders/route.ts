import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// Initialize Resend and Supabase with administrative rights
const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── INDESTRUCTIBLE STRING DATETIME PARSER ───
// Combines '2026-05-31' and '4:30 PM' into a true chronological Javascript Date object
function parseAppointmentDateTime(dateStr: string, timeStr: string): Date | null {
    if (!dateStr || !timeStr) return null

    const match = timeStr.match(/(\d+):(\d+)\s(AM|PM)/i)
    if (!match) return null

    let hours = parseInt(match[1], 10)
    const minutes = parseInt(match[2], 10)
    const ampm = match[3].toUpperCase()

    if (ampm === 'PM' && hours !== 12) hours += 12
    if (ampm === 'AM' && hours === 12) hours = 0

    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day, hours, minutes, 0)
}

export async function GET(request: Request) {
    try {
        // 1. Security Check: Protect your endpoint from being manually triggered by strangers.
        // Fail closed if the secret is unset or blank — otherwise an empty CRON_SECRET
        // made `?key=` compare equal to it and skipped the check entirely.
        const secret = process.env.CRON_SECRET
        if (!secret) {
            return new NextResponse('Cron secret not configured', { status: 500 })
        }

        const authHeader = request.headers.get('authorization')

        // Vercel Cron sends the secret in the Authorization header. The ?key= query
        // fallback was removed deliberately: query strings land in access logs,
        // browser history and referrer headers.
        if (authHeader !== `Bearer ${secret}`) {
            return new NextResponse('Unauthorized Cron Invocation', { status: 401 })
        }

        const now = new Date()

        // 2. Fetch all bookings that haven't received a reminder yet
        // We filter out Completed/Cancelled states to avoid ghost alerts
        const { data: pendingBookings, error: dbError } = await supabase
            .from('bookings')
            .select('id, client_name, client_email, service_name, appointment_date, appointment_time')
            .eq('reminder_sent', false)
            .not('status', 'in', '("Completed","Cancelled")')

        if (dbError) throw dbError
        if (!pendingBookings || pendingBookings.length === 0) {
            return NextResponse.json({ processed: 0, message: 'No pending reminders in queue.' })
        }

        let sentCount = 0

        // 3. Process the entire queue
        for (const booking of pendingBookings) {
            // Skip bookings without recorded emails
            if (!booking.client_email || !booking.client_email.includes('@')) continue

            const apptDate = parseAppointmentDateTime(booking.appointment_date, booking.appointment_time)
            if (!apptDate) continue

            // Calculate time gap in minutes
            const diffInMinutes = (apptDate.getTime() - now.getTime()) / 60000

            // CRITICAL ALERT THRESHOLD:
            // If the appointment is coming up within the hour (1 to 60 mins from now), fire the notification!
            if (diffInMinutes > 0 && diffInMinutes <= 60) {

                // Send a beautifully styled luxury HTML email matching the Sabbath Spa palette
                await resend.emails.send({
                    from: 'Sabbath Spa & Wellness Hub <appointments@goradatadriven.com>',
                    to: booking.client_email,
                    subject: `Reminder: Your appointment is in less than an hour!`,
                    html: `
            <div style="background-color: #F9F4EB; padding: 40px 20px; font-family: 'Inter', system-ui, sans-serif; color: #1A1A1A; text-align: center;">
              <div style="max-width: 500px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid rgba(197,143,59,0.2); border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
                <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #C58F3B; margin: 0 0 16px;">Reservations Alert</p>
                <h2 style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 28px; font-weight: 400; margin: 0 0 8px; color: #1A1A1A;">See You Shortly</h2>
                <p style="font-size: 15px; color: #5A5A5A; margin: 0 0 24px; line-height: 1.5;">Hello <strong>${booking.client_name}</strong>, this is a friendly confirmation reminder that your session at Sabbath Spa begins in less than an hour.</p>
                
                <div style="background-color: #F8F4EE; border-radius: 12px; padding: 20px; text-align: left; margin-bottom: 24px;">
                  <div style="margin-bottom: 12px;"><span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #7A6E65; display: block; margin-bottom: 2px;">Service Availed</span><strong style="font-size: 15px; color: #1A1A1A;">${booking.service_name}</strong></div>
                  <div style="margin-bottom: 12px;"><span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #7A6E65; display: block; margin-bottom: 2px;">Date</span><strong style="font-size: 15px; color: #1A1A1A;">${booking.appointment_date}</strong></div>
                  <div><span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #7A6E65; display: block; margin-bottom: 2px;">Check-In Time</span><strong style="font-size: 15px; color: #C58F3B;">${booking.appointment_time}</strong></div>
                </div>

                <p style="font-size: 12px; color: #888888; margin: 0 0 16px; line-height: 1.5;">To preserve tranquility and keep scheduling pristine for all guests, please arrive 10-15 minutes prior to your check-in time.</p>
                <div style="height: 1px; background-color: rgba(0,0,0,0.06); margin: 20px 0;"></div>
                <p style="font-size: 11px; color: #AAA; margin: 0;">Sabbath Spa & Wellness Hub · 0917 199 7772</p>
              </div>
            </div>
          `
                })

                // 4. Set flag to true in Supabase immediately so the system doesn't duplicate notifications
                await supabase
                    .from('bookings')
                    .update({ reminder_sent: true })
                    .eq('id', booking.id)

                sentCount++
            }
        }

        return NextResponse.json({ processed: sentCount, status: 'Success' })

    } catch (err: any) {
        console.error('Reminder failure:', err.message)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}