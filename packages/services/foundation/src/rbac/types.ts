/**
 * RBAC 类型定义
 *
 * @packageDocumentation
 */

import type { MongoAbility } from '@casl/ability'
import type { Action, EnvironmentType } from '@juanie/types'

/**
 * 部署权限检查对象
 *
 * 用于检查用户是否有权限部署到特定环境
 */
export interface DeploymentPermissionCheck {
  environmentId: string
  environmentType: EnvironmentType
  projectId: string
}

/**
 * Subject 类型（包含具体对象类型）
 */
export type Subjects =
  | 'Project'
  | 'Environment'
  | 'Organization'
  | 'Team'
  | 'Member'
  | 'Deployment'
  | DeploymentPermissionCheck // ✅ 添加具体对象类型
  | 'all'

/**
 * 应用权限类型
 *
 * 基于 CASL 的 MongoAbility
 */
export type AppAbility = MongoAbility<[Action, Subjects]>
