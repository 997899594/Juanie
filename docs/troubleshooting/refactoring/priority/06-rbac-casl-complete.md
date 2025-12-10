# RBAC 迁移到 CASL - 完成

## 迁移完成

已成功将 RBAC 系统从硬编码权限映射迁移到 CASL。

## 变更内容

### 1. 安装依赖

```bash
bun add @casl/ability
cd apps/web && bun add @casl/vue
```

### 2. 新增文件

- `packages/core/src/rbac/casl/types.ts` - CASL 类型定义
- `packages/core/src/rbac/casl/abilities.ts` - 权限规则定义
- `packages/core/src/rbac/casl/casl-ability.factory.ts` - NestJS Factory
- `packages/core/src/rbac/casl/casl.module.ts` - NestJS Module
- `apps/web/src/composables/useAbility.ts` - Vue Composable

### 3. 删除文件

- `packages/core/src/rbac/permissions.ts` - 旧的权限映射
- `packages/core/src/rbac/rbac.service.ts` - 旧的 RBAC 服务

### 4. 修改文件

- `packages/core/src/rbac/rbac.module.ts` - 使用 CASL Module
- `packages/core/src/rbac/index.ts` - 更新导出
- `packages/services/business/src/projects/projects.service.ts` - 使用 CASL

## 使用方式

### 后端使用

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

### 前端使用

```vue
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

## 权限规则

### 组织级权限

**Owner**:
- 拥有所有权限 (`manage all`)

**Admin**:
- 可以创建和管理组织内的项目
- 可以管理环境和部署
- 可以管理团队
- 不能删除组织

**Member**:
- 只能查看组织、项目、环境和部署

### 项目级权限

**Project Admin**:
- 可以读取、更新、删除项目
- 可以管理项目成员和设置
- 可以创建、更新、删除环境
- 可以部署

**Project Member**:
- 可以读取和更新项目
- 可以查看环境
- 可以部署

**Project Viewer**:
- 只能查看项目、环境和部署

## 优势

1. **条件权限**: 支持基于资源属性的权限检查
2. **前后端共享**: 同一套权限规则
3. **类型安全**: 完整的 TypeScript 支持
4. **声明式**: 权限规则清晰易读
5. **灵活扩展**: 易于添加新权限

## 后续工作

1. 更新其他 Service 使用 CASL
2. 实现前端权限规则同步
3. 添加权限测试
4. 更新 API 文档

## 测试

```bash
# 运行测试
bun test packages/core/src/rbac

# 类型检查
bun run type-check
```

## 参考

- [CASL 官方文档](https://casl.js.org/v6/en/)
- [CASL Vue 集成](https://casl.js.org/v6/en/package/casl-vue)
