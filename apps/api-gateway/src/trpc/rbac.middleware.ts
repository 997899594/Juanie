/**
 * tRPC RBAC 辅助函数
 *
 * ✅ 官方推荐方案：在 resolver 内部检查权限
 *
 * tRPC 中间件在 .input() 之前执行，无法访问已解析的 input
 * 因此权限检查应该在 query/mutation 内部进行
 */

import { RbacService } from '@juanie/service-foundation'
import type { Action, Subject } from '@juanie/types'
import { TRPCError } from '@trpc/server'

/**
 * 检查用户权限（在 resolver 内部调用）
 *
 * @param rbacService - RBAC 服务实例
 * @param userId - 用户 ID
 * @param action - 操作
 * @param subject - 资源
 * @param organizationId - 组织 ID（可选）
 * @param projectId - 项目 ID（可选）
 * @throws TRPCError - 如果无权限
 */
export async function checkPermission(
  rbacService: RbacService,
  userId: string,
  action: Action,
  subject: Subject,
  organizationId?: string,
  projectId?: string,
): Promise<void> {
  const hasPermission = await rbacService.can(userId, action, subject, organizationId, projectId)

  if (!hasPermission) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `无权限执行此操作: ${action} ${subject}`,
    })
  }
}
