'use server';

import { createClient } from '@/lib/supabase/server';

export async function getServices() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('active', true)
    .order('service_name');
    
  if (error) {
    console.error('Error fetching services:', error);
    return [];
  }
  return data;
}

export async function getServiceById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', id)
    .single();
    
  if (error) throw error;
  return data;
}
