/**
 * 统一角色定义
 *
 * 这是系统中所有角色的唯一真相来源
 * 所有角色定义必须与 Database Schema 严格匹配
 *
 * @packageDocumentation
 */

// ==================== 组织角色 ====================

/**
 * 组织成员角色
 *
 * @see packages/database/src/schemas/organization/organization-members.schema.ts
 */
export const ORGANIZATION_ROLES = ['owner', 'admin', 'member'] as const

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number]

/**
 * 组织角色权限说明
 *
 * - owner: 组织所有者，完全控制权（包括删除组织）
 * - admin: 组织管理员，管理权限但不能删除组织
 * - member: 普通成员，只读权限
 */
export const ORGANIZATION_ROLE_DESCRIPTIONS: Record<OrganizationRole, string> = {
  owner: '组织所有者 - 完全控制权',
  admin: '组织管理员 - 管理权限',
  member: '普通成员 - 只读权限',
}

// ==================== 项目角色 ====================

/**
 * 项目成员角色
 *
 * @see packages/database/src/schemas/project/project-members.schema.ts
 */
export const PROJECT_ROLES = ['owner', 'maintainer', 'developer', 'viewer'] as const

export type ProjectRole = (typeof PROJECT_ROLES)[number]

/**
 * 项目角色权限说明
 *
 * - owner: 项目所有者，完全控制权（包括删除项目）
 * - maintainer: 项目维护者，管理权限但不能删除项目
 * - developer: 开发者，读写和部署权限（仅非生产环境）
 * - viewer: 查看者，只读权限
 */
export const PROJECT_ROLE_DESCRIPTIONS: Record<ProjectRole, string> = {
  owner: '项目所有者 - 完全控制权',
  maintainer: '项目维护者 - 管理权限',
  developer: '开发者 - 读写和部署（非生产）',
  viewer: '查看者 - 只读权限',
}

// ==================== 团队角色 ====================

/**
 * 团队成员角色
 *
 * @see packages/database/src/schemas/organization/team-members.schema.ts
 */
export const TEAM_ROLES = ['owner', 'maintainer', 'member'] as const

export type TeamRole = (typeof TEAM_ROLES)[number]

/**
 * 团队角色权限说明
 *
 * - owner: 团队所有者，完全控制权
 * - maintainer: 团队维护者，管理权限
 * - member: 普通成员，基本权限
 */
export const TEAM_ROLE_DESCRIPTIONS: Record<TeamRole, string> = {
  owner: '团队所有者 - 完全控制权',
  maintainer: '团队维护者 - 管理权限',
  member: '普通成员 - 基本权限',
}

// ==================== 角色验证函数 ====================

/**
 * 验证组织角色是否有效
 */
export function isValidOrganizationRole(role: string): role is OrganizationRole {
  return ORGANIZATION_ROLES.includes(role as OrganizationRole)
}

/**
 * 验证项目角色是否有效
 */
export function isValidProjectRole(role: string): role is ProjectRole {
  return PROJECT_ROLES.includes(role as ProjectRole)
}

/**
 * 验证团队角色是否有效
 */
export function isValidTeamRole(role: string): role is TeamRole {
  return TEAM_ROLES.includes(role as TeamRole)
}

// ==================== 角色比较函数 ====================

/**
 * 项目角色权重（用于权限比较）
 */
const PROJECT_ROLE_WEIGHT: Record<ProjectRole, number> = {
  owner: 4,
  maintainer: 3,
  developer: 2,
  viewer: 1,
}

/**
 * 比较两个项目角色的权限级别
 *
 * @returns 正数表示 role1 权限更高，负数表示 role2 权限更高，0 表示相同
 */
export function compareProjectRoles(role1: ProjectRole, role2: ProjectRole): number {
  return PROJECT_ROLE_WEIGHT[role1] - PROJECT_ROLE_WEIGHT[role2]
}

/**
 * 获取两个项目角色中权限更高的角色
 */
export function getHigherProjectRole(role1: ProjectRole, role2: ProjectRole): ProjectRole {
  return compareProjectRoles(role1, role2) >= 0 ? role1 : role2
}

// ==================== 团队角色到项目角色映射 ====================

/**
 * 将团队成员角色映射为项目角色
 *
 * 用于计算团队成员通过团队访问项目时的权限
 *
 * 映射规则：
 * - team owner/maintainer → project maintainer
 * - team member → project developer
 */
export function mapTeamRoleToProjectRole(teamRole: TeamRole): ProjectRole {
  switch (teamRole) {
    case 'owner':
    case 'maintainer':
      return 'maintainer'
    case 'member':
      return 'developer'
  }
}
