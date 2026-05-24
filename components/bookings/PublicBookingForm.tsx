'use client';

import { useState } from 'react';
import { createBookingAction } from '@/lib/actions/bookings';
import { CheckCircle2, Loader2, CalendarHeart } from 'lucide-react';

const BOOKING_SOURCES = [
    { value: 'walk_in', label: 'Walk-in' },
    { value: 'phone', label: 'Phone Call' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'website', label: 'Website' },
    { value: 'referral', label: 'Referral' },
];

const INITIAL_FORM = {
    client_name_text: '',
    service_name_text: '',
    booking_date: '',
    booking_time: '',
    notes: '',
    booking_source: 'walk_in',
};

export default function PublicBookingForm() {
    const [form, setForm] = useState(INITIAL_FORM);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [submittedName, setSubmittedName] = useState('');

    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
        setError(null);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!form.booking_date || !form.booking_time) {
            setError('Please select a date and time for your booking.');
            return;
        }
        if (!form.client_name_text.trim()) {
            setError('Please enter your name.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await createBookingAction({
                client_name_text: form.client_name_text.trim() || null,
                service_name_text: form.service_name_text.trim() || null,
                booking_date: form.booking_date,
                booking_time: form.booking_time,
                booking_source: form.booking_source,
                notes: form.notes.trim() || null,
                booking_status: 'pending',
                payment_status: 'unpaid',
            });

            if (result.error) {
                setError(result.error);
                return;
            }

            // Success — save name for thank-you, then clear form
            setSubmittedName(form.client_name_text.trim());
            setForm(INITIAL_FORM);
            setSubmitted(true);
        } catch (err: any) {
            setError(err?.message ?? 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    function handleBookAgain() {
        setSubmitted(false);
        setSubmittedName('');
        setError(null);
    }

    // ── Thank-You Screen ────────────────────────────────────────────────────
    if (submitted) {
        return (
            <div className="min-h-screen bg-brandBg flex items-center justify-center p-6">
                <div className="w-full max-w-md text-center space-y-6 animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                        <CheckCircle2 size={48} className="text-emerald-500" />
                    </div>

                    <div className="space-y-2">
                        <h1 className="brand-heading text-3xl text-brandText">Thank You!</h1>
                        {submittedName && (
                            <p className="text-brandAccent/60 text-sm font-medium">{submittedName}</p>
                        )}
                        <p className="text-brandAccent/50 text-sm leading-relaxed">
                            Your booking request has been received. Our team will confirm your appointment shortly.
                        </p>
                    </div>

                    <div className="pt-4 space-y-3">
                        <p className="text-xs text-brandAccent/30 uppercase tracking-widest font-bold">
                            Sabbath Spa &amp; Wellness Hub
                        </p>
                        <button
                            onClick={handleBookAgain}
                            className="btn-secondary text-sm px-6 py-2 rounded-full"
                        >
                            Book Another Appointment
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Booking Form ────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-brandBg flex items-center justify-center p-6">
            <div className="w-full max-w-lg">
                {/* Header */}
                <div className="text-center mb-8 space-y-2">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <CalendarHeart size={28} className="text-brandAccent" />
                    </div>
                    <h1 className="brand-heading text-3xl text-brandText">Book an Appointment</h1>
                    <p className="text-brandAccent/50 text-sm">
                        Fill in your details and we&apos;ll confirm your booking.
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="card space-y-5">
                    {/* Name */}
                    <div>
                        <label className="form-label" htmlFor="client_name_text">
                            Your Name <span className="text-red-400">*</span>
                        </label>
                        <input
                            id="client_name_text"
                            name="client_name_text"
                            type="text"
                            className="form-input"
                            placeholder="e.g. Maria Santos"
                            value={form.client_name_text}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    {/* Service */}
                    <div>
                        <label className="form-label" htmlFor="service_name_text">
                            Service Requested
                        </label>
                        <input
                            id="service_name_text"
                            name="service_name_text"
                            type="text"
                            className="form-input"
                            placeholder="e.g. Swedish Massage, Facial, Foot Spa…"
                            value={form.service_name_text}
                            onChange={handleChange}
                        />
                    </div>

                    {/* Date + Time */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="form-label" htmlFor="booking_date">
                                Date <span className="text-red-400">*</span>
                            </label>
                            <input
                                id="booking_date"
                                name="booking_date"
                                type="date"
                                className="form-input"
                                value={form.booking_date}
                                onChange={handleChange}
                                min={new Date().toISOString().split('T')[0]}
                                required
                            />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="booking_time">
                                Time <span className="text-red-400">*</span>
                            </label>
                            <input
                                id="booking_time"
                                name="booking_time"
                                type="time"
                                className="form-input"
                                value={form.booking_time}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    {/* How did you hear about us */}
                    <div>
                        <label className="form-label" htmlFor="booking_source">
                            How did you find us?
                        </label>
                        <select
                            id="booking_source"
                            name="booking_source"
                            className="form-input"
                            value={form.booking_source}
                            onChange={handleChange}
                        >
                            {BOOKING_SOURCES.map((s) => (
                                <option key={s.value} value={s.value}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="form-label" htmlFor="notes">
                            Special Requests / Notes
                        </label>
                        <textarea
                            id="notes"
                            name="notes"
                            className="form-input min-h-[80px] resize-none"
                            placeholder="Any allergies, preferences, or requests…"
                            value={form.notes}
                            onChange={handleChange}
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full h-12 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                <span>Submitting…</span>
                            </>
                        ) : (
                            <span className="uppercase tracking-widest text-sm font-bold">
                                Request Appointment
                            </span>
                        )}
                    </button>

                    <p className="text-center text-xs text-brandAccent/30">
                        We&apos;ll contact you to confirm your appointment.
                    </p>
                </form>
            </div>
        </div>
    );
}   