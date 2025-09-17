import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.prom.ua',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'crm.h-profit.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
}

export default nextConfig;
