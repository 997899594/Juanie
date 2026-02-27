import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 生产环境 standalone 输出 (用于 Docker)
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // 日志优化
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;
