'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface ClientData {
  id?: string;
  full_name: string;
  mobile_number?: string | null;
  email?: string | null;
  address?: string | null;
  emergency_contact_person?: string | null;
  emergency_contact_number?: string | null;
  gender?: string | null;
  birthday?: string | null;
  anniversary?: string | null;
  client_type?: string;
  membership_type?: string;
  membership_tier?: string | null;
  discount_id?: string | null;
  notes?: string | null;
}

/**
 * Standardized Supabase Error Logger.
 */
function logSupabaseError(context: string, error: any) {
  console.error(`Supabase Error [${context}]`, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    fullError: JSON.stringify(error, null, 2),
  });
}

/**
 * Normalizes client input for database storage.
 * Ensures dates are null if empty and strings are trimmed.
 */
export async function normalizeClientInput(data: any): Promise<ClientData> {
  const normalizeDate = (val: any) => {
    if (!val || val.trim() === '') return null;
    if (val.match(/^\d{4}-\d{2}-\d{2}$/)) return val;
    return null;
  };

  return {
    ...data,
    full_name: data.full_name?.trim() || 'No Name',
    mobile_number: data.mobile_number?.trim() !== '' ? data.mobile_number?.trim() : null,
    email: data.email?.trim() !== '' ? data.email?.trim() : null,
    address: data.address?.trim() !== '' ? data.address?.trim() : null,
    emergency_contact_person: data.emergency_contact_person?.trim() !== '' ? data.emergency_contact_person?.trim() : null,
    emergency_contact_number: data.emergency_contact_number?.trim() !== '' ? data.emergency_contact_number?.trim() : null,
    birthday: normalizeDate(data.birthday),
    anniversary: normalizeDate(data.anniversary),
    notes: data.notes?.trim() !== '' ? data.notes?.trim() : null,
    discount_id: data.discount_id && data.discount_id !== 'none' ? data.discount_id : null,
    client_type: ['first_time', 'returning', 'regular', 'member'].includes(data.client_type) 
      ? data.client_type 
      : 'first_time',
  };
}

export async function createClientAction(rawData: ClientData) {
  console.log('[createClientAction] Received raw data:', { ...rawData, email: rawData.email ? 'EXISTS' : 'NONE' });
  
  try {
    const data = await normalizeClientInput(rawData);
    console.log('[createClientAction] Normalized data for insert:', data);

    const existing = await checkDuplicate(data.mobile_number, data.email, undefined);
    if (existing) {
      console.warn('[createClientAction] Duplicate found:', existing.id);
      return { error: 'This client already exists with the same mobile or email. Please use the existing profile.' };
    }

    const supabase = await createClient();
    console.log('[createClientAction] Calling Supabase table: clients');

    const { data: client, error } = await supabase
      .from('clients')
      .insert([data])
      .select()
      .single();

    if (error) {
      logSupabaseError('createClientAction', error);
      return { error: `Unable to save client record: ${error.message}` };
    }

    console.log('[createClientAction] Success! New client ID:', client.id);
    revalidatePath('/dashboard/clients');
    return { data: client, error: null };
  } catch (err) {
    console.error('[createClientAction] Critical failure:', err);
    return { error: 'A system error occurred while saving the client.' };
  }
}

export async function checkDuplicate(mobile?: string | null, email?: string | null, excludeId?: string) {
  if (!mobile && !email) return null;
  const supabase = await createClient();
  let query = supabase.from('clients').select('id, full_name');
  
  if (mobile && email) {
    query = query.or(`mobile_number.eq.${mobile},email.eq.${email}`);
  } else if (mobile) {
    query = query.eq('mobile_number', mobile);
  } else if (email) {
    query = query.eq('email', email);
  }

  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query;
  if (error) return null;
  return data && data.length > 0 ? data[0] : null;
}

export async function getDiscounts() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('discounts').select('*').eq('active', true).order('name');
  if (error) {
    logSupabaseError('getDiscounts', error);
    return [];
  }
  return data;
}

export async function findPossibleClientMatches(params: { mobile?: string; email?: string; name?: string }) {
  const exactMatch = await findClientByMobileOrEmail({ mobile: params.mobile, email: params.email });
  let nameMatches: any[] = [];
  if (!exactMatch && params.name) {
    nameMatches = await findClientsByFullName(params.name);
  }
  return { exactMatch, nameMatches };
}

export async function findClientByMobileOrEmail(params: { mobile?: string; email?: string }) {
  const supabase = await createClient();
  if (params.mobile && params.mobile.trim() !== '') {
    const { data } = await supabase.from('clients').select('*').eq('mobile_number', params.mobile.trim()).maybeSingle();
    if (data) return data;
  }
  if (params.email && params.email.trim() !== '') {
    const { data } = await supabase.from('clients').select('*').eq('email', params.email.trim()).maybeSingle();
    if (data) return data;
  }
  return null;
}

export async function findClientsByFullName(name: string) {
  if (!name || name.trim().length < 3) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from('clients').select('id, full_name, mobile_number, email, client_type').ilike('full_name', `%${name.trim()}%`).limit(5);
  if (error) logSupabaseError('findClientsByFullName', error);
  return data || [];
}

export async function getClients(search?: string) {
  const supabase = await createClient();
  const { data: clients, error } = await supabase.from('clients').select('*').order('full_name');
  if (error) {
    logSupabaseError('getClients', error);
    return [];
  }
  if (search) {
    const s = search.toLowerCase();
    return clients.filter(c => c.full_name?.toLowerCase().includes(s) || c.mobile_number?.includes(s) || c.email?.toLowerCase().includes(s));
  }
  return clients;
}

export async function getClientById(id: string) {
  if (!id) return null;
  const supabase = await createClient();
  const { data: client, error } = await supabase.from('clients').select('*').eq('id', id).single();
  if (error) {
    logSupabaseError('getClientById', error);
    return null;
  }
  const [discount, bookings, waivers] = await Promise.all([
    client.discount_id ? supabase.from('discounts').select('*').eq('id', client.discount_id).single() : Promise.resolve({ data: null }),
    supabase.from('bookings').select('*').eq('client_id', id).order('booking_date', { ascending: false }),
    supabase.from('waivers').select('*').eq('client_id', id)
  ]);
  return { ...client, discounts: discount.data, bookings: bookings.data || [], waivers: waivers.data || [] };
}

export async function getClientDiscount(clientId: string) {
  const supabase = await createClient();
  const { data: client, error: cErr } = await supabase.from('clients').select('discount_id').eq('id', clientId).single();
  if (cErr || !client?.discount_id) return { name: 'None', percentage: 0, isMember: false };
  const { data: discount, error: dErr } = await supabase.from('discounts').select('name, discount_percentage').eq('id', client.discount_id).single();
  if (dErr || !discount) return { name: 'None', percentage: 0, isMember: false };
  return { name: discount.name, percentage: parseFloat(discount.discount_percentage), isMember: true };
}

export async function updateClientAction(id: string, rawData: ClientData) {
  try {
    const data = await normalizeClientInput(rawData);
    const supabase = await createClient();
    const { data: client, error } = await supabase.from('clients').update(data).eq('id', id).select().single();
    if (error) {
      logSupabaseError('updateClientAction', error);
      return { error: 'Failed to update client record.' };
    }
    revalidatePath('/dashboard/clients');
    revalidatePath(`/dashboard/clients/${id}`);
    return { data: client, error: null };
  } catch (err) {
    console.error('Critical failure in updateClientAction:', err);
    return { error: 'A system error occurred while updating the client.' };
  }
}
