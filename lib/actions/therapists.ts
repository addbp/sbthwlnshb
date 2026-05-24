'use server';

import { createClient } from '@/lib/supabase/server';

export async function getTherapists() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('therapists')
    .select('id, full_name, specialty, status')
    .eq('status', 'active')
    .order('full_name');

  if (error) {
    console.error('Error fetching therapists:', error);
    return [];
  }

  return data;
}