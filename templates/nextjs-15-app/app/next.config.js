/** @type {import('next').NextConfig} */
const nextConfig = {
  // 启用 React 19 特性
  experimental: {
    ppr: true, // Partial Prerendering
    reactCompiler: true, // React Compiler
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // 图片优化
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.{{ .appName }}.com',
      },
    ],
  },

  // 性能优化
  compress: true,
  poweredByHeader: false,

  // 日志
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

{
  -
  if
  .enableSentry
}
// Sentry
{
  hideSourceMaps: true, widenClientFileUpload
  : true,
}
,
{
  ;-end
}

// 环境变量
{
  NEXT_PUBLIC_APP_NAME: '{{ .appName }}', NEXT_PUBLIC_APP_URL
  : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:{{ .port }}',
}
,

  // Webpack 配置
  webpack: (config,
{
  isServer
}
) =>
{
  if (!isServer) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }
  }
  return config
}
,
}

{
  -
  if
  .enableSentry
}
// Sentry 配置
const { withSentryConfig } = require('@sentry/nextjs')

module.exports = withSentryConfig(
  nextConfig,
  {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  },
  {
    widenClientFileUpload: true,
    transpileClientSDK: true,
    tunnelRoute: '/monitoring',
    hideSourceMaps: true,
    disableLogger: true,
  },
)
{
  -
  else
}
module.exports = nextConfig
{
  ;-end
}
