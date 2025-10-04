export default defineEventHandler(async (event) => {
  // 设置响应头
  setHeader(event, 'Content-Type', 'application/json')
  setHeader(event, 'Cache-Control', 'public, max-age=300')

  const baseUrl = getRequestURL(event).origin

  return {
    name: 'Juanie API',
    version: '1.0.0',
    description: 'NestJS + tRPC + Nitro + Drizzle 全栈 API',
    status: 'running',
    timestamp: new Date().toISOString(),
    links: {
      health: `${baseUrl}/health`,
      docs: `${baseUrl}/docs`,
      panel: `${baseUrl}/panel`,
      trpc: `${baseUrl}/trpc`,
    },
    endpoints: {
      health: {
        check: 'GET /trpc/health.check',
        ping: 'GET /trpc/health.ping',
        metrics: 'GET /trpc/health.metrics',
        database: 'GET /trpc/health.database',
        ready: 'GET /trpc/health.ready',
      },
      auth: {
        register: 'POST /trpc/auth.register',
        login: 'POST /trpc/auth.login',
        verify: 'POST /trpc/auth.verify',
        me: 'GET /trpc/auth.me',
        updateProfile: 'PUT /trpc/auth.updateProfile',
        changePassword: 'PUT /trpc/auth.changePassword',
        logout: 'POST /trpc/auth.logout',
      },
    },
    stack: [
      'NestJS - 依赖注入和模块化',
      'tRPC - 类型安全的 API',
      'Nitro - 高性能服务器',
      'Drizzle ORM - 数据库操作',
      'TypeScript - 类型安全',
    ],
  }
})