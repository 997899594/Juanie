import 'reflect-metadata'
import { getAppContainer, initNestAppContainer } from '../nest'

/**
 * 创建 tRPC 上下文
 * @param opts 请求选项
 * @returns tRPC 上下文对象
 */
export async function createContext(opts: { req?: any; res?: any }) {
  await initNestAppContainer()

  const { healthService, trpcService, databaseService, authService } = getAppContainer()

  const authHeader: string | undefined = opts.req?.headers?.authorization

  return {
    healthService,
    trpcService,
    databaseService,
    authService,

    // 请求态
    req: opts.req,
    res: opts.res,
    authHeader,
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>
