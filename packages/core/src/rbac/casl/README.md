# CASL 权限系统

基于 [@casl/ability](https://casl.js.org/) 的现代化权限管理系统。

## 特性

- ✅ **类型安全**: 完整的 TypeScript 支持
- ✅ **声明式**: 清晰的权限规则定义
- ✅ **灵活**: 支持组织级和项目级权限
- ✅ **可测试**: 完整的单元测试覆盖
- ✅ **前后端共享**: 同一套权限规则
- ✅ **Guard 支持**: NestJS Guard 自动权限检查
- ✅ **Decorator 支持**: 声明式权限要求

## 权限模型

### 组织角色

| 角色 | 权限 |
|------|------|
| **Owner** | 所有权限（包括删除组织） |
| **Admin** | 创建/读取/更新项目、管理团队、管理环境和部署 |
| **Member** | 只读权限 |

### 项目角色

| 角色 | 权限 |
|------|------|
| **Admin** | 管理项目、环境、部署、成员 |
| **Member** | 读取/更新项目、部署 |
| **Viewer** | 只读权限 |

## 后端使用

### 1. 基本使用

```typescript
import { CaslAbilityFactory } from '@juanie/core/rbac'

@Injectable()
export class ProjectsService {
  constructor(
    private caslAbilityFactory: CaslAbilityFactory
  ) {}

  async create(userId: string, data: CreateProjectInput) {
    // 创建权限对象
    const ability = await this.caslAbilityFactory.createForUser(
      userId, 
      data.organizationId
    )

    // 检查权限
    if (!ability.can('create', 'Project')) {
      throw new PermissionDeniedError('Project', 'create')
    }

    // 执行操作...
  }
}
```

### 2. 使用 Guard（推荐）

```typescript
import { CheckAbility, CaslGuard } from '@juanie/core/rbac'

@Controller('projects')
@UseGuards(CaslGuard)
export class ProjectsController {
  // 检查创建权限
  @Post()
  @CheckAbility({ action: 'create', subject: 'Project' })
  async create(@Body() data: CreateProjectDto) {
    // 权限已自动检查
    return this.projectsService.create(data)
  }

  // 检查删除权限
  @Delete(':id')
  @CheckAbility({ action: 'delete', subject: 'Project' })
  async delete(@Param('id') id: string) {
    return this.projectsService.delete(id)
  }
}
```

### 3. 使用快捷装饰器

```typescript
import { CanCreate, CanDelete, CanUpdate, CaslGuard } from '@juanie/core/rbac'

@Controller('projects')
@UseGuards(CaslGuard)
export class ProjectsController {
  @Post()
  @CanCreate('Project')
  async create(@Body() data: CreateProjectDto) {
    return this.projectsService.create(data)
  }

  @Patch(':id')
  @CanUpdate('Project')
  async update(@Param('id') id: string, @Body() data: UpdateProjectDto) {
    return this.projectsService.update(id, data)
  }

  @Delete(':id')
  @CanDelete('Project')
  async delete(@Param('id') id: string) {
    return this.projectsService.delete(id)
  }
}
```

### 4. 项目特定权限

```typescript
async update(userId: string, projectId: string, data: UpdateProjectInput) {
  // 创建项目特定的权限对象
  const ability = await this.caslAbilityFactory.createForProject(
    userId, 
    projectId
  )

  if (!ability.can('update', 'Project')) {
    throw new PermissionDeniedError('Project', 'update')
  }

  // 执行操作...
}
```

## 前端使用

### 1. 创建 Composable

```typescript
// composables/useAbility.ts
import { createAbility } from '@juanie/core/rbac'
import type { AppAbility } from '@juanie/core/rbac'
import { computed } from 'vue'
import { useAuth } from './useAuth'

export function useAbility() {
  const { user } = useAuth()

  const ability = computed<AppAbility | null>(() => {
    if (!user.value?.abilityRules) return null
    return createAbility(user.value.abilityRules)
  })

  const can = (action: string, subject: string): boolean => {
    if (!ability.value) return false
    return ability.value.can(action as any, subject as any)
  }

  return { ability, can }
}
```

### 2. 在组件中使用

```vue
<script setup lang="ts">
import { useAbility } from '@/composables/useAbility'

const { can } = useAbility()

const handleDelete = () => {
  // 删除逻辑
}
</script>

<template>
  <div>
    <!-- 根据权限显示/隐藏按钮 -->
    <Button 
      v-if="can('delete', 'Project')"
      @click="handleDelete"
    >
      删除项目
    </Button>

    <!-- 根据权限禁用按钮 -->
    <Button 
      :disabled="!can('update', 'Project')"
      @click="handleUpdate"
    >
      更新项目
    </Button>
  </div>
</template>
```

### 3. 后端返回权限规则

```typescript
// auth.service.ts
async login(credentials: LoginDto) {
  const user = await this.validateUser(credentials)
  
  // 创建权限对象
  const ability = await this.caslAbilityFactory.createForUser(user.id)
  
  // 序列化权限规则
  const abilityRules = serializeAbility(ability)
  
  return {
    user: {
      ...user,
      abilityRules, // 传递给前端
    },
    token: this.generateToken(user),
  }
}
```

## 权限规则定义

权限规则在 `abilities.ts` 中定义：

```typescript
export function defineAbilitiesFor(
  user: AbilityUser,
  orgMember?: AbilityOrgMember,
  projectMembers?: AbilityProjectMember[],
): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility)

  // 组织 Owner
  if (orgMember?.role === 'owner') {
    can('manage', 'all')
  }

  // 组织 Admin
  if (orgMember?.role === 'admin') {
    can('create', 'Project')
    can('read', 'Project')
    can('update', 'Project')
    cannot('delete', 'Project')
  }

  // 项目 Admin
  if (projectMembers?.some(pm => pm.role === 'admin')) {
    can('delete', 'Project')
    can('manage_members', 'Project')
  }

  return build()
}
```

## 测试

```bash
# 运行测试
bun test packages/core/src/rbac/casl/abilities.spec.ts

# 查看覆盖率
bun test --coverage packages/core/src/rbac/casl/
```

## 扩展

### 添加新的操作类型

```typescript
// types.ts
export type Actions =
  | 'manage'
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'deploy'
  | 'approve' // 新增
  | 'manage_members'
```

### 添加新的资源类型

```typescript
// types.ts
export type Subjects =
  | 'Project'
  | 'Environment'
  | 'Deployment'
  | 'PullRequest' // 新增
  | 'Organization'
  | 'Team'
  | 'all'
```

### 添加条件权限（未来）

```typescript
// 只能更新自己创建的项目
can('update', 'Project', { createdBy: user.id })

// 不能删除生产环境
cannot('delete', 'Environment', { type: 'production' })

// 只能部署到开发环境
can('deploy', 'Deployment', { environmentType: 'development' })
```

## 参考

- [CASL 官方文档](https://casl.js.org/v6/en/)
- [CASL Vue 集成](https://casl.js.org/v6/en/package/casl-vue)
- [CASL NestJS 集成](https://docs.nestjs.com/security/authorization#integrating-casl)
