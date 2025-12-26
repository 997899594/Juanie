# RBAC 系统与 Git Permission Mapper 的关系

**日期**: 2025-12-24  
**状态**: 分析完成

---

## 核心发现

两者**使用相同的角色定义**，但**职责完全不同**：

### 1. 共享的角色定义

#### 组织角色
```typescript
// RBAC (packages/core/src/rbac/casl/types.ts)
role: 'owner' | 'admin' | 'member'

// Git Permission Mapper (packages/services/business/src/gitops/git-sync/permission-mapper.ts)
type OrganizationRole = 'owner' | 'admin' | 'member' | 'billing'
```

#### 项目角色
```typescript
// RBAC (packages/core/src/rbac/casl/types.ts)
role: 'owner' | 'maintainer' | 'admin' | 'developer' | 'member' | 'viewer'

// Git Permission Mapper
type ProjectRole = 'owner' | 'maintainer' | 'developer' | 'viewer'
```

**关键点**: 角色定义来自数据库 schema，两者都使用相同的角色系统。

---

## 两者的关系和职责

### RBAC 系统 (Foundation 层)

**位置**: `packages/core/src/rbac/` → 应该移到 `packages/services/foundation/src/rbac/`

**职责**: **系统内部权限控制**
- ✅ 检查用户是否有权限执行操作
- ✅ 基于角色生成权限规则
- ✅ 保护 API 路由和服务方法
- ✅ 前后端共享权限逻辑

**输入**: 用户角色（来自数据库）
**输出**: 权限判断（can/cannot）

**示例**:
```typescript
// 检查用户是否可以删除项目
const ability = await caslAbilityFactory.createForProject(userId, projectId)
if (!ability.can('delete', 'Project')) {
  throw new PermissionDeniedError()
}
```

### Git Permission Mapper (Business 层)

**位置**: `packages/services/business/src/gitops/git-sync/permission-mapper.ts`

**职责**: **Git 平台权限映射**
- ✅ 将系统角色映射为 Git 平台权限
- ✅ 处理 GitHub/GitLab 的平台差异
- ✅ 用于 Git 协作者同步

**输入**: 系统角色（ProjectRole, OrganizationRole）
**输出**: Git 平台权限（GitHub: 'read'/'write'/'admin', GitLab: 20/30/40）

**示例**:
```typescript
// 将项目角色映射为 Git 权限
const gitPermission = mapProjectRoleToGitPermission('developer') // 'write'
const githubPermission = mapGitPermissionToGitHubPermission('write') // 'write'
const gitlabLevel = mapGitPermissionToGitLabAccessLevel('write') // 30
```

---

## 完整的权限流程

### 场景：添加项目成员并同步到 Git

```typescript
// 1️⃣ API Gateway - RBAC 检查权限
@UseGuards(CaslGuard)
@CanManageMembers('Project')
async addMember(projectId: string, userId: string, role: ProjectRole) {
  // RBAC 已经检查了当前用户是否有权限添加成员
  
  // 2️⃣ Business Layer - 添加成员到数据库
  await this.projectMembersService.add(projectId, userId, role)
  
  // 3️⃣ Git Sync - 使用 Permission Mapper 映射权限
  const gitPermission = mapProjectRoleToGitPermission(role)
  const platformPermission = mapPermissionForProvider(provider, gitPermission)
  
  // 4️⃣ Git Provider - 同步到 GitHub/GitLab
  await this.gitProvider.addCollaborator(
    provider,
    accessToken,
    repoFullName,
    username,
    platformPermission
  )
}
```

### 流程图

```
用户请求添加成员
    ↓
[1] RBAC 检查权限
    ├─ 获取当前用户的组织/项目角色
    ├─ 使用 CASL 生成权限规则
    └─ 检查是否有 'manage_members' 权限
    ↓
[2] 添加成员到数据库
    └─ project_members 表插入记录 (role: 'developer')
    ↓
[3] Git Permission Mapper
    ├─ mapProjectRoleToGitPermission('developer') → 'write'
    ├─ mapPermissionForProvider('github', 'write') → 'write'
    └─ mapPermissionForProvider('gitlab', 'write') → 30
    ↓
[4] Git Provider API
    ├─ GitHub: addCollaborator(repo, user, 'write')
    └─ GitLab: addMember(project, user, 30)
```

---

## 关键区别

| 维度 | RBAC 系统 | Git Permission Mapper |
|------|-----------|----------------------|
| **层级** | Foundation 层 | Business 层 |
| **职责** | 系统内部权限控制 | Git 平台权限映射 |
| **输入** | 用户 + 角色 | 系统角色 |
| **输出** | can/cannot 判断 | Git 平台权限值 |
| **使用场景** | API 路由保护、服务方法权限检查 | Git 协作者同步 |
| **依赖** | @casl/ability | 无（纯映射函数） |
| **前后端** | 前后端共享 | 仅后端使用 |
| **测试** | 权限规则测试 | 映射逻辑测试 |

---

## 为什么需要两个系统？

### 1. 关注点分离

**RBAC**: "用户能做什么？"
- 检查用户是否有权限添加成员
- 检查用户是否有权限删除项目
- 检查用户是否有权限部署

**Git Permission Mapper**: "Git 平台需要什么权限？"
- Developer 角色在 GitHub 上是 'write'
- Developer 角色在 GitLab 上是 30 (Developer)
- Viewer 角色在 GitHub 上是 'read'

### 2. 不同的抽象层次

**RBAC**: 业务层抽象
- 操作: create, read, update, delete, deploy, manage_members
- 资源: Project, Environment, Deployment, Organization

**Git Permission Mapper**: 平台层抽象
- GitHub: read, triage, write, maintain, admin
- GitLab: 10 (Guest), 20 (Reporter), 30 (Developer), 40 (Maintainer)

### 3. 不同的变化频率

**RBAC**: 相对稳定
- 角色定义很少变化
- 权限规则相对固定

**Git Permission Mapper**: 可能变化
- GitHub/GitLab API 可能更新
- 新增其他 Git 平台（Gitea, Bitbucket）
- 映射策略可能调整

---

## 两者的协作

### 示例 1: 添加项目成员

```typescript
// Step 1: RBAC 检查权限
const ability = await caslAbilityFactory.createForProject(currentUserId, projectId)
if (!ability.can('manage_members', 'Project')) {
  throw new PermissionDeniedError('Project', 'manage_members')
}

// Step 2: 添加成员到数据库
await db.insert(projectMembers).values({
  projectId,
  userId: newUserId,
  role: 'developer', // 系统角色
})

// Step 3: 映射为 Git 权限
const gitPermission = mapProjectRoleToGitPermission('developer') // 'write'

// Step 4: 同步到 Git 平台
await gitProvider.addCollaborator(provider, token, repo, username, gitPermission)
```

### 示例 2: 更新成员角色

```typescript
// Step 1: RBAC 检查权限
if (!ability.can('manage_members', 'Project')) {
  throw new PermissionDeniedError()
}

// Step 2: 更新数据库
await db.update(projectMembers)
  .set({ role: 'maintainer' })
  .where(eq(projectMembers.id, memberId))

// Step 3: 映射新权限
const newGitPermission = mapProjectRoleToGitPermission('maintainer') // 'admin'

// Step 4: 更新 Git 平台权限
await gitProvider.updateCollaboratorPermission(provider, token, repo, username, newGitPermission)
```

---

## 类型定义应该放在哪里？

### 当前问题

角色类型定义分散在三个地方：
1. 数据库 schema (`packages/database/src/schemas/`)
2. RBAC 系统 (`packages/core/src/rbac/casl/types.ts`)
3. Git Permission Mapper (`packages/services/business/src/gitops/git-sync/permission-mapper.ts`)

### 建议方案

**统一到 `@juanie/types`**:

```typescript
// packages/types/src/roles.ts

/**
 * 组织成员角色
 */
export type OrganizationRole = 'owner' | 'admin' | 'member' | 'billing'

/**
 * 项目成员角色
 */
export type ProjectRole = 'owner' | 'maintainer' | 'developer' | 'viewer'

/**
 * 团队成员角色
 */
export type TeamRole = 'owner' | 'maintainer' | 'member'
```

**使用**:
```typescript
// RBAC
import type { OrganizationRole, ProjectRole } from '@juanie/types'

// Git Permission Mapper
import type { ProjectRole } from '@juanie/types'

// Database Schema
import type { ProjectRole } from '@juanie/types'
```

---

## 总结

### 关系

1. ✅ **共享角色定义** - 两者使用相同的角色系统（来自数据库）
2. ✅ **职责不同** - RBAC 管系统内权限，Mapper 管 Git 平台映射
3. ✅ **协作关系** - RBAC 先检查权限，Mapper 后映射同步
4. ✅ **层级不同** - RBAC 在 Foundation，Mapper 在 Business

### 行动项

1. ✅ **移动 RBAC 到 Foundation 层** - 修正架构错误
2. ✅ **保持 Git Permission Mapper 在 Business 层** - 位置正确
3. ✅ **统一类型定义到 @juanie/types** - 避免重复定义
4. ✅ **更新文档** - 说明两者的关系和协作

### 最终架构

```
@juanie/types
  └─ roles.ts (统一角色定义)
       ↓
Foundation Layer
  └─ rbac/ (RBAC 系统)
       ├─ 使用角色定义
       └─ 提供权限检查
            ↓
Business Layer
  └─ gitops/git-sync/
       ├─ permission-mapper.ts (Git 权限映射)
       ├─ 使用角色定义
       └─ 映射为 Git 平台权限
```

**结论**: 两者是**互补关系**，不是**重复实现**。RBAC 管"能不能做"，Mapper 管"怎么同步"。
