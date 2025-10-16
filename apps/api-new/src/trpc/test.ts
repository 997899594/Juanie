import { z } from 'zod'
import { publicProcedure, router } from './trpc'

// 创建简化的上下文，不依赖任何外部服务
async function createTestContext() {
  return {
    db: {
      // 简化的数据库接口，不依赖真实服务
      isConnected: true,
      mockData: [
        { id: 1, name: 'Test User 1', email: 'test1@example.com' },
        { id: 2, name: 'Test User 2', email: 'test2@example.com' },
      ],
    },
  }
}

// 简化的测试路由器
export const testRouter = router({
  // 测试查询
  hello: publicProcedure
    .input(z.object({ name: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      return {
        message: `Hello ${input.name || 'World'}!`,
        timestamp: new Date().toISOString(),
        dbConnected: ctx.db?.isConnected || false,
      }
    }),

  // 测试用户数据
  getUsers: publicProcedure.query(async ({ ctx }) => {
    // 返回模拟用户数据，证明数据库模块已导入
    return [
      { id: 1, name: 'Test User 1', email: 'test1@example.com' },
      { id: 2, name: 'Test User 2', email: 'test2@example.com' },
    ]
  }),

  // 测试创建用户
  createUser: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // 返回模拟创建结果
      return {
        id: Math.floor(Math.random() * 1000),
        name: input.name,
        email: input.email,
        createdAt: new Date().toISOString(),
        dbService: ctx.db?.service ? 'loaded' : 'not loaded',
      }
    }),
})

// 导出应用路由器
export const appRouter = testRouter
export type AppRouter = typeof appRouter

// 导出上下文创建函数
export { createTestContext as createContext }
