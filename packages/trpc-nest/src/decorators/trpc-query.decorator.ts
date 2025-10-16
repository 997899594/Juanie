import { TrpcProcedure, type TrpcProcedureOptions } from './trpc-procedure.decorator.js'

/**
 * tRPC 查询装饰器
 * 用于标记一个方法作为 tRPC 查询过程
 * 
 * @param options 过程配置选项
 * 
 * @example
 * ```typescript
 * @TrpcRouter()
 * @Injectable()
 * export class UserRouter {
 *   @TrpcQuery({ 
 *     input: z.object({ id: z.string() }),
 *     output: z.object({ id: z.string(), name: z.string() })
 *   })
 *   async getUser(@Input() input: { id: string }) {
 *     return { id: input.id, name: 'John Doe' }
 *   }
 * 
 *   @TrpcQuery({ requireAuth: true })
 *   async getCurrentUser() {
 *     return { id: '1', name: 'Current User' }
 *   }
 * }
 * ```
 */
export function TrpcQuery(options: TrpcProcedureOptions = {}): MethodDecorator {
  return TrpcProcedure('query', options)
}

/**
 * tRPC 查询装饰器的简化版本，用于不需要额外配置的查询
 * 
 * @example
 * ```typescript
 * @Query()
 * async getUsers() {
 *   return [{ id: '1', name: 'John' }]
 * }
 * ```
 */
export function Query(options: TrpcProcedureOptions = {}): MethodDecorator {
  return TrpcQuery(options)
}