import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PWA will be configured via service worker manually
  // next-pwa has compatibility issues with Turbopack
  turbopack: {},
};

export default nextConfig;
