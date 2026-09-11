import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/bff/:path*',
        destination: `${process.env.CONSOLE_API_URL ?? 'http://localhost:3005'}/:path*`,
      },
    ];
  },
};

export default nextConfig;
