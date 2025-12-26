/**
 * RBAC 权限规则定义
 *
 * 使用 CASL 定义基于角色的访问控制规则
 * 这是纯函数实现，不依赖 NestJS
 *
 * @packageDocumentation
 */

import { AbilityBuilder, createMongoAbility } from '@casl/ability'
import type { OrganizationRole, ProjectRole, TeamRole } from '@juanie/types'
import type { AppAbility } from '../types'

/**
 * 用户信息（用于权限计算）
 */
export interface AbilityUser {
  id: string
}

/**
 * 组织成员信息
 */
export interface AbilityOrgMember {
  userId: string
  organizationId: string
  role: OrganizationRole
}

/**
 * 项目成员信息
 */
export interface AbilityProjectMember {
  userId: string
  projectId: string
  role: ProjectRole
}

/**
 * 团队成员信息
 */
export interface AbilityTeamMember {
  userId: string
  teamId: string
  role: TeamRole
}

/**
 * 为用户定义权限
 *
 * 这是核心权限定义函数，根据用户的组织角色、项目角色和团队角色生成完整的权限规则
 *
 * @param _user - 用户信息（保留用于未来基于所有者的权限检查）
 * @param orgMember - 组织成员信息（可选）
 * @param projectMembers - 项目成员信息列表（可选）
 * @param teamMembers - 团队成员信息列表（可选）
 */
export function defineAbilitiesFor(
  _user: AbilityUser,
  orgMember?: AbilityOrgMember,
  projectMembers?: AbilityProjectMember[],
  teamMembers?: AbilityTeamMember[],
): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility)

  // ==================== 组织级权限 ====================
  if (orgMember) {
    defineOrganizationAbilities(orgMember.role, can, cannot)
  }

  // ==================== 项目级权限 ====================
  if (projectMembers && projectMembers.length > 0) {
    for (const projectMember of projectMembers) {
      defineProjectAbilities(projectMember.role, can, cannot)
    }
  }

  // ==================== 团队级权限 ====================
  if (teamMembers && teamMembers.length > 0) {
    for (const teamMember of teamMembers) {
      defineTeamAbilities(teamMember.role, can, cannot)
    }
  }

  return build()
}

/**
 * 定义组织级权限
 */
function defineOrganizationAbilities(
  role: OrganizationRole,
  can: AbilityBuilder<AppAbility>['can'],
  cannot: AbilityBuilder<AppAbility>['cannot'],
): void {
  if (role === 'owner') {
    // Owner 拥有组织内的所有权限
    can('manage', 'all')
  } else if (role === 'admin') {
    // ========== 组织权限 ==========
    can('read', 'Organization')
    can('update', 'Organization')
    can('manage_teams', 'Organization')
    cannot('delete', 'Organization') // Admin 不能删除组织

    // ========== 项目权限 ==========
    can('create', 'Project')
    can('read', 'Project')
    can('update', 'Project')
    cannot('delete', 'Project') // Admin 不能删除项目

    // ========== 环境权限 ==========
    can('create', 'Environment')
    can('read', 'Environment')
    can('update', 'Environment')
    cannot('delete', 'Environment') // Admin 不能删除环境

    // ========== 部署权限 ==========
    can('deploy', 'Deployment')
    can('read', 'Deployment')

    // ========== 成员管理 ==========
    can('manage_members', 'Organization')
  } else if (role === 'member') {
    // ========== 组织权限 ==========
    can('read', 'Organization')

    // ========== 项目权限 ==========
    // Member 只能读取可见的项目（具体权限由 visibility 决定）
    can('read', 'Project')

    // ========== 环境和部署权限 ==========
    can('read', 'Environment')
    can('read', 'Deployment')
  }
}

/**
 * 定义项目级权限
 */
function defineProjectAbilities(
  role: ProjectRole,
  can: AbilityBuilder<AppAbility>['can'],
  cannot: AbilityBuilder<AppAbility>['cannot'],
): void {
  if (role === 'owner') {
    // 项目所有者 - 完全控制权限
    can('read', 'Project')
    can('update', 'Project')
    can('delete', 'Project')
    can('manage_members', 'Project')
    can('manage_settings', 'Project')

    can('create', 'Environment')
    can('read', 'Environment')
    can('update', 'Environment')
    can('delete', 'Environment')

    // 可以部署到所有环境
    can('deploy', 'Deployment')
    can('read', 'Deployment')
  } else if (role === 'maintainer') {
    // 项目维护者 - 管理权限但不能删除项目
    can('read', 'Project')
    can('update', 'Project')
    can('manage_members', 'Project')
    can('manage_settings', 'Project')
    cannot('delete', 'Project') // 维护者不能删除项目

    can('create', 'Environment')
    can('read', 'Environment')
    can('update', 'Environment')
    can('delete', 'Environment')

    // 可以部署到所有环境
    can('deploy', 'Deployment')
    can('read', 'Deployment')
  } else if (role === 'developer') {
    // 项目开发者 - 读写和部署权限（仅非生产环境）
    can('read', 'Project')
    can('update', 'Project')

    can('read', 'Environment')

    // ✅ 环境权限控制：Developer 只能部署到非生产环境
    // CASL 支持基于条件的权限检查，传入包含 environmentType 的对象即可
    can('deploy', 'Deployment', {
      environmentType: { $in: ['development', 'staging', 'testing'] },
    })

    // 明确禁止部署到生产环境
    cannot('deploy', 'Deployment', {
      environmentType: 'production',
    })

    can('read', 'Deployment')
  } else if (role === 'viewer') {
    // 项目查看者 - 只读权限
    can('read', 'Project')
    can('read', 'Environment')
    can('read', 'Deployment')
  }
}

/**
 * 定义团队级权限
 */
function defineTeamAbilities(
  role: TeamRole,
  can: AbilityBuilder<AppAbility>['can'],
  cannot: AbilityBuilder<AppAbility>['cannot'],
): void {
  if (role === 'owner') {
    // 团队所有者 - 完全控制权限
    can('read', 'Team')
    can('update', 'Team')
    can('delete', 'Team')
    can('manage_members', 'Team')
    can('manage_settings', 'Team')
  } else if (role === 'maintainer') {
    // 团队维护者 - 管理权限但不能删除团队
    can('read', 'Team')
    can('update', 'Team')
    can('manage_members', 'Team')
    can('manage_settings', 'Team')
    cannot('delete', 'Team')
  } else if (role === 'member') {
    // 团队成员 - 只读权限
    can('read', 'Team')
  }
}

/**
 * 创建权限对象（用于前端）
 *
 * 前端通过后端返回的序列化规则创建权限对象
 */
export function createAbility(rules: any[]): AppAbility {
  return createMongoAbility(rules)
}

/**
 * 序列化权限规则（用于传输到前端）
 */
export function serializeAbility(ability: AppAbility): any[] {
  return ability.rules
}
