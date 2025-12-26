/**
 * tRPC RBAC 中间件
 *
 * 为 tRPC procedures 提供权限检查功能
 */

import { RbacService } from '@juanie/service-foundation'
import type { Action, Subject } from '@juanie/types'
import { TRPCError } from '@trpc/server'
import type { Context } from './trpc.service'

export interface RequiredAbility {
  action: Action
  subject: Subject
}

/**
 * 创建 RBAC 中间件
 *
 * @param rbacService - RBAC 服务实例
 * @param ability - 需要的权限
 * @returns tRPC 中间件函数
 */
export function createRbacMiddleware(rbacService: RbacService, ability: RequiredAbility) {
  return async ({ ctx, next }: { ctx: Context; next: () => Promise<unknown> }) => {
    // 检查用户是否已认证
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: '未登录',
      })
    }

    // 从 input 中提取 organizationId 和 projectId（如果有）
    const input = ctx.input as Record<string, unknown> | undefined
    const organizationId = input?.organizationId as string | undefined
    const projectId = input?.projectId as string | undefined

    // 检查权限
    const hasPermission = await rbacService.can(
      ctx.user.id,
      ability.action,
      ability.subject,
      organizationId,
      projectId,
    )

    if (!hasPermission) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `无权限执行此操作: ${ability.action} ${ability.subject}`,
      })
    }

    return next()
  }
}

/**
 * 创建带权限检查的 procedure
 *
 * 使用示例：
 * ```typescript
 * const updateProject = withAbility(trpc.protectedProcedure, rbacService, {
 *   action: 'update',
 *   subject: 'Project'
 * })
 *   .input(updateProjectSchema)
 *   .mutation(async ({ ctx, input }) => {
 *     // 权限已检查，可以安全执行
 *   })
 * ```
 */
export function withAbility<T>(
  procedure: T,
  rbacService: RbacService,
  ability: RequiredAbility,
): T {
  // @ts-expect-error - tRPC procedure type is complex
  return procedure.use(createRbacMiddleware(rbacService, ability))
}
