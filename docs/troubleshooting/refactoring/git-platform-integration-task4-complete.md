# Git 平台集成 - 任务 4 完成总结

## 任务概述

实现权限映射工具函数，用于在平台角色和 Git 平台权限之间进行转换。

## 完成时间

2024-12-01

## 实现内容

### 1. 权限映射工具 (permission-mapper.ts)

**位置**: `packages/services/business/src/gitops/git-sync/permission-mapper.ts`

#### 核心类型定义

```typescript
// 项目成员角色
type ProjectRole = 'owner' | 'maintainer' | 'developer' | 'viewer'

// 组织成员角色
type OrganizationRole = 'owner' | 'admin' | 'member' | 'billing'

// Git 权限级别
type GitPermission = 'read' | 'write' | 'admin'
```

#### 枚举定义

**GitLab 访问级别**:
- `NoAccess = 0`
- `MinimalAccess = 5`
- `Guest = 10`
- `Reporter = 20` (read)
- `Developer = 30` (write)
- `Maintainer = 40` (admin)
- `Owner = 50` (admin)

**GitHub 仓库权限**:
- `Read` - 只读访问
- `Triage` - 分类权限
- `Write` - 读写访问
- `Maintain` - 维护权限
- `Admin` - 管理权限

**GitHub 组织角色**:
- `Member` - 普通成员
- `Admin` - 管理员

### 2. 映射函数

#### 项目角色映射

**`mapProjectRoleToGitPermission(role: ProjectRole): GitPermission`**

| 项目角色 | Git 权限 |
|----------|----------|
| owner | admin |
| maintainer | admin |
| developer | write |
| viewer | read |

#### 组织角色映射

**`mapOrgRoleToGitPermission(role: OrganizationRole): GitPermission`**

| 组织角色 | Git 权限 |
|----------|----------|
| owner | admin |
| admin | admin |
| member | write |
| billing | read |

#### GitLab 权限映射

**`mapGitPermissionToGitLabAccessLevel(permission: GitPermission): number`**

| Git 权限 | GitLab 级别 | 说明 |
|----------|-------------|------|
| admin | 40 | Maintainer |
| write | 30 | Developer |
| read | 20 | Reporter |

**`mapGitLabAccessLevelToGitPermission(accessLevel: number): GitPermission`**

| GitLab 级别 | Git 权限 |
|-------------|----------|
| >= 40 | admin |
| >= 30 | write |
| < 30 | read |

#### GitHub 权限映射

**`mapGitPermissionToGitHubPermission(permission: GitPermission): GitHubRepositoryPermission`**

| Git 权限 | GitHub 权限 |
|----------|-------------|
| admin | Admin |
| write | Write |
| read | Read |

**`mapGitHubPermissionToGitPermission(permission: string): GitPermission`**

| GitHub 权限 | Git 权限 |
|-------------|----------|
| Admin, Maintain | admin |
| Write, Triage | write |
| Read | read |

#### GitHub 组织角色映射

**`mapOrgRoleToGitHubOrgRole(role: OrganizationRole): GitHubOrganizationRole`**

| 组织角色 | GitHub 角色 |
|----------|-------------|
| owner, admin | Admin |
| member, billing | Member |

**`mapGitHubOrgRoleToOrgRole(role: string): OrganizationRole`**

| GitHub 角色 | 组织角色 |
|-------------|----------|
| Admin | admin |
| Member | member |

### 3. 通用映射函数

#### `mapPermissionForProvider(provider, permission)`

根据 Git 平台类型自动选择正确的映射：
- GitHub: 返回字符串权限 ('read', 'write', 'admin')
- GitLab: 返回数字访问级别 (20, 30, 40)

#### `mapPermissionFromProvider(provider, permission)`

从平台特定权限转换为通用 Git 权限：
- GitHub: 从字符串权限转换
- GitLab: 从数字访问级别转换

### 4. 验证函数

- `isValidGitPermission(permission)` - 验证 Git 权限是否有效
- `isValidProjectRole(role)` - 验证项目角色是否有效
- `isValidOrganizationRole(role)` - 验证组织角色是否有效

### 5. 单元测试 (permission-mapper.test.ts)

**位置**: `packages/services/business/src/gitops/git-sync/permission-mapper.test.ts`

#### 测试覆盖

✅ **53 个测试全部通过**

测试套件包括：

1. **项目角色映射测试** (5 个测试)
   - 测试所有项目角色到 Git 权限的映射
   - 测试未知角色的默认行为

2. **组织角色映射测试** (5 个测试)
   - 测试所有组织角色到 Git 权限的映射
   - 测试未知角色的默认行为

3. **GitLab 访问级别映射测试** (8 个测试)
   - 双向映射测试
   - 所有访问级别的覆盖

4. **GitHub 权限映射测试** (8 个测试)
   - 双向映射测试
   - 所有权限级别的覆盖

5. **GitHub 组织角色映射测试** (6 个测试)
   - 双向映射测试
   - 所有角色的覆盖

6. **平台特定映射测试** (8 个测试)
   - 测试 GitHub 和 GitLab 的特定映射
   - 测试双向转换

7. **验证函数测试** (6 个测试)
   - 测试所有验证函数
   - 测试有效和无效输入

8. **往返映射测试** (4 个测试)
   - 确保映射的一致性
   - 测试 permission → platform → permission 的往返

9. **边界情况测试** (3 个测试)
   - 大小写敏感性
   - 超出范围的数值
   - 未知值的安全默认值

## 权限映射矩阵

### 完整映射关系

```
平台角色 → Git 权限 → GitHub 权限 → GitLab 级别
─────────────────────────────────────────────────
owner      → admin   → Admin      → 40 (Maintainer)
maintainer → admin   → Admin      → 40 (Maintainer)
developer  → write   → Write      → 30 (Developer)
viewer     → read    → Read       → 20 (Reporter)
```

### 组织角色映射

```
组织角色 → Git 权限 → GitHub 组织角色
──────────────────────────────────
owner    → admin   → Admin
admin    → admin   → Admin
member   → write   → Member
billing  → read    → Member
```

## 设计原则

### 1. 安全默认值

所有未知或无效的输入都默认为最低权限 (`read`)，确保系统安全。

### 2. 双向映射

所有映射函数都支持双向转换，确保数据一致性。

### 3. 平台抽象

通过统一的 `GitPermission` 类型抽象不同平台的权限系统，简化上层逻辑。

### 4. 类型安全

使用 TypeScript 的类型系统确保编译时的类型安全。

### 5. 可扩展性

枚举和类型定义使得添加新的权限级别或平台变得容易。

## 使用示例

### 基本映射

```typescript
import { mapProjectRoleToGitPermission } from '@juanie/service-business'

// 项目角色 → Git 权限
const permission = mapProjectRoleToGitPermission('developer') // 'write'
```

### 平台特定映射

```typescript
import { 
  mapPermissionForProvider,
  mapPermissionFromProvider 
} from '@juanie/service-business'

// Git 权限 → 平台权限
const githubPerm = mapPermissionForProvider('github', 'admin') // 'admin'
const gitlabPerm = mapPermissionForProvider('gitlab', 'admin') // 40

// 平台权限 → Git 权限
const gitPerm1 = mapPermissionFromProvider('github', 'admin') // 'admin'
const gitPerm2 = mapPermissionFromProvider('gitlab', 40) // 'admin'
```

### 验证

```typescript
import { 
  isValidGitPermission,
  isValidProjectRole 
} from '@juanie/service-business'

if (isValidGitPermission(permission)) {
  // 权限有效
}

if (isValidProjectRole(role)) {
  // 角色有效
}
```

## 测试结果

```bash
✓ 53 个测试全部通过
✓ 79 个断言全部成功
✓ 执行时间: 113ms
```

### 测试覆盖率

- ✅ 所有映射函数
- ✅ 所有验证函数
- ✅ 边界情况
- ✅ 往返一致性
- ✅ 错误处理

## 导出配置

权限映射工具已导出到 `@juanie/service-business` 包：

```typescript
// packages/services/business/src/index.ts
export * from './gitops/git-sync/permission-mapper'
```

可以直接从 business 包导入使用：

```typescript
import {
  mapProjectRoleToGitPermission,
  mapOrgRoleToGitPermission,
  mapPermissionForProvider,
  // ... 其他函数
} from '@juanie/service-business'
```

## 下一步

任务 5: Git 同步服务
- 创建 GitSyncService
- 实现 syncProjectMember() 方法
- 实现 removeMemberAccess() 方法
- 集成队列处理（BullMQ）
- 实现队列 Worker 处理同步任务

## 相关文档

- [Git 平台集成需求](.kiro/specs/git-platform-integration/requirements.md)
- [Git 平台集成设计](.kiro/specs/git-platform-integration/design.md)
- [任务 3 完成总结](./git-platform-integration-task3-complete.md)
- [GitHub API 文档](https://docs.github.com/en/rest)
- [GitLab API 文档](https://docs.gitlab.com/ee/api/)

---

**状态**: ✅ 完成  
**日期**: 2024-12-01  
**执行者**: AI DevOps Platform Team
