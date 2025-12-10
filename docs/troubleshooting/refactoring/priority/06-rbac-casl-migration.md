# RBAC 迁移到 CASL

## 背景

当前 RBAC 系统基于硬编码的权限映射，不够灵活。CASL 提供了更现代化的权限管理方案。

## 当前问题

1. **权限规则硬编码**：在 `permissions.ts` 中定义，难以扩展
2. **条件权限支持弱**：无法表达"只能修改自己的资源"
3. **前后端重复**：前端需要重复权限逻辑
4. **类型安全不足**：权限检查容易出错

## CASL 优势

### 1. 条件权限

```typescript
// 当前方案：只能检查角色
if (user.role === 'admin') {
  // 允许操作
}

// CASL：可以检查资源属性
can('update', 'Project', { ownerId: user.id })
can('delete', 'Project', { status: { $ne: 'production' } })
```

### 2. 前后端共享

```typescript
// packages/core/src/rbac/abilities.ts
import { defineAbility } from '@casl/ability'

export function defineAbilitiesFor(user: User) {
  return defineAbility((can, cannot) => {
    if (user.role === 'owner') {
      can('manage', 'all')
    } else if (user.role === 'admin') {
      can('manage', 'Project', { organizationId: user.organizationId })
      can('manage', 'Environment')
      cannot('delete', 'Organization')
    } else {
      can('read', 'Project', { organizationId: user.organizationId })
      can('update', 'Project', { ownerId: user.id })
    }
  })
}

// 前端使用
const ability = defineAbilitiesFor(currentUser)
if (ability.can('delete', project)) {
  // 显示删除按钮
}

// 后端使用
@Injectable()
export class CaslAbilityFactory {
  createForUser(user: User) {
    return defineAbilitiesFor(user)
  }
}
```

### 3. 类型安全

```typescript
// 定义权限类型
type Actions = 'create' | 'read' | 'update' | 'delete' | 'manage'
type Subjects = 'Project' | 'Environment' | 'Deployment' | 'all'

type AppAbility = Ability<[Actions, Subjects]>

// 使用时有完整的类型提示
ability.can('update', 'Project') // ✅ 类型安全
ability.can('invalid', 'Project') // ❌ 编译错误
```

## 迁移计划

### Phase 1: 安装和配置

```bash
bun add @casl/ability @casl/vue
```

```typescript
// packages/core/src/rbac/casl/types.ts
import type { Ability } from '@casl/ability'

export type Actions = 
  | 'create' 
  | 'read' 
  | 'update' 
  | 'delete' 
  | 'manage'
  | 'deploy'
  | 'manage_members'

export type Subjects = 
  | 'Project'
  | 'Environment'
  | 'Deployment'
  | 'Organization'
  | 'Team'
  | 'all'

export type AppAbility = Ability<[Actions, Subjects]>
```

### Phase 2: 定义权限规则

```typescript
// packages/core/src/rbac/casl/abilities.ts
import { AbilityBuilder, createMongoAbility } from '@casl/ability'
import type { AppAbility } from './types'

export function defineAbilitiesFor(user: User, orgMember?: OrganizationMember) {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility)

  // 组织级权限
  if (orgMember) {
    if (orgMember.role === 'owner') {
      can('manage', 'all')
    } else if (orgMember.role === 'admin') {
      can('manage', 'Project', { organizationId: orgMember.organizationId })
      can('manage', 'Environment')
      can('manage', 'Deployment')
      can('read', 'Organization')
      cannot('delete', 'Organization')
    } else {
      can('read', 'Project', { organizationId: orgMember.organizationId })
      can('read', 'Environment')
      can('read', 'Deployment')
    }
  }

  // 项目级权限（基于项目成员角色）
  // 这部分需要动态加载

  return build()
}
```

### Phase 3: 后端集成

```typescript
// packages/core/src/rbac/casl/casl-ability.factory.ts
import { Injectable } from '@nestjs/common'
import { defineAbilitiesFor } from './abilities'

@Injectable()
export class CaslAbilityFactory {
  async createForUser(userId: string, organizationId?: string) {
    // 查询用户和组织成员信息
    const user = await this.usersService.findById(userId)
    
    let orgMember
    if (organizationId) {
      orgMember = await this.getOrgMember(userId, organizationId)
    }

    return defineAbilitiesFor(user, orgMember)
  }

  private async getOrgMember(userId: string, organizationId: string) {
    return this.db.query.organizationMembers.findFirst({
      where: and(
        eq(schema.organizationMembers.userId, userId),
        eq(schema.organizationMembers.organizationId, organizationId)
      )
    })
  }
}

// 使用
@Injectable()
export class ProjectsService {
  constructor(
    private caslAbilityFactory: CaslAbilityFactory
  ) {}

  async create(userId: string, data: CreateProjectInput) {
    const ability = await this.caslAbilityFactory.createForUser(
      userId, 
      data.organizationId
    )

    // 检查权限
    if (!ability.can('create', 'Project')) {
      throw new ForbiddenException('Cannot create project')
    }

    // 创建项目...
  }
}
```

### Phase 4: 前端集成

```typescript
// apps/web/src/composables/useAbility.ts
import { useAbility as useCaslAbility } from '@casl/vue'
import { computed } from 'vue'
import { defineAbilitiesFor } from '@juanie/core/rbac/casl'

export function useAbility() {
  const { user, currentOrg } = useAuth()
  
  const ability = computed(() => {
    if (!user.value) return null
    return defineAbilitiesFor(user.value, currentOrg.value)
  })

  return {
    ability,
    can: (action: string, subject: string, field?: string) => {
      return ability.value?.can(action, subject, field) ?? false
    }
  }
}

// 在组件中使用
<script setup lang="ts">
import { useAbility } from '@/composables/useAbility'

const { can } = useAbility()
</script>

<template>
  <Button 
    v-if="can('delete', 'Project')"
    @click="deleteProject"
  >
    删除项目
  </Button>
</template>
```

### Phase 5: 渐进式迁移

1. **保留旧 RBAC**：不要立即删除
2. **并行运行**：新功能用 CASL，旧功能保持不变
3. **逐步迁移**：一个模块一个模块迁移
4. **测试覆盖**：确保权限检查正确

```typescript
// 迁移期间的兼容层
@Injectable()
export class PermissionService {
  constructor(
    private rbacService: RBACService, // 旧的
    private caslFactory: CaslAbilityFactory // 新的
  ) {}

  async can(userId: string, action: Action, resource: Resource, resourceId: string) {
    // 优先使用 CASL
    if (this.shouldUseCasl(resource)) {
      const ability = await this.caslFactory.createForUser(userId)
      return ability.can(action, resource)
    }
    
    // 回退到旧 RBAC
    return this.rbacService.can(userId, resource, action, resourceId)
  }

  private shouldUseCasl(resource: Resource): boolean {
    // 已迁移到 CASL 的资源
    return ['Project', 'Environment'].includes(resource)
  }
}
```

## 迁移优先级

1. **高优先级**：Project, Environment（核心功能）
2. **中优先级**：Deployment, Team
3. **低优先级**：Organization（较少变更）

## 测试策略

```typescript
// packages/core/src/rbac/casl/abilities.spec.ts
describe('CASL Abilities', () => {
  it('owner can manage all', () => {
    const user = createUser({ id: '1' })
    const orgMember = createOrgMember({ role: 'owner' })
    const ability = defineAbilitiesFor(user, orgMember)

    expect(ability.can('manage', 'all')).toBe(true)
    expect(ability.can('delete', 'Project')).toBe(true)
  })

  it('admin cannot delete organization', () => {
    const user = createUser({ id: '1' })
    const orgMember = createOrgMember({ role: 'admin' })
    const ability = defineAbilitiesFor(user, orgMember)

    expect(ability.can('manage', 'Project')).toBe(true)
    expect(ability.can('delete', 'Organization')).toBe(false)
  })

  it('member can only read', () => {
    const user = createUser({ id: '1' })
    const orgMember = createOrgMember({ role: 'member' })
    const ability = defineAbilitiesFor(user, orgMember)

    expect(ability.can('read', 'Project')).toBe(true)
    expect(ability.can('update', 'Project')).toBe(false)
  })
})
```

## 参考资源

- [CASL 官方文档](https://casl.js.org/v6/en/)
- [CASL Vue 集成](https://casl.js.org/v6/en/package/casl-vue)
- [CASL NestJS 集成](https://docs.nestjs.com/security/authorization#integrating-casl)

## 总结

CASL 提供了更灵活、类型安全、前后端统一的权限管理方案。建议渐进式迁移，先修复当前 bug，再逐步引入 CASL。
