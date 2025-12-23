/** @type {import('next').NextConfig} */
const nextConfig = {
  // 启用 standalone 输出模式（用于 Docker）
  output: 'standalone',

  // 生产优化
  reactStrictMode: true,

  // 图片优化
  images: {
    unoptimized: process.env.NODE_ENV === 'production',
  },

  // 环境变量
  env: {
    NEXT_PUBLIC_APP_NAME: 'My Next.js App',
  },
}

module.exports = nextConfig
