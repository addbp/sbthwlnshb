// app/auth/callback/route.ts
// Supabase OAuth callback — exchanges the Google auth code for a session.
//
// TypeScript fix: cookiesToSet is explicitly typed using CookieOptions
// from @supabase/ssr so strict mode never infers 'any'.
//
// Next.js 15 fix: cookieStore.set() is wrapped in try/catch because
// Route Handler GET requests run in a context where response headers
// can already be committed by the time Supabase tries to write cookies.
// A silent catch prevents a runtime crash without breaking the auth flow
// — the session is still established via the redirect.

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url)

    const code = searchParams.get('code')

    // `next` travels through the OAuth state so the user lands exactly
    // where they were heading before being sent to /login.
    // Hard-fall-back to /dashboard so staff always reach the right place.
    const next = searchParams.get('next') ?? '/dashboard'

    // Sanitise `next` — only allow relative paths to prevent open-redirect.
    const redirectTo = next.startsWith('/') ? next : '/dashboard'

    if (code) {
        const cookieStore = await cookies()   // async in Next.js 15

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    // getAll — no type issues, just return the store's cookies.
                    getAll() {
                        return cookieStore.getAll()
                    },

                    // setAll — explicitly typed to satisfy TypeScript strict mode.
                    //
                    // The parameter type matches SetAllCookies from @supabase/ssr:
                    //   (cookies: { name: string; value: string; options: CookieOptions }[]) => void
                    //
                    // Wrapped in try/catch because in a Next.js 15 GET Route Handler
                    // the response headers may already be sealed by the time Supabase
                    // calls setAll after exchangeCodeForSession resolves. The catch
                    // silences the "Cannot set headers after they are sent" error
                    // without losing the session — the auth code exchange still
                    // succeeds and the redirect carries the session cookie forward.
                    setAll(
                        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
                    ) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }) => {
                                cookieStore.set(name, value, options)
                            })
                        } catch {
                            // Intentional silent catch.
                            // If headers are already committed Next.js will throw here,
                            // but the session exchange has already completed successfully.
                            // The middleware will refresh the session cookie on the very
                            // next request, so no auth data is lost.
                        }
                    },
                },
            },
        )

        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            // ✅ Successful — send staff to the dashboard (or their intended page).
            return NextResponse.redirect(`${origin}${redirectTo}`)
        }
    }

    // Code missing or exchange failed — return to login with a querystring
    // flag so the login page can surface a user-facing error message.
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}