import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { Readable } from 'stream'

export async function POST(req: Request) {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File
        const clientName = formData.get('clientName') as string

        if (!file) {
            return NextResponse.json({ error: 'No file attachment provided.' }, { status: 400 })
        }

        // STRICT CHECK: Ensure the Folder ID is loaded from Vercel
        if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
            console.error("CRITICAL ERROR: GOOGLE_DRIVE_FOLDER_ID is missing in environment variables.");
            return NextResponse.json({ error: 'Server misconfiguration: Google Drive Folder ID missing.' }, { status: 500 })
        }

        // 1. Authenticate with Google Cloud Service Account
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // Fixes line breaks from Vercel encryption
            },
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        })

        const drive = google.drive({ version: 'v3', auth })

        // 2. Convert the frontend file arrayBuffer into a Node.js stream for Google Drive
        const buffer = Buffer.from(await file.arrayBuffer())
        const stream = new Readable()
        stream.push(buffer)
        stream.push(null)

        // 3. Format clean file name matching your spa taxonomy
        const fileExt = file.name.split('.').pop()
        const safeName = (clientName || 'guest').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
        const finalFileName = `${safeName}-${Date.now()}.${fileExt}`

        // 4. Upload directly into your shared Sabbath Waivers folder
        const response = await drive.files.create({
            requestBody: {
                name: finalFileName,
                parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
            },
            media: {
                mimeType: file.type,
                body: stream,
            },
            fields: 'id, webViewLink',
            supportsAllDrives: true, // <--- THIS IS THE MAGIC FIX FOR THE QUOTA ERROR
        })

        // Return the secure cloud viewing link to store in your database logs
        return NextResponse.json({
            success: true,
            url: response.data.webViewLink
        })

    } catch (error: any) {
        console.error('Google Drive Server Route Error:', error)
        return NextResponse.json({ error: error.message || 'Drive transfer failed' }, { status: 500 })
    }
}