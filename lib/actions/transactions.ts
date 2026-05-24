'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ── Types ──────────────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'gcash' | 'card' | 'bank_transfer' | 'other';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';

export interface CreateTransactionData {
  client_id: string;
  booking_id?: string | null;
  service_id?: string | null;
  original_amount: number;
  discount_id?: string | null;
  discount_percentage: number;
  discount_amount: number;
  final_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  reference_number?: string | null;
  notes?: string | null;
}

export interface TransactionResult {
  data: any | null;
  error: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function logError(context: string, error: any) {
  // Use both JSON.stringify (captures enumerable props) AND the raw object
  // (lets Node/DevTools inspect non-enumerable PostgREST properties).
  console.error(`[${context}] RAW ERROR:`, JSON.stringify(error, null, 2), error);
}

function friendlyError(error: any): string {
  const msg = error?.message ?? String(error);
  if (msg.includes('foreign key')) return 'The selected client or booking no longer exists.';
  if (msg.includes('not-null')) return 'A required field is missing. Please check the form.';
  if (msg.includes('invalid input value for enum')) return 'Invalid payment method or status selected.';
  if (msg.includes('permission denied') || msg.includes('row-level security'))
    return 'You do not have permission to record transactions. Please contact your manager.';
  if (msg.includes('network') || msg.includes('fetch'))
    return 'Network error. Please check your connection and try again.';
  return `Unable to save transaction: ${msg}`;
}

// ── Actions ────────────────────────────────────────────────────────────────

export async function createTransactionAction(
  data: CreateTransactionData
): Promise<TransactionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const discountAmount = Math.round(data.original_amount * data.discount_percentage) / 100;
    const finalAmount = data.original_amount - discountAmount;

    const payload = {
      client_id: data.client_id,
      booking_id: data.booking_id || null,
      service_id: data.service_id || null,
      cashier_id: user?.id ?? null,
      subtotal: data.original_amount,
      discount: discountAmount,
      total_amount: finalAmount,
      original_amount: data.original_amount,
      discount_id: data.discount_id || null,
      discount_percentage: data.discount_percentage,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      payment_method: data.payment_method,
      payment_status: data.payment_status,
      reference_number: data.reference_number?.trim() || null,
      notes: data.notes?.trim() || null,
    };

    const { data: transaction, error } = await supabase
      .from('transactions')
      .insert([payload])
      .select()
      .single();

    if (error) {
      logError('createTransactionAction', error);
      return { data: null, error: friendlyError(error) };
    }

    if (data.booking_id && data.payment_status !== 'unpaid') {
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ payment_status: data.payment_status })
        .eq('id', data.booking_id);

      if (bookingError) {
        logError('updateBookingPaymentStatus', bookingError);
      } else {
        revalidatePath(`/dashboard/bookings/${data.booking_id}`);
      }
    }

    revalidatePath('/dashboard/payments');
    revalidatePath(`/dashboard/clients/${data.client_id}`);

    return { data: transaction, error: null };
  } catch (err: any) {
    logError('createTransactionAction (catch)', err);
    return { data: null, error: friendlyError(err) };
  }
}

export async function updateTransactionStatusAction(
  transactionId: string,
  status: PaymentStatus
): Promise<TransactionResult> {
  try {
    const supabase = await createClient();

    const { data: transaction, error } = await supabase
      .from('transactions')
      .update({ payment_status: status })
      .eq('id', transactionId)
      // !left → returns null instead of erroring when the FK row is missing
      .select('*, clients!left(id)')
      .single();

    if (error) {
      logError('updateTransactionStatusAction', error);
      return { data: null, error: friendlyError(error) };
    }

    revalidatePath('/dashboard/payments');
    revalidatePath(`/dashboard/payments/${transactionId}`);
    if (transaction?.clients?.id) {
      revalidatePath(`/dashboard/clients/${transaction.clients.id}`);
    }

    return { data: transaction, error: null };
  } catch (err: any) {
    logError('updateTransactionStatusAction (catch)', err);
    return { data: null, error: friendlyError(err) };
  }
}

export async function getTransactions(): Promise<{ data: any[]; error: string | null }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        id,
        original_amount,
        discount_percentage,
        discount_amount,
        final_amount,
        subtotal,
        discount,
        total_amount,
        payment_method,
        payment_status,
        reference_number,
        notes,
        created_at,
        clients!left(id, full_name, mobile_number),
        bookings!left(id, booking_date, booking_time),
        discounts!left(id, name, discount_percentage)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      logError('getTransactions', error);
      return { data: [], error: friendlyError(error) };
    }

    return { data: data ?? [], error: null };
  } catch (err: any) {
    logError('getTransactions (catch)', err);
    return { data: [], error: friendlyError(err) };
  }
}

export async function getTransactionById(
  id: string
): Promise<{ data: any | null; error: string | null }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        id,
        original_amount,
        discount_percentage,
        discount_amount,
        final_amount,
        subtotal,
        discount,
        total_amount,
        payment_method,
        payment_status,
        reference_number,
        notes,
        created_at,
        clients!left(id, full_name, mobile_number, email, membership_type),
        bookings!left(id, booking_date, booking_time, booking_status),
        discounts!left(id, name, discount_percentage),
        cashier:profiles!left(id, full_name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      logError('getTransactionById', error);
      return { data: null, error: friendlyError(error) };
    }

    return { data, error: null };
  } catch (err: any) {
    logError('getTransactionById (catch)', err);
    return { data: null, error: friendlyError(err) };
  }
}

export async function getClientTransactions(
  clientId: string
): Promise<{ data: any[]; error: string | null }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        id,
        original_amount,
        discount_percentage,
        discount_amount,
        final_amount,
        subtotal,
        total_amount,
        payment_method,
        payment_status,
        reference_number,
        created_at
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      logError('getClientTransactions', error);
      return { data: [], error: friendlyError(error) };
    }

    return { data: data ?? [], error: null };
  } catch (err: any) {
    logError('getClientTransactions (catch)', err);
    return { data: [], error: friendlyError(err) };
  }
}

export async function getDiscounts(): Promise<{ data: any[]; error: string | null }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('discounts')
      .select('id, name, discount_percentage, category, notes')
      .eq('active', true)
      .order('name');

    if (error) {
      logError('getDiscounts', error);
      return { data: [], error: friendlyError(error) };
    }

    return { data: data ?? [], error: null };
  } catch (err: any) {
    logError('getDiscounts (catch)', err);
    return { data: [], error: friendlyError(err) };
  }
}

export async function getClientsForPayment(): Promise<{ data: any[]; error: string | null }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('clients')
      .select('id, full_name, mobile_number, email, membership_type')
      .order('full_name');

    if (error) {
      logError('getClientsForPayment', error);
      return { data: [], error: friendlyError(error) };
    }

    return { data: data ?? [], error: null };
  } catch (err: any) {
    logError('getClientsForPayment (catch)', err);
    return { data: [], error: friendlyError(err) };
  }
}

export async function getBookingsForClient(
  clientId: string
): Promise<{ data: any[]; error: string | null }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('bookings')
      // !left → returns null for service instead of crashing on missing FK
      .select('id, booking_date, booking_time, booking_status, payment_status, services!left(id, service_name, price)')
      .eq('client_id', clientId)
      .in('payment_status', ['unpaid', 'partial'])
      .order('booking_date', { ascending: false })
      .limit(20);

    if (error) {
      logError('getBookingsForClient', error);
      return { data: [], error: null };
    }

    return { data: data ?? [], error: null };
  } catch (err: any) {
    logError('getBookingsForClient (catch)', err);
    return { data: [], error: null };
  }
}

// ── Aliases for backward compatibility ────────────────────────────────────

export { getClientTransactions as getTransactionsByClient };

export async function getTodaySales(): Promise<{ data: number; error: string | null }> {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('transactions')
      .select('final_amount, total_amount')
      .eq('payment_status', 'paid')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    if (error) return { data: 0, error: error.message };

    const total = (data ?? []).reduce(
      (sum: number, t: any) => sum + (t.final_amount ?? t.total_amount ?? 0),
      0
    );

    return { data: total, error: null };
  } catch (err: any) {
    return { data: 0, error: err.message };
  }
}