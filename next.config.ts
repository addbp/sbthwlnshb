import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
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

export default nextConfig;