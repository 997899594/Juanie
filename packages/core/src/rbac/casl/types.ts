import type { MongoAbility } from '@casl/ability'

/**
 * 操作类型
 */
export type Actions =
  | 'manage' // 所有操作
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'deploy'
  | 'manage_members'
  | 'manage_settings'
  | 'manage_teams'

/**
 * 资源类型
 */
export type Subjects =
  | 'Project'
  | 'Environment'
  | 'Deployment'
  | 'Organization'
  | 'Team'
  | 'Member'
  | 'all'

/**
 * 应用权限类型
 */
export type AppAbility = MongoAbility<[Actions, Subjects]>

/**
 * 用户信息（用于权限计算）
 */
export interface AbilityUser {
  id: string
  role?: string
}

/**
 * 组织成员信息
 */
export interface AbilityOrgMember {
  userId: string
  organizationId: string
  role: 'owner' | 'admin' | 'member'
}

/**
 * 项目成员信息
 */
export interface AbilityProjectMember {
  userId: string
  projectId: string
  role: 'owner' | 'maintainer' | 'admin' | 'developer' | 'member' | 'viewer'
}
