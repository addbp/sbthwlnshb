'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface WaiverData {
    client_id: string;
    booking_id?: string | null;
    service_availed?: string | null;
    preferred_pressure?: string | null;
    focus_areas?: string[];
    health_conditions?: string[];
    current_medications?: string | null;
    health_concerns?: string | null;
    consent_information_accurate: boolean;
    consent_wellness_only: boolean;
    consent_liability_release: boolean;
    consent_behavior_policy: boolean;
    consent_data_privacy: boolean;
    signature_url?: string | null;
    signature_base64?: string | null;
    device_info?: object | null;
}

function logSupabaseError(context: string, error: any) {
    console.error(`Supabase Error [${context}]`, {
        code: error?.code ?? null,
        message: error?.message ?? String(error),
        details: error?.details ?? null,
        hint: error?.hint ?? null,
    });
}

export async function createWaiverAction(rawData: WaiverData) {
    console.log('[createWaiverAction] Started for client:', rawData.client_id);

    try {
        const supabase = await createClient();
        let signatureUrl = rawData.signature_url || null;

        // ── Attempt storage upload, fall back gracefully ──────────────────────
        if (rawData.signature_base64) {
            try {
                // Strip the data URL prefix to get raw base64
                const base64Data = rawData.signature_base64.replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                const filePath = `waivers/${rawData.client_id}/${Date.now()}.png`;

                const { error: uploadError } = await supabase.storage
                    .from('sabbath-spa-assets')
                    .upload(filePath, buffer, { contentType: 'image/png', upsert: true });

                if (uploadError) {
                    // Log but DO NOT return — fall back to storing base64 inline
                    console.warn('[createWaiverAction] Storage upload failed, falling back to inline storage:', uploadError.message);
                    // Store the full data URL as the signature_url so it's still retrievable
                    signatureUrl = rawData.signature_base64;
                } else {
                    const { data: publicUrlData } = supabase.storage
                        .from('sabbath-spa-assets')
                        .getPublicUrl(filePath);
                    signatureUrl = publicUrlData.publicUrl;
                }
            } catch (storageErr) {
                console.warn('[createWaiverAction] Storage exception, falling back to inline storage:', storageErr);
                signatureUrl = rawData.signature_base64;
            }
        }

        // ── Insert waiver record ──────────────────────────────────────────────
        const payload = {
            client_id: rawData.client_id,
            booking_id: rawData.booking_id || null,
            service_availed: rawData.service_availed?.trim() || null,
            preferred_pressure: rawData.preferred_pressure || null,
            focus_areas: rawData.focus_areas || [],
            health_conditions: rawData.health_conditions || [],
            current_medications: rawData.current_medications?.trim() || null,
            health_concerns: rawData.health_concerns?.trim() || null,
            consent_information_accurate: rawData.consent_information_accurate,
            consent_wellness_only: rawData.consent_wellness_only,
            consent_liability_release: rawData.consent_liability_release,
            consent_behavior_policy: rawData.consent_behavior_policy,
            consent_data_privacy: rawData.consent_data_privacy,
            signature_url: signatureUrl,
            signed_at: new Date().toISOString(),
            device_info: rawData.device_info || null,
        };

        const { data: waiver, error } = await supabase
            .from('waivers')
            .insert([payload])
            .select()
            .single();

        if (error) {
            logSupabaseError('createWaiverAction:insert', error);
            return { data: null, error: `Unable to save waiver: ${error.message}` };
        }

        console.log('[createWaiverAction] Success! Waiver ID:', waiver.id);
        revalidatePath(`/dashboard/clients/${rawData.client_id}`);
        revalidatePath('/dashboard/waivers');
        return { data: waiver, error: null };

    } catch (err) {
        console.error('[createWaiverAction] Critical failure:', err);
        return { data: null, error: 'A system error occurred while saving the waiver.' };
    }
}

export async function getWaiversByClient(clientId: string) {
    if (!clientId) return [];
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('waivers')
        .select('*')
        .eq('client_id', clientId)
        .order('signed_at', { ascending: false });
    if (error) { logSupabaseError('getWaiversByClient', error); return []; }
    return data || [];
}

export async function getWaiverById(id: string) {
    const supabase = await createClient();
    const { data: waiver, error } = await supabase
        .from('waivers').select('*').eq('id', id).single();
    if (error) { logSupabaseError('getWaiverById', error); return null; }
    const { data: client } = await supabase
        .from('clients').select('id, full_name, mobile_number, email').eq('id', waiver.client_id).single();
    return { ...waiver, clients: client || null };
}

export async function getAllWaivers() {
    const supabase = await createClient();
    const { data: waivers, error } = await supabase
        .from('waivers').select('*').order('signed_at', { ascending: false });
    if (error) { logSupabaseError('getAllWaivers', error); return { data: [], error: 'Unable to load waivers.' }; }
    if (!waivers || waivers.length === 0) return { data: [], error: null };

    const clientIds = [...new Set(waivers.map(w => w.client_id))].filter(Boolean);
    const { data: clients } = await supabase
        .from('clients').select('id, full_name, mobile_number').in('id', clientIds);
    const clientMap = new Map(clients?.map(c => [c.id, c]) || []);
    return { data: waivers.map(w => ({ ...w, clients: clientMap.get(w.client_id) || null })), error: null };
}