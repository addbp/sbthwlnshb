/**
 * lib/scripts/seed-services.ts
 *
 * Run with:
 *   npx tsx lib/scripts/seed-services.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
}

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ── Service data ───────────────────────────────────────────────────────────
// price defaults to 0 where blank in the original sheet

const services = [
    // Massages
    { service_name: 'SWEDISH', price: 600 },
    { service_name: 'SHIATSU', price: 600 },
    { service_name: 'COMBINATION', price: 750 },
    { service_name: 'SABBATH SIGNATURE', price: 1000 },
    { service_name: 'SABBATH THAI SIGNATURE (60 mins)', price: 700 },
    { service_name: 'SABBATH THAI SIGNATURE (90 mins)', price: 1000 },
    { service_name: 'SABBATH FOOT REFLEX', price: 600 },
    { service_name: 'HAND REFLEX', price: 400 },
    { service_name: 'GROWTH', price: 500 },
    { service_name: 'HEAD, BACK & SHOULDER', price: 400 },
    { service_name: 'HEAD & BACK', price: 500 },
    { service_name: 'SLIMMING MASSAGE', price: 2000 },
    { service_name: 'AROMATHERAPY OIL WITH HERBAL BALL', price: 1000 },
    { service_name: 'BODY SCRUB', price: 2500 },
    { service_name: 'BODY SCRUB W/ MASSAGE', price: 3000 },
    { service_name: 'POST & PRE NATAL W/ LACTATION', price: 2000 },
    { service_name: 'PREMIUM PRIVATE ROOM', price: 1500 },
    { service_name: 'HANDMASSAGE', price: 300 },
    { service_name: 'ADDITIONAL 30 MINS', price: 300 },
    { service_name: 'COMBINATION W/ HOT STONE', price: 1250 },
    { service_name: 'SABBATH SIGNATURE FOOT, HEAD, NECK & SHOULDER', price: 750 },
    { service_name: 'TRADITIONAL HILOT WITH VENTOSA', price: 1500 },
    { service_name: 'SCALP MASSAGE', price: 300 },

    // Nail services
    { service_name: 'MANICURE', price: 150 },
    { service_name: 'REGULAR POLISH', price: 50 },
    { service_name: 'PEDICURE', price: 200 },
    { service_name: 'FOOT SPA', price: 350 },
    { service_name: 'FOOT MASSAGE', price: 350 },
    { service_name: 'FOOT PARAFFIN', price: 500 },
    { service_name: 'HAND PARAFFIN', price: 400 },
    { service_name: 'MANIGEL ORLY', price: 600 },
    { service_name: 'MANIGEL CUCCIO', price: 450 },
    { service_name: 'PEDIGEL ORLY', price: 700 },
    { service_name: 'PEDIGEL CUCCIO', price: 550 },
    { service_name: 'NAIL GEL REMOVAL', price: 150 },
    { service_name: 'SOFT GEL', price: 0 }, // no price in sheet
    { service_name: 'SOFT GEL NAIL EXTENSION', price: 800 },
    { service_name: 'FULL SET BASIC NAIL ART', price: 400 },
    { service_name: '3D GEL NAIL ART / EMBOSSED', price: 600 },
    { service_name: 'NAIL GEL REMOVER', price: 150 },
    { service_name: 'SOFT GEL REMOVER', price: 300 },
    { service_name: 'Rhinestones', price: 100 },
    { service_name: 'Gel Polish', price: 100 },

    // Add-ons
    { service_name: 'ACCENT', price: 200 },
    { service_name: 'POLISH', price: 50 },
    { service_name: 'NAIL ART', price: 300 },
    { service_name: 'GEL REMOVAL', price: 150 },
    { service_name: 'THERAPIST REQUEST', price: 100 },

    // Waxing
    { service_name: 'BRAZILLIAN WAX', price: 1000 },
    { service_name: 'WAX', price: 400 },
    { service_name: 'UPPER LIP FEMALE', price: 100 },
    { service_name: 'UPPER LIP MALE', price: 150 },
    { service_name: 'UNDERARMS FEMALE', price: 200 },
    { service_name: 'UNDERARMS MALE', price: 300 },
    { service_name: 'ARMS FEMALE', price: 250 },
    { service_name: 'ARMS MALE', price: 300 },
    { service_name: 'HALF LEGS FEMALE', price: 350 },
    { service_name: 'HALF LEGS MALE', price: 380 },
    { service_name: 'FULL LEGS FEMALE', price: 450 },
    { service_name: 'FULL LEGS MALE', price: 480 },
    { service_name: 'FULL BODY FEMALE', price: 1800 },
    { service_name: 'FULL BODY MALE', price: 2000 },

    // Packages
    { service_name: 'PACKAGE A', price: 600 },
    { service_name: 'PACKAGE B', price: 950 },
    { service_name: 'PACKAGE C', price: 700 },
    { service_name: 'PACKAGE D', price: 1050 },
    { service_name: 'PACKAGE E', price: 950 },
    { service_name: 'PACKAGE F', price: 1250 },
    { service_name: 'SABBATH PACKAGE 1', price: 2000 },
    { service_name: 'SABBATH PACKAGE 1 w/ comb', price: 2150 },
    { service_name: 'SABBATH PACKAGE 2', price: 3000 },
    { service_name: 'SABBATH PACKAGE 1 W/ ventosa', price: 3000 },
    { service_name: 'SABBATH PACKAGE 1 w/ Sabbath Massage', price: 2400 },
    { service_name: 'SABBATH PACKAGE 1 w/ SWD', price: 2500 },

    // Spa facilities
    { service_name: 'SAUNA', price: 1000 },
    { service_name: 'SHOWER', price: 200 },
    { service_name: 'JACUZZI', price: 1000 },

    // Gift certificates & memberships
    { service_name: 'GIFT CERTIFICATE (10+1)', price: 18000 },
    { service_name: 'GIFT CERTIFICATE CUSTOM', price: 26500 },
    { service_name: 'Platinum Membership', price: 18000 },

    // Retail
    { service_name: 'SLIPPERS', price: 210 },
]

// ── Seed function ──────────────────────────────────────────────────────────

async function seed() {
    console.log('🗑️  Deleting all existing services...')

    const { error: deleteError } = await supabase
        .from('services')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // delete all rows

    if (deleteError) {
        console.error('❌ Failed to delete services:', JSON.stringify(deleteError, null, 2), deleteError)
        process.exit(1)
    }

    console.log('✅ Services table cleared.')
    console.log(`⏳ Inserting ${services.length} services...`)

    const { data, error: insertError } = await supabase
        .from('services')
        .insert(services)
        .select()

    if (insertError) {
        console.error('❌ Failed to insert services:', JSON.stringify(insertError, null, 2), insertError)
        process.exit(1)
    }

    console.log(`✅ Successfully seeded ${data?.length ?? 0} services.`)
}

seed()