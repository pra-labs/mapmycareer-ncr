import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '192.168.1.31',
    'localhost:3001',
    '192.168.1.31:3001',
    '127.0.0.1:3001',
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
