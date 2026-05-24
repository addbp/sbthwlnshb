export const env = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
};

if (typeof window === 'undefined') {
  console.log('NEXT_PUBLIC_SUPABASE_URL exists:', !!env.supabase.url);
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY exists:', !!env.supabase.anonKey);
}

export const isSupabaseConfigured = () => {
  return !!env.supabase.url && !!env.supabase.anonKey;
};
