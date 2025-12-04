import { SetMetadata } from '@nestjs/common'
import { Action, Resource } from './permissions'

/**
 * 权限元数据键
 */
export const PERMISSION_KEY = 'permission'

/**
 * 权限元数据
 */
export interface PermissionMetadata {
  resource: Resource
  action: Action
}

/**
 * 权限装饰器
 *
 * 用于标记方法需要的权限，配合 Guard 使用
 *
 * @example
 * ```typescript
 * @RequirePermission(Resource.PROJECT, Action.DELETE)
 * async deleteProject(userId: string, projectId: string) {
 *   // 权限检查由 Guard 自动完成
 *   // ...
 * }
 * ```
 */
export const RequirePermission = (resource: Resource, action: Action) =>
  SetMetadata(PERMISSION_KEY, { resource, action } as PermissionMetadata)

/**
 * 组织 Owner 权限装饰器
 */
export const RequireOrganizationOwner = () =>
  SetMetadata(PERMISSION_KEY, {
    resource: Resource.ORGANIZATION,
    action: Action.DELETE,
  } as PermissionMetadata)

/**
 * 项目管理员权限装饰器
 */
export const RequireProjectAdmin = () =>
  SetMetadata(PERMISSION_KEY, {
    resource: Resource.PROJECT,
    action: Action.MANAGE_MEMBERS,
  } as PermissionMetadata)
