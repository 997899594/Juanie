/**
 * Git 平台权限映射工具
 *
 * 负责在平台角色和 Git 平台权限之间进行映射
 */

import type { GitProvider } from '@juanie/types'

/**
 * 项目成员角色
 */
export type ProjectRole = 'owner' | 'maintainer' | 'developer' | 'viewer'

/**
 * 组织成员角色
 */
export type OrganizationRole = 'owner' | 'admin' | 'member' | 'billing'

/**
 * Git 权限级别
 */
export type GitPermission = 'read' | 'write' | 'admin'

/**
 * GitLab 访问级别
 * @see https://docs.gitlab.com/ee/api/members.html#valid-access-levels
 */
export enum GitLabAccessLevel {
  NoAccess = 0,
  MinimalAccess = 5,
  Guest = 10,
  Reporter = 20,
  Developer = 30,
  Maintainer = 40,
  Owner = 50,
}

/**
 * GitHub 仓库权限
 * @see https://docs.github.com/en/rest/collaborators/collaborators
 */
export enum GitHubRepositoryPermission {
  Read = 'read',
  Triage = 'triage',
  Write = 'write',
  Maintain = 'maintain',
  Admin = 'admin',
}

/**
 * GitHub 组织角色
 * @see https://docs.github.com/en/rest/orgs/members
 */
export enum GitHubOrganizationRole {
  Member = 'member',
  Admin = 'admin',
}

/**
 * 将项目角色映射为 Git 权限
 *
 * @param role - 项目角色
 * @returns Git 权限级别
 *
 * @example
 * ```typescript
 * mapProjectRoleToGitPermission('owner') // 'admin'
 * mapProjectRoleToGitPermission('developer') // 'write'
 * mapProjectRoleToGitPermission('viewer') // 'read'
 * ```
 */
export function mapProjectRoleToGitPermission(role: ProjectRole): GitPermission {
  switch (role) {
    case 'owner':
    case 'maintainer':
      return 'admin'
    case 'developer':
      return 'write'
    case 'viewer':
      return 'read'
    default:
      // 默认只读权限
      return 'read'
  }
}

/**
 * 将组织角色映射为 Git 权限
 *
 * @param role - 组织角色
 * @returns Git 权限级别
 *
 * @example
 * ```typescript
 * mapOrgRoleToGitPermission('owner') // 'admin'
 * mapOrgRoleToGitPermission('admin') // 'admin'
 * mapOrgRoleToGitPermission('member') // 'write'
 * ```
 */
export function mapOrgRoleToGitPermission(role: OrganizationRole): GitPermission {
  switch (role) {
    case 'owner':
    case 'admin':
      return 'admin'
    case 'member':
      return 'write'
    case 'billing':
      // billing 角色通常只需要读取权限
      return 'read'
    default:
      return 'read'
  }
}

/**
 * 将 Git 权限映射为 GitLab 访问级别
 *
 * @param permission - Git 权限级别
 * @returns GitLab 访问级别
 *
 * @example
 * ```typescript
 * mapGitPermissionToGitLabAccessLevel('admin') // 40 (Maintainer)
 * mapGitPermissionToGitLabAccessLevel('write') // 30 (Developer)
 * mapGitPermissionToGitLabAccessLevel('read') // 20 (Reporter)
 * ```
 */
export function mapGitPermissionToGitLabAccessLevel(permission: GitPermission): number {
  switch (permission) {
    case 'admin':
      return GitLabAccessLevel.Maintainer
    case 'write':
      return GitLabAccessLevel.Developer
    case 'read':
      return GitLabAccessLevel.Reporter
    default:
      return GitLabAccessLevel.Reporter
  }
}

/**
 * 将 GitLab 访问级别映射为 Git 权限
 *
 * @param accessLevel - GitLab 访问级别
 * @returns Git 权限级别
 *
 * @example
 * ```typescript
 * mapGitLabAccessLevelToGitPermission(40) // 'admin'
 * mapGitLabAccessLevelToGitPermission(30) // 'write'
 * mapGitLabAccessLevelToGitPermission(20) // 'read'
 * ```
 */
export function mapGitLabAccessLevelToGitPermission(accessLevel: number): GitPermission {
  if (accessLevel >= GitLabAccessLevel.Maintainer) {
    return 'admin'
  }
  if (accessLevel >= GitLabAccessLevel.Developer) {
    return 'write'
  }
  return 'read'
}

/**
 * 将 Git 权限映射为 GitHub 仓库权限
 *
 * @param permission - Git 权限级别
 * @returns GitHub 仓库权限
 *
 * @example
 * ```typescript
 * mapGitPermissionToGitHubPermission('admin') // 'admin'
 * mapGitPermissionToGitHubPermission('write') // 'write'
 * mapGitPermissionToGitHubPermission('read') // 'read'
 * ```
 */
export function mapGitPermissionToGitHubPermission(
  permission: GitPermission,
): GitHubRepositoryPermission {
  switch (permission) {
    case 'admin':
      return GitHubRepositoryPermission.Admin
    case 'write':
      return GitHubRepositoryPermission.Write
    case 'read':
      return GitHubRepositoryPermission.Read
    default:
      return GitHubRepositoryPermission.Read
  }
}

/**
 * 将 GitHub 仓库权限映射为 Git 权限
 *
 * @param permission - GitHub 仓库权限
 * @returns Git 权限级别
 *
 * @example
 * ```typescript
 * mapGitHubPermissionToGitPermission('admin') // 'admin'
 * mapGitHubPermissionToGitPermission('write') // 'write'
 * mapGitHubPermissionToGitPermission('read') // 'read'
 * ```
 */
export function mapGitHubPermissionToGitPermission(permission: string): GitPermission {
  switch (permission) {
    case GitHubRepositoryPermission.Admin:
    case GitHubRepositoryPermission.Maintain:
      return 'admin'
    case GitHubRepositoryPermission.Write:
    case GitHubRepositoryPermission.Triage:
      return 'write'
    default:
      return 'read'
  }
}

/**
 * 将组织角色映射为 GitHub 组织角色
 *
 * @param role - 组织角色
 * @returns GitHub 组织角色
 *
 * @example
 * ```typescript
 * mapOrgRoleToGitHubOrgRole('owner') // 'admin'
 * mapOrgRoleToGitHubOrgRole('admin') // 'admin'
 * mapOrgRoleToGitHubOrgRole('member') // 'member'
 * ```
 */
export function mapOrgRoleToGitHubOrgRole(role: OrganizationRole): GitHubOrganizationRole {
  switch (role) {
    case 'owner':
    case 'admin':
      return GitHubOrganizationRole.Admin
    default:
      return GitHubOrganizationRole.Member
  }
}

/**
 * 将 GitHub 组织角色映射为组织角色
 *
 * @param role - GitHub 组织角色
 * @returns 组织角色
 *
 * @example
 * ```typescript
 * mapGitHubOrgRoleToOrgRole('admin') // 'admin'
 * mapGitHubOrgRoleToOrgRole('member') // 'member'
 * ```
 */
export function mapGitHubOrgRoleToOrgRole(role: string): OrganizationRole {
  switch (role) {
    case GitHubOrganizationRole.Admin:
      return 'admin'
    default:
      return 'member'
  }
}

/**
 * 根据 Git 平台类型映射权限
 *
 * @param provider - Git 平台类型
 * @param permission - Git 权限级别
 * @returns 平台特定的权限值
 *
 * @example
 * ```typescript
 * mapPermissionForProvider('github', 'admin') // 'admin'
 * mapPermissionForProvider('gitlab', 'admin') // 40
 * ```
 */
export function mapPermissionForProvider(
  provider: GitProvider,
  permission: GitPermission,
): string | number {
  if (provider === 'gitlab') {
    return mapGitPermissionToGitLabAccessLevel(permission)
  }
  return mapGitPermissionToGitHubPermission(permission)
}

/**
 * 从平台特定权限映射为通用权限
 *
 * @param provider - Git 平台类型
 * @param permission - 平台特定的权限值
 * @returns Git 权限级别
 *
 * @example
 * ```typescript
 * mapPermissionFromProvider('github', 'admin') // 'admin'
 * mapPermissionFromProvider('gitlab', 40) // 'admin'
 * ```
 */
export function mapPermissionFromProvider(
  provider: GitProvider,
  permission: string | number,
): GitPermission {
  if (provider === 'gitlab') {
    return mapGitLabAccessLevelToGitPermission(permission as number)
  }
  return mapGitHubPermissionToGitPermission(permission as string)
}

/**
 * 验证权限级别是否有效
 *
 * @param permission - 权限级别
 * @returns 是否有效
 */
export function isValidGitPermission(permission: string): permission is GitPermission {
  return ['read', 'write', 'admin'].includes(permission)
}

/**
 * 验证项目角色是否有效
 *
 * @param role - 项目角色
 * @returns 是否有效
 */
export function isValidProjectRole(role: string): role is ProjectRole {
  return ['owner', 'maintainer', 'developer', 'viewer'].includes(role)
}

/**
 * 验证组织角色是否有效
 *
 * @param role - 组织角色
 * @returns 是否有效
 */
export function isValidOrganizationRole(role: string): role is OrganizationRole {
  return ['owner', 'admin', 'member', 'billing'].includes(role)
}
