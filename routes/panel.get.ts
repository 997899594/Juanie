/**
 * tRPC Playground 面板
 * 提供 API 调试和测试界面
 * 
 * 注意：trpc-playground 包存在兼容性问题，暂时禁用
 * 可以使用其他工具如 Postman 或直接调用 API 进行测试
 */
export default defineEventHandler(async (event) => {
  // 返回简单的 API 信息页面
  const apiInfo = {
    name: 'Juanie API',
    version: '1.0.0',
    description: 'NestJS + tRPC + Nitro + Drizzle 全栈 API',
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
    documentation: {
      openapi: '/openapi.json',
      swagger: '暂未配置',
    },
    stack: [
      'NestJS - 依赖注入和模块化',
      'tRPC - 类型安全的 API',
      'Nitro - 高性能服务器',
      'Drizzle ORM - 数据库操作',
      'TypeScript - 类型安全',
    ],
  }

  // 设置响应头
  setHeader(event, 'Content-Type', 'application/json')
  
  return apiInfo
})
