import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File
        const clientName = formData.get('clientName') as string

        if (!file) {
            return NextResponse.json({ error: 'No file attachment provided.' }, { status: 400 })
        }

        // 1. Authenticate directly with your existing Supabase project
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        // 2. Format a clean, secure file name matching the client
        const fileExt = file.name.split('.').pop() || 'png'
        const safeName = (clientName || 'guest').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
        const finalFileName = `${safeName}-${Date.now()}.${fileExt}`

        // 3. Convert the frontend file into a Buffer for Supabase
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // 4. Upload straight into your new Supabase 'waivers' bucket
        const { error } = await supabase.storage
            .from('waivers')
            .upload(finalFileName, buffer, {
                contentType: file.type,
                upsert: false
            })

        if (error) {
            throw new Error(`Supabase Storage Error: ${error.message}`)
        }

        // 5. Retrieve the public URL to save securely into your database
        const { data: urlData } = supabase.storage
            .from('waivers')
            .getPublicUrl(finalFileName)

        // Return the link seamlessly to the frontend
        return NextResponse.json({
            success: true,
            url: urlData.publicUrl
        })

    } catch (error: any) {
        console.error('Supabase Upload Route Error:', error)
        return NextResponse.json({ error: error.message || 'File transfer failed' }, { status: 500 })
    }
}