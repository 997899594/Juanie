/**
 * 统一权限类型定义
 *
 * 定义系统中所有的权限操作和资源类型
 *
 * @packageDocumentation
 */

// ==================== 权限操作 ====================

/**
 * 权限操作类型
 *
 * 基于 CASL 的操作定义
 */
export const ACTIONS = [
  'manage', // 所有操作（超级权限）
  'create',
  'read',
  'update',
  'delete',
  'deploy',
  'manage_members',
  'manage_settings',
  'manage_teams',
] as const

export type Action = (typeof ACTIONS)[number]

// ==================== 资源类型 ====================

/**
 * 权限资源类型
 *
 * 定义系统中可以被权限控制的资源
 */
export const SUBJECTS = [
  'Project',
  'Environment',
  'Deployment',
  'Organization',
  'Team',
  'Member',
  'all', // 所有资源
] as const

export type Subject = (typeof SUBJECTS)[number]

// ==================== 环境类型 ====================

/**
 * 环境类型
 *
 * 用于基于环境的权限控制
 */
export const ENVIRONMENT_TYPES = ['development', 'staging', 'production', 'testing'] as const

export type EnvironmentType = (typeof ENVIRONMENT_TYPES)[number]

/**
 * 验证环境类型是否有效
 */
export function isValidEnvironmentType(type: string): type is EnvironmentType {
  return ENVIRONMENT_TYPES.includes(type as EnvironmentType)
}

/**
 * 环境类型权重（用于权限控制）
 */
const ENVIRONMENT_TYPE_WEIGHT: Record<EnvironmentType, number> = {
  development: 1,
  testing: 2,
  staging: 3,
  production: 4,
}

/**
 * 判断环境是否为生产环境
 */
export function isProductionEnvironment(type: EnvironmentType): boolean {
  return type === 'production'
}

/**
 * 判断环境是否为非生产环境
 */
export function isNonProductionEnvironment(type: EnvironmentType): boolean {
  return type !== 'production'
}

/**
 * 比较两个环境类型的敏感度
 *
 * @returns 正数表示 type1 更敏感，负数表示 type2 更敏感，0 表示相同
 */
export function compareEnvironmentSensitivity(
  type1: EnvironmentType,
  type2: EnvironmentType,
): number {
  return ENVIRONMENT_TYPE_WEIGHT[type1] - ENVIRONMENT_TYPE_WEIGHT[type2]
}

// ==================== 项目可见性 ====================

/**
 * 项目可见性类型
 */
export const PROJECT_VISIBILITY = ['public', 'internal', 'private'] as const

export type ProjectVisibility = (typeof PROJECT_VISIBILITY)[number]

/**
 * 验证项目可见性是否有效
 */
export function isValidProjectVisibility(visibility: string): visibility is ProjectVisibility {
  return PROJECT_VISIBILITY.includes(visibility as ProjectVisibility)
}

/**
 * 项目可见性说明
 *
 * - public: 公开项目，所有人可见
 * - internal: 内部项目，组织成员可见
 * - private: 私有项目，仅项目成员和团队成员可见
 */
export const PROJECT_VISIBILITY_DESCRIPTIONS: Record<ProjectVisibility, string> = {
  public: '公开 - 所有人可见',
  internal: '内部 - 组织成员可见',
  private: '私有 - 仅成员可见',
}

// ==================== Git 权限级别 ====================

/**
 * Git 平台权限级别
 *
 * 用于映射系统角色到 Git 平台权限
 */
export const GIT_PERMISSIONS = ['read', 'write', 'admin'] as const

export type GitPermission = (typeof GIT_PERMISSIONS)[number]

/**
 * 验证 Git 权限是否有效
 */
export function isValidGitPermission(permission: string): permission is GitPermission {
  return GIT_PERMISSIONS.includes(permission as GitPermission)
}
