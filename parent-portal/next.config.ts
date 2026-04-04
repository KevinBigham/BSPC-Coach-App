import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Firebase hosting compatible
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
