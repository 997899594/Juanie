import type { inferAsyncReturnType } from '@trpc/server'
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import { initNestAppContainer } from '../nest'

/**
 * 创建 tRPC 上下文
 * 初始化 NestJS 容器并提供服务访问
 */
export async function createContext({ req, resHeaders }: FetchCreateContextFnOptions) {
  // 初始化 NestJS 容器
  const container = await initNestAppContainer()

  return {
    req,
    resHeaders,
    // 服务定位器模式 - 从容器中获取服务
    authService: container.authService,
    databaseService: container.databaseService,
    healthService: container.healthService,
    gitService: container.gitService,
    trpcService: container.trpcService,
  }
}

export type Context = inferAsyncReturnType<typeof createContext>
