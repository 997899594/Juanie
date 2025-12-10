import { SetMetadata } from '@nestjs/common'
import type { Actions, Subjects } from './types'

export const CHECK_ABILITY_KEY = 'check_ability'

/**
 * 权限要求定义
 */
export interface RequiredRule {
  action: Actions
  subject: Subjects
  conditions?: any
}

/**
 * 检查权限装饰器
 *
 * 用于在 Controller 方法上声明权限要求
 *
 * @example
 * ```typescript
 * @CheckAbility({ action: 'create', subject: 'Project' })
 * @Post()
 * async createProject() {
 *   // ...
 * }
 * ```
 */
export const CheckAbility = (...rules: RequiredRule[]) => SetMetadata(CHECK_ABILITY_KEY, rules)

/**
 * 快捷装饰器：检查创建权限
 */
export const CanCreate = (subject: Subjects, conditions?: any) =>
  CheckAbility({ action: 'create', subject, conditions })

/**
 * 快捷装饰器：检查读取权限
 */
export const CanRead = (subject: Subjects, conditions?: any) =>
  CheckAbility({ action: 'read', subject, conditions })

/**
 * 快捷装饰器：检查更新权限
 */
export const CanUpdate = (subject: Subjects, conditions?: any) =>
  CheckAbility({ action: 'update', subject, conditions })

/**
 * 快捷装饰器：检查删除权限
 */
export const CanDelete = (subject: Subjects, conditions?: any) =>
  CheckAbility({ action: 'delete', subject, conditions })

/**
 * 快捷装饰器：检查部署权限
 */
export const CanDeploy = (subject: Subjects, conditions?: any) =>
  CheckAbility({ action: 'deploy', subject, conditions })

/**
 * 快捷装饰器：检查管理成员权限
 */
export const CanManageMembers = (subject: Subjects, conditions?: any) =>
  CheckAbility({ action: 'manage_members', subject, conditions })
