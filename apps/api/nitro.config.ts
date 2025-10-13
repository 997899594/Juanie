import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineNitroConfig } from 'nitropack/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
      },
      cors: true,
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
    // 私有配置（仅服务端可访问）
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    githubClientId: process.env.GITHUB_CLIENT_ID,
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
    githubRedirectUri: process.env.GITHUB_REDIRECT_URI,
    gitlabClientId: process.env.GITLAB_CLIENT_ID,
    gitlabClientSecret: process.env.GITLAB_CLIENT_SECRET,
    gitlabRedirectUri: process.env.GITLAB_REDIRECT_URI,
    sessionSecret: process.env.SESSION_SECRET,
    csrfSecret: process.env.CSRF_SECRET,

    // 公共配置（客户端也可访问）
    public: {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: process.env.PORT || '3000',
    },
  },

  // 存储配置
  storage: {
    redis: {
      driver: 'redis',
      // 从环境变量读取 Redis URL
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
  },

  // 性能优化
  minify: false,

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
  logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'warn',

  // 插件配置
  plugins: ['./plugins/logger.ts', './plugins/auth.ts', './plugins/otel.ts'],

  // 别名配置
  alias: {
    '~': resolve(__dirname, '.'),
    '@': resolve(__dirname, './src'),
  },

  // 构建配置
  rollupConfig: {
    external: [
      '@juanie/shared',
      // 优雅方案：让 OTel 相关包走 Node 原生加载，避免打包器重写顶层 this
      '@opentelemetry/api',
      '@opentelemetry/sdk-node',
      '@opentelemetry/auto-instrumentations-node',
      '@opentelemetry/exporter-trace-otlp-http',
    ],
    output: {
      sourcemap: process.env.NODE_ENV === 'development',
      inlineDynamicImports: false,
    },
  },

  // 优化输出
  output: {
    dir: '.output',
  },
})
