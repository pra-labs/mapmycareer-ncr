import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'localhost',
    'localhost:3000',
    'localhost:3001',
    '127.0.0.1',
    '127.0.0.1:3000',
    '127.0.0.1:3001',
    '192.168.1.39',
    '192.168.1.39:3000',
    '192.168.1.31',
    '192.168.1.31:3001',
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
