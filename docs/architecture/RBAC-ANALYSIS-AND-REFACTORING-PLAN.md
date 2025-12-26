# RBAC 分析与重构计划

**日期**: 2025-12-24  
**状态**: 分析完成，待执行  
**优先级**: 中等（Day 6-7 任务的一部分）

---

## 1. 现状分析

### 1.1 当前实现位置

**文件**: `packages/services/business/src/gitops/git-sync/permission-mapper.ts`

**当前层级**: Business Layer (业务层)

**使用场景**:
- Git 同步 Worker (`git-sync.worker.ts`) - 同步项目成员到 Git 平台
- 冲突解决服务 (`conflict-resolution.service.ts`) - 检测和解决权限冲突
- 导出到 Business 层 index (`packages/services/business/src/index.ts`)

### 1.2 功能范围

#### 核心类型定义
```typescript
// 项目成员角色
type ProjectRole = 'owner' | 'maintainer' | 'developer' | 'viewer'

// 组织成员角色
type OrganizationRole = 'owner' | 'admin' | 'member' | 'billing'

// Git 权限级别（抽象层）
type GitPermission = 'read' | 'write' | 'admin'

// GitLab 访问级别（平台特定）
enum GitLabAccessLevel {
  NoAccess = 0,
  MinimalAccess = 5,
  Guest = 10,
  Reporter = 20,
  Developer = 30,
  Maintainer = 40,
  Owner = 50,
}

// GitHub 仓库权限（平台特定）
enum GitHubRepositoryPermission {
  Read = 'read',
  Triage = 'triage',
  Write = 'write',
  Maintain = 'maintain',
  Admin = 'admin',
}

// GitHub 组织角色（平台特定）
enum GitHubOrganizationRole {
  Member = 'member',
  Admin = 'admin',
}
```

#### 核心功能
1. **角色到权限映射**:
   - `mapProjectRoleToGitPermission()` - 项目角色 → Git 权限
   - `mapOrgRoleToGitPermission()` - 组织角色 → Git 权限

2. **平台特定映射**:
   - `mapGitPermissionToGitLabAccessLevel()` - Git 权限 → GitLab 访问级别
   - `mapGitLabAccessLevelToGitPermission()` - GitLab 访问级别 → Git 权限
   - `mapGitPermissionToGitHubPermission()` - Git 权限 → GitHub 权限
   - `mapGitHubPermissionToGitPermission()` - GitHub 权限 → Git 权限

3. **组织角色映射**:
   - `mapOrgRoleToGitHubOrgRole()` - 组织角色 → GitHub 组织角色
   - `mapGitHubOrgRoleToOrgRole()` - GitHub 组织角色 → 组织角色

4. **通用映射**:
   - `mapPermissionForProvider()` - 根据 provider 映射权限
   - `mapPermissionFromProvider()` - 从 provider 特定权限映射回通用权限

5. **验证函数**:
   - `isValidGitPermission()` - 验证 Git 权限
   - `isValidProjectRole()` - 验证项目角色
   - `isValidOrganizationRole()` - 验证组织角色

### 1.3 数据库 Schema 中的角色

#### 项目成员 (`project_members`)
```typescript
role: text('role').notNull().default('developer')
// 'owner', 'maintainer', 'developer', 'viewer'
```

#### 组织成员 (`organization_members`)
```typescript
role: text('role').notNull()
// 'owner', 'admin', 'member'
```

#### 团队成员 (`team_members`)
```typescript
role: text('role').notNull().default('member')
// 'owner', 'maintainer', 'member'
```

#### 团队项目关联 (`team_projects`)
```typescript
role: text('role').notNull().default('contributor')
// 'owner', 'maintainer', 'contributor'
```

#### 环境权限 (`environments`)
```typescript
permissions: jsonb('permissions').$type<Array<{
  subjectType: 'user' | 'team'
  subjectId: string
  permission: 'read' | 'deploy' | 'admin'
}>>()
```

---

## 2. 架构判断

### 2.1 这是 RBAC 吗？

**结论**: ❌ **不是通用 RBAC 系统**

**理由**:
1. **Git 平台特定**: 所有映射都是为了同步到 GitHub/GitLab
2. **单一用途**: 仅用于 Git 协作者权限同步
3. **无权限检查**: 没有 `can(user, action, resource)` 这样的权限检查逻辑
4. **无资源级权限**: 没有细粒度的资源访问控制

### 2.2 这是什么？

**实际定位**: **Git 平台权限映射工具 (Git Platform Permission Mapper)**

**核心职责**:
- 将系统内部角色映射为 Git 平台权限
- 处理 GitHub/GitLab 的平台差异
- 提供双向映射（系统 ↔ Git 平台）

**业务场景**:
- 用户在系统中被添加为项目成员 → 自动同步到 GitHub/GitLab 仓库
- 用户角色在系统中变更 → 自动更新 Git 平台权限
- 检测系统与 Git 平台的权限冲突 → 以系统为准同步

---

## 3. 是否应该移到 Foundation 层？

### 3.1 判断标准

根据三层架构原则：

**Foundation 层 (基础层)**:
- ✅ 基础业务能力（auth, users, organizations, teams, git-connections, storage）
- ✅ 可被 Business 层复用
- ✅ 不包含具体业务逻辑
- ❌ 不应包含 Git 平台特定的业务逻辑

**Business 层 (业务层)**:
- ✅ 具体业务逻辑（projects, deployments, gitops）
- ✅ 可以依赖 Foundation 层
- ✅ 包含业务流程编排
- ✅ 可以包含平台集成逻辑

### 3.2 最终判断

**结论**: ❌ **不应该移到 Foundation 层**

**理由**:

1. **Git 平台特定业务逻辑**:
   - 这是 GitOps 业务流程的一部分
   - 专门为 Git 协作者同步设计
   - 不是通用的权限管理能力

2. **属于 Business 层的 GitOps 模块**:
   - 当前位置: `packages/services/business/src/gitops/git-sync/`
   - 与 Git 同步 Worker 紧密耦合
   - 是 GitOps 业务流程的一部分

3. **不是基础能力**:
   - Foundation 层不应该知道 GitHub/GitLab 的存在
   - Foundation 层不应该包含平台集成逻辑
   - 这是 Business 层对 Git 平台的适配

4. **遵循"使用成熟工具"原则**:
   - 如果需要通用 RBAC，应该使用 `@casl/ability` 等成熟库
   - 不应该自己实现 RBAC 系统

---

## 4. 真正的 RBAC 需求

### 4.1 系统中是否需要 RBAC？

**当前状态**: 使用简单的角色系统（role-based）

**是否需要升级到 RBAC**:
- ❌ 当前不需要
- ✅ 简单角色系统已经满足需求
- ✅ 数据库 schema 已经支持角色

**如果未来需要 RBAC**:
1. 使用成熟工具: `@casl/ability`
2. 在 Foundation 层创建 `rbac` 模块
3. 提供 `can(user, action, resource)` 接口
4. 支持细粒度权限控制

### 4.2 当前权限检查在哪里？

**Foundation 层**:
- `OrganizationsService.isAdmin()` - 检查是否是组织管理员
- `OrganizationsService.isMember()` - 检查是否是组织成员
- `TeamsService.isMember()` - 检查是否是团队成员
- `TeamsService.getMemberRole()` - 获取团队成员角色

**Business 层**:
- `ProjectMembersService` - 项目成员管理
- 权限检查逻辑分散在各个服务中

**API Gateway 层**:
- tRPC middleware 中进行权限检查
- 基于 session 和角色进行访问控制

---

## 5. 重构建议

### 5.1 保持现状 ✅ (推荐)

**理由**:
1. ✅ 当前位置正确（Business 层 GitOps 模块）
2. ✅ 职责清晰（Git 平台权限映射）
3. ✅ 测试覆盖完整（100% 测试覆盖）
4. ✅ 遵循架构原则（Business 层可以包含平台集成）

**需要做的**:
- ✅ 保持在 `packages/services/business/src/gitops/git-sync/permission-mapper.ts`
- ✅ 继续从 Business 层 index 导出
- ✅ 文档中明确说明这是 Git 平台映射工具，不是通用 RBAC

### 5.2 改进建议

#### 5.2.1 重命名以避免混淆

**当前名称**: `permission-mapper.ts`  
**建议名称**: `git-permission-mapper.ts` 或 `git-platform-permission-mapper.ts`

**理由**: 避免被误认为是通用权限映射工具

#### 5.2.2 添加文档说明

在文件顶部添加清晰的说明：

```typescript
/**
 * Git 平台权限映射工具
 *
 * 专门用于 GitOps 业务流程中的权限同步
 * 将系统内部角色映射为 GitHub/GitLab 平台权限
 *
 * ⚠️ 注意: 这不是通用 RBAC 系统
 * - 仅用于 Git 协作者权限同步
 * - 不提供权限检查功能
 * - 不应用于其他业务场景
 *
 * 如需通用 RBAC，请使用 @casl/ability
 */
```

#### 5.2.3 类型定义移到 @juanie/types

**当前**: 类型定义在 `permission-mapper.ts` 中  
**建议**: 移到 `packages/types/src/git.types.ts`

**理由**:
- 类型可以被其他模块复用
- 保持类型定义的集中管理
- 遵循项目规范

---

## 6. 执行计划

### 6.1 立即执行 (Day 6)

**任务**: 文档更新和类型移动

1. ✅ **保持文件位置不变**
   - 位置: `packages/services/business/src/gitops/git-sync/permission-mapper.ts`
   - 理由: 当前位置正确

2. ✅ **添加清晰的文档说明**
   - 在文件顶部添加详细注释
   - 说明这是 Git 平台映射工具，不是通用 RBAC
   - 警告不要用于其他业务场景

3. ✅ **类型定义移到 @juanie/types**
   - 创建 `packages/types/src/git.types.ts`
   - 移动 `ProjectRole`, `OrganizationRole`, `GitPermission` 等类型
   - 更新导入路径

4. ✅ **更新导出**
   - 更新 `packages/services/business/src/index.ts`
   - 从 `@juanie/types` 导入类型
   - 保持函数导出不变

### 6.2 可选优化 (Day 7)

**任务**: 重命名和测试更新

1. ⏳ **重命名文件** (可选)
   - 从 `permission-mapper.ts` → `git-permission-mapper.ts`
   - 更新所有导入路径
   - 更新测试文件名

2. ⏳ **测试文件更新**
   - 确保所有测试通过
   - 添加类型导入测试

### 6.3 未来规划 (Week 2+)

**如果需要通用 RBAC**:

1. 📋 **评估需求**
   - 是否需要细粒度权限控制？
   - 是否需要动态权限规则？
   - 是否需要资源级权限？

2. 📋 **选择方案**
   - 推荐: `@casl/ability` (成熟、类型安全、灵活)
   - 在 Foundation 层创建 `rbac` 模块
   - 提供统一的权限检查接口

3. 📋 **实施步骤**
   - 安装 `@casl/ability`
   - 创建 `packages/services/foundation/src/rbac/`
   - 定义权限规则
   - 集成到现有服务

---

## 7. 总结

### 7.1 核心结论

1. ✅ **当前实现不是 RBAC 系统**
   - 是 Git 平台权限映射工具
   - 专门用于 GitOps 业务流程

2. ✅ **当前位置正确**
   - 应该保持在 Business 层 GitOps 模块
   - 不应该移到 Foundation 层

3. ✅ **不需要重构**
   - 只需要改进文档和类型组织
   - 避免被误认为通用 RBAC

4. ✅ **遵循架构原则**
   - Business 层可以包含平台集成逻辑
   - Foundation 层应该保持平台无关

### 7.2 行动项

**立即执行**:
- [x] 分析完成
- [ ] 添加文档说明
- [ ] 移动类型定义到 @juanie/types
- [ ] 更新导出路径

**可选优化**:
- [ ] 重命名文件为 `git-permission-mapper.ts`
- [ ] 更新测试文件

**未来规划**:
- [ ] 如需通用 RBAC，使用 @casl/ability
- [ ] 在 Foundation 层创建 rbac 模块

---

## 8. 参考资料

**相关文档**:
- `docs/architecture/ARCHITECTURE-REFACTORING-MASTER-PLAN.md` - 总体重构计划
- `docs/architecture/CORE-FOUNDATION-CERTIFICATION.md` - Core & Foundation 层认证
- `.kiro/steering/project-guide.md` - 项目指南

**相关文件**:
- `packages/services/business/src/gitops/git-sync/permission-mapper.ts` - 当前实现
- `packages/services/business/src/gitops/git-sync/permission-mapper.test.ts` - 测试
- `packages/services/business/src/gitops/git-sync/git-sync.worker.ts` - 使用场景
- `packages/services/business/src/gitops/git-sync/conflict-resolution.service.ts` - 使用场景

**架构原则**:
- 使用成熟工具 - 不重复造轮子
- 关注点分离 - Business 层处理业务逻辑
- 避免临时方案 - 如需 RBAC 用成熟库
