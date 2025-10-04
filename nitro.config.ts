import { defineNitroConfig } from 'nitropack/config'

export default defineNitroConfig({
  // 兼容性日期
  compatibilityDate: '2025-01-05',
  
  // 服务器预设
  preset: 'node-server',
  
  // 开发服务器配置
  devServer: {
    watch: ['src/**/*', 'routes/**/*'],
  },

  // 路由规则 - 缓存和CORS配置
  routeRules: {
    // 健康检查端点 - 短缓存
    '/health/**': {
      headers: {
        'Cache-Control': 'public, max-age=60',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    },
    
    // tRPC API端点 - 无缓存，启用CORS
    '/trpc/**': {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400',
      },
      cors: true,
    },
    
    // OpenAPI文档 - 长缓存
    '/openapi.json': {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Content-Type': 'application/json',
      },
    },
    
    // API面板 - 短缓存
    '/panel/**': {
      headers: {
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
      },
    },
    
    // 静态资源 - 长缓存
    '/assets/**': {
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    },
  },

  // 实验性功能
  experimental: {
    wasm: true,
  },

  // 运行时配置
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    redisUrl: process.env.REDIS_URL,
    apiBase: process.env.API_BASE || 'http://localhost:3001',
  },

  // 存储配置
  storage: {
    redis: {
      driver: 'redis',
      // 连接配置将从环境变量读取
    },
  },

  // 性能优化
  minify: true,
  
  // 压缩配置
  compressPublicAssets: {
    gzip: true,
    brotli: true,
  },

  // 错误处理 - 禁用Vue错误页面
  errorHandler: '~/error.ts',

  // TypeScript配置
  typescript: {
    strict: true,
  },

  // 日志配置
  logLevel: process.env.NODE_ENV === 'development' ? 'info' : 'warn',

  // 插件配置
  plugins: [
    // 可以在这里添加Nitro插件
  ],

  // 别名配置
  alias: {
    '~': '.',
    '@': './src',
  },

  // 构建配置
  rollupConfig: {
    external: [
      // 排除一些可能导致构建问题的包
      'fsevents',
      'lightningcss',
    ],
  },
})
