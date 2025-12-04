# 任务 6: RBAC 权限系统

**优先级**: 🟡 中  
**预计时间**: 3天  
**依赖**: 任务 5 (错误处理)

---

## 📋 问题描述

### 现状

1. **权限检查分散**
   ```typescript
   // 每个 Service 都自己检查权限
   const member = await this.db.query.projectMembers.findFirst({
     where: and(
       eq(schema.projectMembers.projectId, projectId),
       eq(schema.projectMembers.userId, userId),
     ),
   })
   if (!member || member.role !== 'admin') {
     throw new Error('Permission denied')
   }
   ```

2. **角色定义不统一**
   - 有的地方用 `'admin'`
   - 有的地方用 `'owner'`
   - 有的地方用 `'developer'`，有的用 `'member'`

3. **缺少细粒度权限**
   - 只有角色，没有具体权限
   - 无法实现"只读管理员"等需求

4. **组织级权限未实现**
   - 组织管理员应该能管理所有项目
   - 当前只有项目级权限

### 影响

- ❌ 权限检查代码重复
- ❌ 权限逻辑不一致
- ❌ 无法满足复杂权限需求

---

## 🎯 方案

### RBAC 设计

```
组织 (Organization)
  ├─ 角色: owner, admin, member
  └─ 项目 (Project)
       ├─ 角色: admin, member, viewer
       └─ 权限: read, write, delete, deploy, manage_members
```

---

## 🔧 实施步骤

### 6.1 定义权限模型 (0.5天)

```typescript
// packages/core/src/rbac/permissions.ts

/**
 * 资源类型
 */
export enum Resource {
  ORGANIZATION = 'organization',
  PROJECT = 'project',
  ENVIRONMENT = 'environment',
  DEPLOYMENT = 'deployment',
  MEMBER = 'member',
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
 * 角色权限映射
 */
export const ORGANIZATION_PERMISSIONS: Record<
  OrganizationRole,
  Array<{ resource: Resource; action: Action }>
> = {
  [OrganizationRole.OWNER]: [
    { resource: Resource.ORGANIZATION, action: Action.READ },
    { resource: Resource.ORGANIZATION, action: Action.UPDATE },
    { resource: Resource.ORGANIZATION, action: Action.DELETE },
    { resource: Resource.ORGANIZATION, action: Action.MANAGE_MEMBERS },
    { resource: Resource.PROJECT, action: Action.CREATE },
    { resource: Resource.PROJECT, action: Action.READ },
    { resource: Resource.PROJECT, action: Action.UPDATE },
    { resource: Resource.PROJECT, action: Action.DELETE },
  ],
  [OrganizationRole.ADMIN]: [
    { resource: Resource.ORGANIZATION, action: Action.READ },
    { resource: Resource.PROJECT, action: Action.CREATE },
    { resource: Resource.PROJECT, action: Action.READ },
    { resource: Resource.PROJECT, action: Action.UPDATE },
  ],
  [OrganizationRole.MEMBER]: [
    { resource: Resource.ORGANIZATION, action: Action.READ },
    { resource: Resource.PROJECT, action: Action.READ },
  ],
}

export const PROJECT_PERMISSIONS: Record<
  ProjectRole,
  Array<{ resource: Resource; action: Action }>
> = {
  [ProjectRole.ADMIN]: [
    { resource: Resource.PROJECT, action: Action.READ },
    { resource: Resource.PROJECT, action: Action.UPDATE },
    { resource: Resource.PROJECT, action: Action.DELETE },
    { resource: Resource.PROJECT, action: Action.MANAGE_MEMBERS },
    { resource: Resource.ENVIRONMENT, action: Action.CREATE },
    { resource: Resource.DEPLOYMENT, action: Action.DEPLOY },
  ],
  [ProjectRole.MEMBER]: [
    { resource: Resource.PROJECT, action: Action.READ },
    { resource: Resource.PROJECT, action: Action.UPDATE },
    { resource: Resource.ENVIRONMENT, action: Action.READ },
    { resource: Resource.DEPLOYMENT, action: Action.DEPLOY },
  ],
  [ProjectRole.VIEWER]: [
    { resource: Resource.PROJECT, action: Action.READ },
    { resource: Resource.ENVIRONMENT, action: Action.READ },
  ],
}
```

### 6.2 实现权限检查服务 (1天)

```typescript
// packages/core/src/rbac/rbac.service.ts

@Injectable()
export class RBACService {
  constructor(
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * 检查用户是否有权限
   */
  async can(
    userId: string,
    resource: Resource,
    action: Action,
    resourceId: string,
  ): Promise<boolean> {
    // 1. 检查组织级权限
    if (resource === Resource.ORGANIZATION) {
      return this.canOrganization(userId, action, resourceId)
    }

    // 2. 检查项目级权限
    if (resource === Resource.PROJECT) {
      return this.canProject(userId, action, resourceId)
    }

    // 3. 检查其他资源权限
    return this.canResource(userId, resource, action, resourceId)
  }

  /**
   * 检查组织权限
   */
  private async canOrganization(
    userId: string,
    action: Action,
    organizationId: string,
  ): Promise<boolean> {
    const member = await this.db.query.organizationMembers.findFirst({
      where: and(
        eq(schema.organizationMembers.organizationId, organizationId),
        eq(schema.organizationMembers.userId, userId),
      ),
    })

    if (!member) return false

    const permissions = ORGANIZATION_PERMISSIONS[member.role as OrganizationRole]
    return permissions.some(
      (p) => p.resource === Resource.ORGANIZATION && p.action === action,
    )
  }

  /**
   * 检查项目权限
   */
  private async canProject(
    userId: string,
    action: Action,
    projectId: string,
  ): Promise<boolean> {
    // 1. 检查项目成员权限
    const projectMember = await this.db.query.projectMembers.findFirst({
      where: and(
        eq(schema.projectMembers.projectId, projectId),
        eq(schema.projectMembers.userId, userId),
      ),
    })

    if (projectMember) {
      const permissions = PROJECT_PERMISSIONS[projectMember.role as ProjectRole]
      const hasPermission = permissions.some(
        (p) => p.resource === Resource.PROJECT && p.action === action,
      )
      if (hasPermission) return true
    }

    // 2. 检查组织管理员权限
    const project = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    })

    if (!project) return false

    const orgMember = await this.db.query.organizationMembers.findFirst({
      where: and(
        eq(schema.organizationMembers.organizationId, project.organizationId),
        eq(schema.organizationMembers.userId, userId),
      ),
    })

    if (!orgMember) return false

    // 组织 Owner 和 Admin 有所有项目权限
    return [OrganizationRole.OWNER, OrganizationRole.ADMIN].includes(
      orgMember.role as OrganizationRole,
    )
  }

  /**
   * 断言用户有权限（无权限则抛出错误）
   */
  async assert(
    userId: string,
    resource: Resource,
    action: Action,
    resourceId: string,
  ): Promise<void> {
    const hasPermission = await this.can(userId, resource, action, resourceId)
    
    if (!hasPermission) {
      throw new PermissionDeniedError(resource, action)
    }
  }

  /**
   * 获取用户在资源上的角色
   */
  async getRole(
    userId: string,
    resource: Resource,
    resourceId: string,
  ): Promise<string | null> {
    if (resource === Resource.PROJECT) {
      const member = await this.db.query.projectMembers.findFirst({
        where: and(
          eq(schema.projectMembers.projectId, resourceId),
          eq(schema.projectMembers.userId, userId),
        ),
      })
      return member?.role || null
    }

    if (resource === Resource.ORGANIZATION) {
      const member = await this.db.query.organizationMembers.findFirst({
        where: and(
          eq(schema.organizationMembers.organizationId, resourceId),
          eq(schema.organizationMembers.userId, userId),
        ),
      })
      return member?.role || null
    }

    return null
  }
}
```

### 6.3 创建权限装饰器 (0.5天)

```typescript
// packages/core/src/rbac/decorators.ts

import { SetMetadata } from '@nestjs/common'

export const PERMISSION_KEY = 'permission'

export interface PermissionMetadata {
  resource: Resource
  action: Action
}

/**
 * 权限装饰器
 */
export const RequirePermission = (resource: Resource, action: Action) =>
  SetMetadata(PERMISSION_KEY, { resource, action })

/**
 * 使用示例
 */
@Injectable()
export class ProjectsService {
  @RequirePermission(Resource.PROJECT, Action.DELETE)
  async delete(userId: string, projectId: string) {
    // 权限检查由 Guard 自动完成
    // ...
  }
}
```

### 6.4 更新业务服务 (1天)

```typescript
// packages/services/business/src/projects/projects.service.ts

@Injectable()
export class ProjectsService {
  constructor(
    private readonly rbac: RBACService,
  ) {}

  async get(userId: string, projectId: string) {
    // ✅ 使用 RBAC 检查权限
    await this.rbac.assert(userId, Resource.PROJECT, Action.READ, projectId)
    
    const project = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    })

    if (!project) {
      throw new ProjectNotFoundError(projectId)
    }

    return project
  }

  async update(userId: string, projectId: string, data: UpdateProjectInput) {
    // ✅ 使用 RBAC 检查权限
    await this.rbac.assert(userId, Resource.PROJECT, Action.UPDATE, projectId)
    
    return await this.db
      .update(schema.projects)
      .set(data)
      .where(eq(schema.projects.id, projectId))
      .returning()
  }

  async delete(userId: string, projectId: string) {
    // ✅ 使用 RBAC 检查权限
    await this.rbac.assert(userId, Resource.PROJECT, Action.DELETE, projectId)
    
    await this.softDelete.softDelete(schema.projects, projectId, userId)
  }
}
```

---

## ✅ 验收标准

- [ ] RBAC 服务实现完成
- [ ] 所有业务服务使用 RBAC
- [ ] 权限检查测试覆盖率 > 90%
- [ ] 组织级权限正常工作
- [ ] 项目级权限正常工作
- [ ] 权限拒绝返回友好错误

---

## 📊 预期收益

- ✅ 权限检查统一，代码更清晰
- ✅ 支持细粒度权限控制
- ✅ 易于扩展新的角色和权限
- ✅ 安全性提升

---

## 📝 相关文档

- [RBAC 设计](../../architecture/rbac.md)
- [权限使用指南](../../guides/permissions.md)
