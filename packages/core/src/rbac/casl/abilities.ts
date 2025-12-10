import { AbilityBuilder, createMongoAbility } from '@casl/ability'
import type { AbilityOrgMember, AbilityProjectMember, AbilityUser, AppAbility } from './types'

/**
 * 为用户定义权限
 *
 * 这是核心权限定义函数，根据用户的组织角色和项目角色生成完整的权限规则
 *
 * @param _user - 用户信息（保留用于未来基于所有者的权限检查，如 createdBy）
 * @param orgMember - 组织成员信息（可选）
 * @param projectMembers - 项目成员信息列表（可选）
 */
export function defineAbilitiesFor(
  _user: AbilityUser,
  orgMember?: AbilityOrgMember,
  projectMembers?: AbilityProjectMember[],
): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility)

  // ==================== 组织级权限 ====================
  if (orgMember) {
    const { role } = orgMember

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
      // Admin 可以创建组织内的项目
      can('create', 'Project')
      // Admin 可以读取和更新组织内的所有项目
      can('read', 'Project')
      can('update', 'Project')
      // Admin 不能删除项目（需要 Owner 或项目 Admin）
      cannot('delete', 'Project')

      // ========== 环境权限 ==========
      can('create', 'Environment')
      can('read', 'Environment')
      can('update', 'Environment')
      // Admin 不能删除生产环境
      cannot('delete', 'Environment')

      // ========== 部署权限 ==========
      can('deploy', 'Deployment')
      can('read', 'Deployment')

      // ========== 成员管理 ==========
      can('manage_members', 'Organization')
    } else if (role === 'member') {
      // ========== 组织权限 ==========
      can('read', 'Organization')

      // ========== 项目权限 ==========
      // Member 只能读取项目（具体权限由 visibility 和项目成员关系决定）
      can('read', 'Project')

      // ========== 环境和部署权限 ==========
      can('read', 'Environment')
      can('read', 'Deployment')
    }
  }

  // ==================== 基于所有者的权限 ====================
  // 用户可以管理自己创建的资源（未来扩展）
  // 例如：can('update', 'Project', { createdBy: user.id })
  // 例如：can('delete', 'Deployment', { createdBy: user.id })

  // ==================== 项目级权限 ====================
  if (projectMembers && projectMembers.length > 0) {
    for (const projectMember of projectMembers) {
      const { role } = projectMember

      // 项目所有者 - 完全控制权限
      if (role === 'owner') {
        can('read', 'Project')
        can('update', 'Project')
        can('delete', 'Project')
        can('manage_members', 'Project')
        can('manage_settings', 'Project')

        can('create', 'Environment')
        can('read', 'Environment')
        can('update', 'Environment')
        can('delete', 'Environment')

        can('deploy', 'Deployment')
        can('read', 'Deployment')
      }
      // 项目维护者 - 类似管理员但不能删除项目
      else if (role === 'maintainer' || role === 'admin') {
        can('read', 'Project')
        can('update', 'Project')
        can('manage_members', 'Project')
        can('manage_settings', 'Project')
        // 维护者不能删除项目（需要 Owner）
        cannot('delete', 'Project')

        can('create', 'Environment')
        can('read', 'Environment')
        can('update', 'Environment')
        can('delete', 'Environment')

        can('deploy', 'Deployment')
        can('read', 'Deployment')
      }
      // 项目开发者 - 可以读写和部署
      else if (role === 'developer' || role === 'member') {
        can('read', 'Project')
        can('update', 'Project')

        can('read', 'Environment')

        can('deploy', 'Deployment')
        can('read', 'Deployment')
      }
      // 项目查看者 - 只读权限
      else if (role === 'viewer') {
        can('read', 'Project')
        can('read', 'Environment')
        can('read', 'Deployment')
      }
    }
  }

  return build()
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
