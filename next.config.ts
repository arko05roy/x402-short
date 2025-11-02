import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // Ensure proper crypto polyfills for browser
    serverComponentsExternalPackages: ['x402-fetch', 'x402'],
  },
};

export default nextConfig;
