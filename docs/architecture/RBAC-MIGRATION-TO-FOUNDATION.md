# RBAC 迁移到 Foundation 层

**日期**: 2025-12-24  
**状态**: 待执行  
**优先级**: 高

---

## 背景

在 Core 层重构过程中，我错误地删除了完整的 CASL RBAC 实现。经过调查发现：

1. ✅ **这是真正的 RBAC 系统** - 基于 @casl/ability 的完整权限管理
2. ❌ **位置错误** - 当前在 Core 层，应该在 Foundation 层
3. ✅ **实现完整** - 包含 Guard、Decorator、Factory、测试

---

## 当前实现

### 文件结构

```
packages/core/src/rbac/
├── casl/
│   ├── abilities.ts              # 权限定义（核心）
│   ├── abilities.spec.ts         # 测试
│   ├── casl-ability.factory.ts   # 权限工厂
│   ├── casl.guard.ts             # NestJS Guard
│   ├── casl.module.ts            # NestJS Module
│   ├── decorators.ts             # 装饰器 (@CanCreate, @CanUpdate 等)
│   ├── types.ts                  # 类型定义
│   └── README.md                 # 文档
├── index.ts                      # 导出
└── rbac.module.ts                # 主模块
```

### 核心功能

1. **权限定义** (`abilities.ts`):
   - 组织级权限（Owner, Admin, Member）
   - 项目级权限（Owner, Maintainer, Developer, Viewer）
   - 基于角色的权限规则

2. **NestJS 集成**:
   - `CaslGuard` - 自动权限检查
   - `@CheckAbility()` - 声明式权限要求
   - `@CanCreate()`, `@CanUpdate()`, `@CanDelete()` - 快捷装饰器

3. **前后端共享**:
   - `createAbility(rules)` - 前端创建权限对象
   - 序列化规则传递给前端

### 权限模型

#### 组织角色

| 角色 | 权限 |
|------|------|
| **Owner** | 所有权限（包括删除组织） |
| **Admin** | 创建/读取/更新项目、管理团队、管理环境和部署 |
| **Member** | 只读权限 |

#### 项目角色

| 角色 | 权限 |
|------|------|
| **Owner** | 管理项目、环境、部署、成员、设置 |
| **Maintainer/Admin** | 管理项目、环境、部署、成员（不能删除项目） |
| **Developer/Member** | 读写项目、部署 |
| **Viewer** | 只读权限 |

---

## 为什么要移到 Foundation 层？

### 1. 架构原则

**Core 层职责**:
- ✅ 纯基础设施（Database, Redis, K8s, Flux, Queue, Events）
- ❌ 不应包含业务逻辑
- ❌ 不应知道 User, Organization, Project 等业务概念

**Foundation 层职责**:
- ✅ 基础业务能力（auth, users, organizations, teams, **RBAC**）
- ✅ 可被 Business 层复用
- ✅ 包含基础权限管理

### 2. 依赖关系

**当前问题**:
```
Core (RBAC) → 需要知道 Organization, Project 等概念
             ↓
Foundation (Organizations, Projects) → 依赖 Core
```

**正确关系**:
```
Foundation (RBAC) → 知道 Organization, Project 等概念
                  ↓
Business → 使用 Foundation RBAC
```

### 3. 实际使用场景

RBAC 的使用场景都在 Foundation 和 Business 层：
- `OrganizationsService` - 检查组织权限
- `ProjectsService` - 检查项目权限
- `DeploymentsService` - 检查部署权限
- API Gateway - 使用 Guard 保护路由

---

## 迁移计划

### Phase 1: 移动文件 ✅

```bash
# 1. 创建 Foundation RBAC 目录
mkdir -p packages/services/foundation/src/rbac/casl

# 2. 移动文件
mv packages/core/src/rbac/casl/* packages/services/foundation/src/rbac/casl/
mv packages/core/src/rbac/index.ts packages/services/foundation/src/rbac/
mv packages/core/src/rbac/rbac.module.ts packages/services/foundation/src/rbac/

# 3. 删除 Core 层 RBAC
rm -rf packages/core/src/rbac
```

### Phase 2: 更新导入路径 ✅

**需要更新的文件**:
1. `packages/services/foundation/src/index.ts` - 添加 RBAC 导出
2. `packages/services/foundation/src/foundation.module.ts` - 导入 RbacModule
3. `packages/core/src/index.ts` - 移除 RBAC 导出
4. 所有使用 RBAC 的服务 - 更新导入路径

**导入路径变更**:
```typescript
// ❌ 旧路径（Core 层）
import { CaslGuard, CanCreate } from '@juanie/core/rbac'

// ✅ 新路径（Foundation 层）
import { CaslGuard, CanCreate } from '@juanie/service-foundation'
```

### Phase 3: 更新依赖 ✅

**Foundation package.json**:
```json
{
  "dependencies": {
    "@casl/ability": "^6.7.1",
    "@juanie/core": "workspace:*",
    "@juanie/database": "workspace:*"
  }
}
```

### Phase 4: 更新文档 ✅

1. 更新 `packages/services/foundation/src/rbac/casl/README.md`
2. 更新 `.kiro/steering/project-guide.md` - 添加 RBAC 导入示例
3. 创建迁移完成文档

---

## 执行步骤

### Step 1: 移动文件

```bash
# 创建目标目录
mkdir -p packages/services/foundation/src/rbac

# 移动整个 rbac 目录
mv packages/core/src/rbac/* packages/services/foundation/src/rbac/

# 删除 Core 层空目录
rmdir packages/core/src/rbac
```

### Step 2: 更新 Foundation 层导出

**`packages/services/foundation/src/index.ts`**:
```typescript
// RBAC - 权限管理
export { RbacModule } from './rbac/rbac.module'
export { CaslModule } from './rbac/casl/casl.module'
export { CaslAbilityFactory } from './rbac/casl/casl-ability.factory'
export { CaslGuard } from './rbac/casl/casl.guard'
export {
  CheckAbility,
  CanCreate,
  CanRead,
  CanUpdate,
  CanDelete,
  CanManage,
} from './rbac/casl/decorators'
export { defineAbilitiesFor, createAbility } from './rbac/casl/abilities'
export type { AppAbility, AbilityUser, AbilityOrgMember, AbilityProjectMember } from './rbac/casl/types'
```

### Step 3: 更新 Foundation Module

**`packages/services/foundation/src/foundation.module.ts`**:
```typescript
import { RbacModule } from './rbac/rbac.module'

@Module({
  imports: [
    // ... 其他模块
    RbacModule,
  ],
  exports: [
    // ... 其他导出
    RbacModule,
  ],
})
export class FoundationModule {}
```

### Step 4: 移除 Core 层导出

**`packages/core/src/index.ts`**:
```typescript
// ❌ 删除这些行
// export * from './rbac'
```

### Step 5: 更新所有使用 RBAC 的地方

**搜索并替换**:
```bash
# 查找所有使用 RBAC 的文件
grep -r "@juanie/core/rbac" apps/ packages/

# 替换导入路径
# @juanie/core/rbac → @juanie/service-foundation
```

### Step 6: 更新 project-guide.md

**`.kiro/steering/project-guide.md`**:
```typescript
// RBAC - 从 Foundation 层导入
import { CaslGuard, CanCreate, CanUpdate } from '@juanie/service-foundation'
import type { AppAbility } from '@juanie/service-foundation'
```

### Step 7: 运行测试

```bash
# 测试 Foundation 层
cd packages/services/foundation
bun run build
bun run type-check
bun test

# 测试 Core 层
cd packages/core
bun run build
bun run type-check

# 测试整个项目
cd ../../../
bun run build
bun test
```

---

## 验证清单

- [ ] RBAC 文件已移动到 Foundation 层
- [ ] Foundation 层导出已更新
- [ ] Foundation Module 已导入 RbacModule
- [ ] Core 层已移除 RBAC 导出
- [ ] 所有导入路径已更新
- [ ] project-guide.md 已更新
- [ ] 所有测试通过
- [ ] 构建成功

---

## 与 Git Permission Mapper 的区别

### RBAC 系统（Foundation 层）

**位置**: `packages/services/foundation/src/rbac/`

**职责**:
- ✅ 通用权限管理系统
- ✅ 基于 @casl/ability
- ✅ 提供 `can(user, action, resource)` 接口
- ✅ 支持组织级和项目级权限
- ✅ 前后端共享
- ✅ NestJS Guard 和 Decorator

**使用场景**:
- API Gateway 路由保护
- Service 层权限检查
- 前端 UI 权限控制

### Git Permission Mapper（Business 层）

**位置**: `packages/services/business/src/gitops/git-sync/permission-mapper.ts`

**职责**:
- ✅ Git 平台权限映射工具
- ✅ 将系统角色映射为 GitHub/GitLab 权限
- ✅ 仅用于 GitOps 业务流程

**使用场景**:
- Git 同步 Worker
- 冲突解决服务
- Git 协作者权限同步

**关系**:
```
RBAC (Foundation) → 检查用户是否有权限操作项目
                  ↓
Git Permission Mapper (Business) → 将项目角色映射为 Git 平台权限
                                  ↓
Git Sync Worker (Business) → 同步到 GitHub/GitLab
```

---

## 总结

1. ✅ **RBAC 是真正的权限管理系统** - 基于 @casl/ability
2. ✅ **应该在 Foundation 层** - 是基础业务能力
3. ✅ **与 Git Permission Mapper 不同** - 两者职责完全不同
4. ✅ **需要立即迁移** - 修正架构错误

**下一步**: 执行迁移计划，将 RBAC 从 Core 层移到 Foundation 层。
