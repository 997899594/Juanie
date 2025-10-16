import { TrpcProcedure, type TrpcProcedureOptions } from './trpc-procedure.decorator.js'

/**
 * tRPC 变更装饰器
 * 用于标记一个方法作为 tRPC 变更过程
 * 
 * @param options 过程配置选项
 * 
 * @example
 * ```typescript
 * @TrpcRouter()
 * @Injectable()
 * export class UserRouter {
 *   @TrpcMutation({ 
 *     input: z.object({ 
 *       name: z.string(),
 *       email: z.string().email()
 *     }),
 *     output: z.object({ 
 *       id: z.string(), 
 *       name: z.string(), 
 *       email: z.string() 
 *     }),
 *     requireAuth: true
 *   })
 *   async createUser(@Input() input: { name: string; email: string }) {
 *     return { 
 *       id: '1', 
 *       name: input.name, 
 *       email: input.email 
 *     }
 *   }
 * 
 *   @TrpcMutation({ 
 *     requireAuth: true,
 *     permissions: ['user:update']
 *   })
 *   async updateUser(@Input() input: { id: string; name?: string }) {
 *     return { id: input.id, name: input.name || 'Updated User' }
 *   }
 * }
 * ```
 */
export function TrpcMutation(options: TrpcProcedureOptions = {}): MethodDecorator {
  return TrpcProcedure('mutation', options)
}

/**
 * tRPC 变更装饰器的简化版本，用于不需要额外配置的变更
 * 
 * @example
 * ```typescript
 * @Mutation()
 * async deleteUser(@Input() input: { id: string }) {
 *   return { success: true }
 * }
 * ```
 */
export function Mutation(options: TrpcProcedureOptions = {}): MethodDecorator {
  return TrpcMutation(options)
}