'use server';

import { createClient } from '@/lib/supabase/server';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecentBooking {
  id: string;
  booking_date: string;
  client_name_text: string | null;
  service_name_text: string | null;
  therapist_name_text: string | null;
  category: string | null;
  total_amount: number | null;
  payment_status: string | null;
  booking_status: string | null;
  customer_type: string | null;
}

export interface CreateBookingInput {
  // Client — one of these two will be set depending on the form
  client_id?: string | null;
  client_name_text?: string | null;

  // Service — either FK or free-text (public booking form)
  service_id?: string | null;
  service_name_text?: string | null;

  // Therapist
  therapist_id?: string | null;

  // Scheduling
  booking_date: string;
  booking_time: string;
  duration_minutes?: number | null;

  // Meta
  booking_source: string;
  booking_status: string;
  payment_status: string;
  notes?: string | null;

  // Financials
  total_amount?: number | null;
}

export interface UpdateBookingInput extends Partial<CreateBookingInput> { }

// ── Create Booking ────────────────────────────────────────────────────────────

export async function createBookingAction(
  input: CreateBookingInput,
): Promise<{ error?: string; data: { id: string } }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      client_id: input.client_id ?? null,
      client_name_text: input.client_name_text ?? null,
      service_id: input.service_id ?? null,
      service_name_text: input.service_name_text ?? null,
      therapist_id: input.therapist_id ?? null,
      booking_date: input.booking_date,
      booking_time: input.booking_time,
      duration_minutes: input.duration_minutes ?? null,
      booking_source: input.booking_source,
      booking_status: input.booking_status,
      payment_status: input.payment_status,
      notes: input.notes ?? null,
      total_amount: input.total_amount ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[bookings] createBookingAction error:', error);
    return { error: error.message, data: { id: '' } };
  }

  return { data: { id: data.id } };
}

// ── Update Booking ────────────────────────────────────────────────────────────

export async function updateBookingAction(
  id: string,
  input: UpdateBookingInput,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  // Only send fields that were actually provided
  const patch: Record<string, unknown> = {};
  if (input.client_id !== undefined) patch.client_id = input.client_id;
  if (input.client_name_text !== undefined) patch.client_name_text = input.client_name_text;
  if (input.service_id !== undefined) patch.service_id = input.service_id;
  if (input.service_name_text !== undefined) patch.service_name_text = input.service_name_text;
  if (input.therapist_id !== undefined) patch.therapist_id = input.therapist_id;
  if (input.booking_date !== undefined) patch.booking_date = input.booking_date;
  if (input.booking_time !== undefined) patch.booking_time = input.booking_time;
  if (input.duration_minutes !== undefined) patch.duration_minutes = input.duration_minutes;
  if (input.booking_source !== undefined) patch.booking_source = input.booking_source;
  if (input.booking_status !== undefined) patch.booking_status = input.booking_status;
  if (input.payment_status !== undefined) patch.payment_status = input.payment_status;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.total_amount !== undefined) patch.total_amount = input.total_amount;

  const { error } = await supabase
    .from('bookings')
    .update(patch)
    .eq('id', id);

  if (error) {
    console.error('[bookings] updateBookingAction error:', error);
    return { error: error.message };
  }

  return {};
}

// ── Get Booking By ID ─────────────────────────────────────────────────────────

export async function getBookingById(id: string): Promise<Record<string, unknown> | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      client_id,
      service_id,
      therapist_id,
      booking_date,
      booking_time,
      duration_minutes,
      booking_source,
      booking_status,
      payment_status,
      notes,
      total_amount,
      clients ( id, full_name, mobile_number, email, discounts ( name, discount_percentage ) )
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('[bookings] getBookingById error:', error);
    return null;
  }

  return data as Record<string, unknown>;
}

// ── Recent Bookings ───────────────────────────────────────────────────────────

export async function getRecentBookings(
  startDate?: string,
  endDate?: string,
  limit = 10,
): Promise<RecentBooking[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];
  const resolvedStart = startDate ?? today;
  const resolvedEnd = endDate ?? resolvedStart;

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      booking_date,
      client_name_text,
      service_name_text,
      therapist_name_text,
      category,
      total_amount,
      payment_status,
      booking_status,
      customer_type
    `)
    .gte('booking_date', resolvedStart)
    .lte('booking_date', resolvedEnd)
    .not('booking_status', 'eq', 'cancelled')
    .order('booking_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[bookings] getRecentBookings error:', error);
    return [];
  }

  return (data ?? []) as RecentBooking[];
}