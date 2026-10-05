// lib/supabase/demo/supabase-js.ts
// DEMO MODE ONLY — stands in for '@supabase/supabase-js' (aliased in next.config.ts).

import { createDemoClient } from './engine'

export type SupabaseClient = any

export function createClient(..._args: any[]): any {
  return createDemoClient()
}
