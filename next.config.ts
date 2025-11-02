import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Ensure proper crypto polyfills for browser
  serverExternalPackages: ['x402-fetch', 'x402'],
};

export default nextConfig;
