'use server';

import { createClient } from '@/lib/supabase/server';

export async function getProducts() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('products')
        .select('id, name, price, category')
        .order('name');
    if (error) {
        console.error('Error fetching products:', error);
        return [];
    }
    return data;
}

export async function addBookingProducts(
    bookingId: string,
    items: { product_id: string; quantity: number; unit_price: number }[]
) {
    const supabase = await createClient();
    const rows = items.map(item => ({
        booking_id: bookingId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
    }));
    const { error } = await supabase.from('booking_products').insert(rows);
    if (error) {
        console.error('Error inserting booking_products:', error);
        throw new Error('Failed to save food/drink items.');
    }
}

export async function getBookingProducts(bookingId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('booking_products')
        .select('id, quantity, unit_price, products(id, name, category)')
        .eq('booking_id', bookingId);
    if (error) {
        console.error('Error fetching booking products:', error);
        return [];
    }
    return data;
}