import type { NextConfig } from 'next';

const nonRuntimeTraceExcludes = [
  './archive/**/*',
  './config/**/*',
  './deploy/**/*',
  './docs/**/*',
  './interview-prep/**/*',
  './migrations/**/*',
  './scripts/**/*',
  './templates/**/*',
  './tmp/**/*',
  './*.json',
  './*.lock',
  './*.md',
  './*.mjs',
  './*.png',
  './*.ts',
  './*.yml',
  './*.html',
  './Dockerfile',
];

const nextConfig: NextConfig = {
  // 生产环境 standalone 输出 (用于 Docker)
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  serverExternalPackages: ['@kubernetes/client-node'],
  outputFileTracingExcludes: {
    '/**': nonRuntimeTraceExcludes,
  },

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
