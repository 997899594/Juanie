/**
 * 这个文件用于测试 tRPC 类型推导是否正常工作
 * 前端可以这样使用
 */

import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from './trpc/trpc.router'

// 导出类型供前端使用
export type { AppRouter }

// 推导所有输入类型
export type RouterInputs = inferRouterInputs<AppRouter>

// 推导所有输出类型
export type RouterOutputs = inferRouterOutputs<AppRouter>

// 测试：验证类型推导是否正常
type TestAuthInputs = RouterInputs['auth']['githubCallback']
// 应该推导为: { code: string; state: string }

type TestAuthOutputs = RouterOutputs['auth']['githubCallback']
// 应该推导为: { user: { id: string; email: string; ... }; sessionId: string }

type TestHealthOutput = RouterOutputs['health']
// 应该推导为: { status: string; timestamp: string }

// 前端使用示例（伪代码）:
/*
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '@juanie/api-gateway/types'

const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3001/trpc',
    }),
  ],
})

// 完全类型安全的调用
const result = await trpc.auth.githubCallback.mutate({
  code: 'xxx',
  state: 'yyy',
})

// result 的类型会自动推导为:
// {
//   user: {
//     id: string
//     email: string
//     username: string | null
//     displayName: string | null
//     avatarUrl: string | null
//   }
//   sessionId: string
// }

// TypeScript 会提示所有可用的方法和属性
console.log(result.user.email) // ✅ 类型安全
console.log(result.user.xxx)   // ❌ TypeScript 错误
*/
