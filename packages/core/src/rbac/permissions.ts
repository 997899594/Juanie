/**
 * 资源类型
 */
export enum Resource {
  ORGANIZATION = 'organization',
  PROJECT = 'project',
  ENVIRONMENT = 'environment',
  DEPLOYMENT = 'deployment',
  MEMBER = 'member',
  TEAM = 'team',
}

/**
 * 操作类型
 */
export enum Action {
  READ = 'read',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  DEPLOY = 'deploy',
  MANAGE_MEMBERS = 'manage_members',
  MANAGE_SETTINGS = 'manage_settings',
  MANAGE_TEAMS = 'manage_teams',
}

/**
 * 组织角色
 */
export enum OrganizationRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

/**
 * 项目角色
 */
export enum ProjectRole {
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

/**
 * 权限定义
 */
export interface Permission {
  resource: Resource
  action: Action
}

/**
 * 组织角色权限映射
 */
export const ORGANIZATION_PERMISSIONS: Record<OrganizationRole, Permission[]> = {
  [OrganizationRole.OWNER]: [
    // 组织管理
    { resource: Resource.ORGANIZATION, action: Action.READ },
    { resource: Resource.ORGANIZATION, action: Action.UPDATE },
    { resource: Resource.ORGANIZATION, action: Action.DELETE },
    { resource: Resource.ORGANIZATION, action: Action.MANAGE_MEMBERS },
    { resource: Resource.ORGANIZATION, action: Action.MANAGE_SETTINGS },
    { resource: Resource.ORGANIZATION, action: Action.MANAGE_TEAMS },
    // 项目管理（所有项目）
    { resource: Resource.PROJECT, action: Action.CREATE },
    { resource: Resource.PROJECT, action: Action.READ },
    { resource: Resource.PROJECT, action: Action.UPDATE },
    { resource: Resource.PROJECT, action: Action.DELETE },
    { resource: Resource.PROJECT, action: Action.MANAGE_MEMBERS },
    // 环境管理
    { resource: Resource.ENVIRONMENT, action: Action.CREATE },
    { resource: Resource.ENVIRONMENT, action: Action.READ },
    { resource: Resource.ENVIRONMENT, action: Action.UPDATE },
    { resource: Resource.ENVIRONMENT, action: Action.DELETE },
    // 部署管理
    { resource: Resource.DEPLOYMENT, action: Action.DEPLOY },
    { resource: Resource.DEPLOYMENT, action: Action.READ },
  ],
  [OrganizationRole.ADMIN]: [
    // 组织查看
    { resource: Resource.ORGANIZATION, action: Action.READ },
    { resource: Resource.ORGANIZATION, action: Action.MANAGE_TEAMS },
    // 项目管理（所有项目）
    { resource: Resource.PROJECT, action: Action.CREATE },
    { resource: Resource.PROJECT, action: Action.READ },
    { resource: Resource.PROJECT, action: Action.UPDATE },
    // 环境管理
    { resource: Resource.ENVIRONMENT, action: Action.CREATE },
    { resource: Resource.ENVIRONMENT, action: Action.READ },
    { resource: Resource.ENVIRONMENT, action: Action.UPDATE },
    // 部署管理
    { resource: Resource.DEPLOYMENT, action: Action.DEPLOY },
    { resource: Resource.DEPLOYMENT, action: Action.READ },
  ],
  [OrganizationRole.MEMBER]: [
    // 组织查看
    { resource: Resource.ORGANIZATION, action: Action.READ },
    // 项目查看
    { resource: Resource.PROJECT, action: Action.READ },
    // 环境查看
    { resource: Resource.ENVIRONMENT, action: Action.READ },
    // 部署查看
    { resource: Resource.DEPLOYMENT, action: Action.READ },
  ],
}

/**
 * 项目角色权限映射
 */
export const PROJECT_PERMISSIONS: Record<ProjectRole, Permission[]> = {
  [ProjectRole.ADMIN]: [
    // 项目管理
    { resource: Resource.PROJECT, action: Action.READ },
    { resource: Resource.PROJECT, action: Action.UPDATE },
    { resource: Resource.PROJECT, action: Action.DELETE },
    { resource: Resource.PROJECT, action: Action.MANAGE_MEMBERS },
    { resource: Resource.PROJECT, action: Action.MANAGE_SETTINGS },
    // 环境管理
    { resource: Resource.ENVIRONMENT, action: Action.CREATE },
    { resource: Resource.ENVIRONMENT, action: Action.READ },
    { resource: Resource.ENVIRONMENT, action: Action.UPDATE },
    { resource: Resource.ENVIRONMENT, action: Action.DELETE },
    // 部署管理
    { resource: Resource.DEPLOYMENT, action: Action.DEPLOY },
    { resource: Resource.DEPLOYMENT, action: Action.READ },
  ],
  [ProjectRole.MEMBER]: [
    // 项目查看和编辑
    { resource: Resource.PROJECT, action: Action.READ },
    { resource: Resource.PROJECT, action: Action.UPDATE },
    // 环境查看
    { resource: Resource.ENVIRONMENT, action: Action.READ },
    // 部署管理
    { resource: Resource.DEPLOYMENT, action: Action.DEPLOY },
    { resource: Resource.DEPLOYMENT, action: Action.READ },
  ],
  [ProjectRole.VIEWER]: [
    // 项目查看
    { resource: Resource.PROJECT, action: Action.READ },
    // 环境查看
    { resource: Resource.ENVIRONMENT, action: Action.READ },
    // 部署查看
    { resource: Resource.DEPLOYMENT, action: Action.READ },
  ],
}

/**
 * 检查角色是否有指定权限
 */
export function hasPermission(
  permissions: Permission[],
  resource: Resource,
  action: Action,
): boolean {
  return permissions.some((p) => p.resource === resource && p.action === action)
}
