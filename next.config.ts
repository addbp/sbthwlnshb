const nextConfig: any = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'wsrv.nl',
      },
      {
        protocol: 'https',
        hostname: 'sabbathspa.com',
      },
      {
        protocol: 'https',
        hostname: 'drive.google.com',
      }
    ],
  },
};

// DEMO MODE: with NEXT_PUBLIC_DEMO_MODE=1 in .env.local, swap the Supabase
// packages for an in-memory fake with sample data (see lib/supabase/demo).
// Never set this in production.
if (process.env.NEXT_PUBLIC_DEMO_MODE === '1') {
  nextConfig.turbopack = {
    resolveAlias: {
      '@supabase/supabase-js': './lib/supabase/demo/supabase-js.ts',
      '@supabase/ssr': './lib/supabase/demo/ssr.ts',
    },
  };
}

export default nextConfig;