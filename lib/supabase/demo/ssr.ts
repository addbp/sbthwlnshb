// lib/supabase/demo/ssr.ts
// DEMO MODE ONLY — stands in for '@supabase/ssr' (aliased in next.config.ts).

import { createDemoClient } from './engine'

export type CookieOptions = Record<string, any>

export function createBrowserClient(..._args: any[]): any {
  return createDemoClient()
}

export function createServerClient(..._args: any[]): any {
  return createDemoClient()
}
