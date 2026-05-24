// lib/supabase/server.ts
// Server-side Supabase client for Server Components, Route Handlers,
// and Server Actions.
//
// TYPE FIX: setAll's cookiesToSet parameter is explicitly typed using
// CookieOptions imported from @supabase/ssr.  Without the annotation,
// TypeScript strict mode reports "Parameter 'cookiesToSet' implicitly
// has an 'any' type."
//
// NEXT.JS 15: cookies() from 'next/headers' is async — always await it.
// This is different from middleware, which uses request.cookies directly.

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  // In Next.js 15 the cookies() API is asynchronous.
  // Must be awaited before passing to createServerClient.
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // getAll — synchronously read all cookies from the store.
        getAll() {
          return cookieStore.getAll()
        },

        // setAll — write refreshed session cookies back to the response.
        //
        // Explicit type annotation fixes the implicit-any error in strict mode:
        // CookieOptions = Partial<SerializeOptions> from the 'cookie' package,
        // re-exported by @supabase/ssr.
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // This block runs when setAll is called from a Server Component.
            // Server Components are read-only — they cannot set response
            // headers after render has begun.  The error is safe to ignore
            // because the middleware refreshes the session cookie on every
            // request, so no auth state is lost.
          }
        },
      },
    },
  )
}