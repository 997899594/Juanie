# RBAC 和 Git 权限同步架构

## 🎯 核心目标

**让用户永远不需要打开 GitHub/GitLab，在平台内完成所有 Git 操作**

包括：
- ✅ 仓库管理（创建、删除、设置）
- ✅ 成员管理（邀请用户到仓库）
- ✅ 权限管理（设置用户在仓库的权限）
- ✅ 代码浏览、Commits、Branches
- ⭐ Issues、PRs、Code Review（可选）

## 🏗️ 架构概览

### 三层权限模型

```
平台层 (Platform)
├─ 系统管理员
└─ 普通用户

组织层 (Organization)
├─ Owner (所有者)
├─ Admin (管理员)
├─ Member (成员)
└─ Billing (财务)

项目层 (Project)
├─ Maintainer (维护者)
├─ Developer (开发者)
└─ Viewer (查看者)

Git 平台层 (GitHub/GitLab)
├─ 通过 OAuth 关联用户账号
├─ 自动同步权限
└─ 双向同步变更
```

## 📊 权限矩阵

### 组织级别权限

| 操作 | Owner | Admin | Member | Billing |
|-----|-------|-------|--------|---------|
| 管理组织设置 | ✅ | ✅ | ❌ | ❌ |
| 管理成员 | ✅ | ✅ | ❌ | ❌ |
| 创建项目 | ✅ | ✅ | ✅ | ❌ |
| 删除组织 | ✅ | ❌ | ❌ | ❌ |
| 配置 Git 认证 | ✅ | ✅ | ❌ | ❌ |
| 查看账单 | ✅ | ✅ | ❌ | ✅ |
| 管理账单 | ✅ | ❌ | ❌ | ✅ |

### 项目级别权限

| 操作 | Maintainer | Developer | Viewer |
|-----|-----------|-----------|--------|
| 删除项目 | ✅ | ❌ | ❌ |
| 配置项目 | ✅ | ❌ | ❌ |
| 部署项目 | ✅ | ✅ | ❌ |
| 查看日志 | ✅ | ✅ | ✅ |
| 管理环境 | ✅ | ✅ | ❌ |
| 查看项目 | ✅ | ✅ | ✅ |

## 🔗 GitHub 权限映射

### GitHub Organization Roles

```typescript
// 平台角色 → GitHub 组织角色
const githubRoleMapping = {
  // 组织级别
  'org:owner': {
    github: 'owner',
    permissions: [
      'admin:org',           // 管理组织
      'write:org',          // 修改组织
      'read:org',           // 读取组织
      'manage_billing:org', // 管理账单
    ],
    description: '完全控制组织和所有仓库'
  },
  
  'org:admin': {
    github: 'admin',
    permissions: [
      'admin:org',
      'write:org',
      'read:org',
    ],
    description: '管理组织设置和成员，但不能删除组织'
  },
  
  'org:member': {
    github: 'member',
    permissions: [
      'read:org',
      'write:repo',  // 可以推送到仓库
      'read:repo',
    ],
    description: '组织的普通成员'
  },
}

// 项目级别 → GitHub 仓库权限
const githubRepoPermissions = {
  'project:maintainer': {
    github: 'admin',
    permissions: [
      'admin:repo',  // 管理仓库设置
      'write:repo',  // 推送代码
      'read:repo',   // 读取代码
    ],
    description: '完全控制仓库'
  },
  
  'project:developer': {
    github: 'write',
    permissions: [
      'write:repo',
      'read:repo',
    ],
    description: '可以推送代码'
  },
  
  'project:viewer': {
    github: 'read',
    permissions: [
      'read:repo',
    ],
    description: '只读访问'
  },
}
```

### GitHub App 权限配置

```yaml
# GitHub App 需要的权限
permissions:
  # 组织级别
  organization_administration: read
  organization_members: read
  
  # 仓库级别
  contents: write          # 读写代码
  metadata: read          # 读取仓库元数据
  pull_requests: write    # 管理 PR
  workflows: write        # 管理 GitHub Actions
  
  # 部署相关
  deployments: write      # 管理部署
  environments: write     # 管理环境
```

## 🔗 GitLab 权限映射

### GitLab Group Roles

```typescript
// 平台角色 → GitLab 组角色
const gitlabRoleMapping = {
  // 组织级别
  'org:owner': {
    gitlab: 'owner',
    permissions: [
      'api',                    // 完整 API 访问
      'read_api',              // 读取 API
      'write_repository',      // 写入仓库
      'read_repository',       // 读取仓库
      'admin_group',           // 管理组
    ],
    accessLevel: 50,  // Owner
    description: '完全控制组和所有项目'
  },
  
  'org:admin': {
    gitlab: 'maintainer',
    permissions: [
      'api',
      'write_repository',
      'read_repository',
    ],
    accessLevel: 40,  // Maintainer
    description: '管理组设置和成员'
  },
  
  'org:member': {
    gitlab: 'developer',
    permissions: [
      'read_api',
      'write_repository',
      'read_repository',
    ],
    accessLevel: 30,  // Developer
    description: '组的普通成员'
  },
}

// 项目级别 → GitLab 项目权限
const gitlabProjectPermissions = {
  'project:maintainer': {
    gitlab: 'maintainer',
    accessLevel: 40,
    permissions: [
      'admin_project',      // 管理项目
      'write_repository',   // 推送代码
      'read_repository',    // 读取代码
      'admin_pipeline',     // 管理 CI/CD
    ],
    description: '完全控制项目'
  },
  
  'project:developer': {
    gitlab: 'developer',
    accessLevel: 30,
    permissions: [
      'write_repository',
      'read_repository',
      'run_pipeline',
    ],
    description: '可以推送代码和运行 CI/CD'
  },
  
  'project:viewer': {
    gitlab: 'reporter',
    accessLevel: 20,
    permissions: [
      'read_repository',
      'read_pipeline',
    ],
    description: '只读访问'
  },
}
```

### GitLab Group Token 权限

```yaml
# Group Access Token 需要的权限
scopes:
  - api                    # 完整 API 访问
  - read_api              # 读取 API
  - read_repository       # 读取仓库
  - write_repository      # 写入仓库
  - read_registry         # 读取容器镜像
  - write_registry        # 写入容器镜像
```

## 🎨 UI 设计

### 1. 组织成员管理

```
┌─────────────────────────────────────────────────┐
│ Acme Corp - 成员管理                             │
├─────────────────────────────────────────────────┤
│                                                 │
│ 成员列表                          [邀请成员]     │
│                                                 │
│ ┌───────────────────────────────────────────┐  │
│ │ 👤 张三                                    │  │
│ │    zhang@example.com                      │  │
│ │    角色: Owner                             │  │
│ │    GitHub: @zhangsan                      │  │
│ │    权限: 完全控制                          │  │
│ │    [管理]                                  │  │
│ └───────────────────────────────────────────┘  │
│                                                 │
│ ┌───────────────────────────────────────────┐  │
│ │ 👤 李四                                    │  │
│ │    li@example.com                         │  │
│ │    角色: Admin [▼]                        │  │
│ │    GitHub: @lisi                          │  │
│ │    权限: 管理组织和成员                    │  │
│ │    [管理] [移除]                           │  │
│ └───────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 2. 角色选择器（带权限说明）

```
┌─────────────────────────────────────────────────┐
│ 选择角色                                         │
├─────────────────────────────────────────────────┤
│                                                 │
│ ○ Owner (所有者)                                │
│   完全控制组织和所有项目                         │
│   • 管理组织设置                                 │
│   • 管理成员和权限                               │
│   • 配置 Git 认证                                │
│   • 删除组织                                     │
│   GitHub: owner | GitLab: owner (50)           │
│                                                 │
│ ● Admin (管理员)                                │
│   管理组织设置和成员                             │
│   • 管理组织设置                                 │
│   • 管理成员和权限                               │
│   • 配置 Git 认证                                │
│   GitHub: admin | GitLab: maintainer (40)      │
│                                                 │
│ ○ Member (成员)                                 │
│   创建和管理自己的项目                           │
│   • 创建项目                                     │
│   • 查看组织项目                                 │
│   GitHub: member | GitLab: developer (30)      │
│                                                 │
│ ○ Billing (财务)                                │
│   管理账单和订阅                                 │
│   • 查看和管理账单                               │
│   • 管理订阅                                     │
│                                                 │
│                          [取消] [确认]          │
└─────────────────────────────────────────────────┘
```

### 3. 权限检查提示

```
┌─────────────────────────────────────────────────┐
│ ⚠️ 权限不足                                      │
├─────────────────────────────────────────────────┤
│                                                 │
│ 你当前的角色: Member                             │
│                                                 │
│ 此操作需要: Admin 或 Owner 权限                  │
│                                                 │
│ 需要的权限:                                      │
│ • 配置 Git 认证                                  │
│                                                 │
│ 请联系组织管理员:                                │
│ • 张三 (Owner) - zhang@example.com             │
│ • 李四 (Admin) - li@example.com                │
│                                                 │
│                          [知道了]               │
└─────────────────────────────────────────────────┘
```

## 💻 技术实现

### 1. 权限检查中间件

```typescript
// 装饰器：检查组织权限
export function RequireOrgRole(...roles: OrgRole[]) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const user = this.getCurrentUser()
      const orgId = args[0]?.organizationId
      
      const userRole = await this.getUserOrgRole(user.id, orgId)
      
      if (!roles.includes(userRole)) {
        throw new ForbiddenException(
          `需要 ${roles.join(' 或 ')} 权限`
        )
      }
      
      return originalMethod.apply(this, args)
    }
  }
}

// 使用示例
@RequireOrgRole('owner', 'admin')
async configureGitAuth(orgId: string, config: GitAuthConfig) {
  // 只有 owner 和 admin 可以配置
}
```

### 2. 权限服务

```typescript
@Injectable()
export class PermissionService {
  /**
   * 检查用户是否有组织权限
   */
  async hasOrgPermission(
    userId: string,
    orgId: string,
    permission: OrgPermission
  ): Promise<boolean> {
    const role = await this.getUserOrgRole(userId, orgId)
    return this.orgRoleHasPermission(role, permission)
  }

  /**
   * 检查用户是否有项目权限
   */
  async hasProjectPermission(
    userId: string,
    projectId: string,
    permission: ProjectPermission
  ): Promise<boolean> {
    const role = await this.getUserProjectRole(userId, projectId)
    return this.projectRoleHasPermission(role, permission)
  }

  /**
   * 获取用户在 GitHub/GitLab 的实际权限
   */
  async getGitPermissions(
    userId: string,
    orgId: string,
    provider: 'github' | 'gitlab'
  ): Promise<GitPermissions> {
    const role = await this.getUserOrgRole(userId, orgId)
    
    if (provider === 'github') {
      return this.mapToGitHubPermissions(role)
    } else {
      return this.mapToGitLabPermissions(role)
    }
  }

  /**
   * 映射到 GitHub 权限
   */
  private mapToGitHubPermissions(role: OrgRole): GitHubPermissions {
    const mapping = {
      owner: { role: 'owner', scopes: ['admin:org', 'repo'] },
      admin: { role: 'admin', scopes: ['admin:org', 'repo'] },
      member: { role: 'member', scopes: ['repo'] },
    }
    return mapping[role]
  }

  /**
   * 映射到 GitLab 权限
   */
  private mapToGitLabPermissions(role: OrgRole): GitLabPermissions {
    const mapping = {
      owner: { accessLevel: 50, scopes: ['api', 'write_repository'] },
      admin: { accessLevel: 40, scopes: ['api', 'write_repository'] },
      member: { accessLevel: 30, scopes: ['write_repository'] },
    }
    return mapping[role]
  }
}
```

### 3. 前端权限控制

```vue
<template>
  <div>
    <!-- 根据权限显示/隐藏 -->
    <Button 
      v-if="can('org:manage_settings')"
      @click="openSettings"
    >
      组织设置
    </Button>

    <!-- 根据权限禁用 -->
    <Button 
      :disabled="!can('project:deploy')"
      @click="deploy"
    >
      部署项目
    </Button>

    <!-- 权限不足提示 -->
    <Alert v-if="!can('org:configure_git')">
      <AlertTitle>权限不足</AlertTitle>
      <AlertDescription>
        需要 Admin 或 Owner 权限才能配置 Git 认证
      </AlertDescription>
    </Alert>
  </div>
</template>

<script setup lang="ts">
import { usePermissions } from '@/composables/usePermissions'

const { can, userRole, requiredRole } = usePermissions()
</script>
```

### 4. Composable: usePermissions

```typescript
// composables/usePermissions.ts
export function usePermissions() {
  const workspaceStore = useWorkspaceStore()
  const userStore = useUserStore()

  const userRole = computed(() => {
    if (!workspaceStore.currentWorkspace) return null
    
    if (workspaceStore.isPersonal) {
      return 'owner' // 个人工作空间，用户是 owner
    }
    
    // 从组织成员关系中获取角色
    return workspaceStore.currentWorkspace.role
  })

  const can = (permission: string): boolean => {
    if (!userRole.value) return false
    
    // 检查权限
    return hasPermission(userRole.value, permission)
  }

  const requiredRole = (permission: string): string[] => {
    return getRequiredRoles(permission)
  }

  return {
    userRole,
    can,
    requiredRole,
  }
}
```

## 🔄 权限同步流程

### 1. 用户加入组织

```
1. 用户接受邀请
   ↓
2. 在平台创建组织成员记录
   role: 'member'
   ↓
3. 同步到 GitHub/GitLab
   GitHub: 添加到组织，角色 'member'
   GitLab: 添加到组，访问级别 30
   ↓
4. 配置项目访问权限
   根据项目设置自动授予相应权限
```

### 2. 角色变更

```
1. 管理员修改用户角色
   member → admin
   ↓
2. 更新平台数据库
   ↓
3. 同步到 GitHub/GitLab
   GitHub: 更新组织角色
   GitLab: 更新访问级别 (30 → 40)
   ↓
4. 更新项目权限
   自动调整所有项目的访问权限
```

### 3. 用户离开组织

```
1. 从组织移除用户
   ↓
2. 删除平台组织成员记录
   ↓
3. 同步到 GitHub/GitLab
   GitHub: 从组织移除
   GitLab: 从组移除
   ↓
4. 撤销所有项目访问权限
```

## 📊 数据库设计

```typescript
// 组织成员表
interface OrganizationMember {
  id: string
  organizationId: string
  userId: string
  role: 'owner' | 'admin' | 'member' | 'billing'
  
  // Git 平台同步状态
  githubSynced: boolean
  githubRole: string
  gitlabSynced: boolean
  gitlabAccessLevel: number
  
  createdAt: Date
  updatedAt: Date
}

// 项目成员表
interface ProjectMember {
  id: string
  projectId: string
  userId: string
  role: 'maintainer' | 'developer' | 'viewer'
  
  // 继承自组织角色
  inheritedFromOrg: boolean
  
  createdAt: Date
  updatedAt: Date
}
```

## 🔗 用户-Git账号关联

### 核心挑战

```typescript
// 问题：用户身份映射
平台用户 (user@platform.com) → GitHub 用户 (@github_username)
                                → GitLab 用户 (@gitlab_username)

// 解决方案：OAuth 关联
1. 用户在平台注册
2. 通过 OAuth 连接 GitHub/GitLab 账号
3. 平台记录关联关系
4. 自动同步权限
```

### 数据库 Schema

```typescript
// user_git_accounts 表
interface UserGitAccount {
  id: string
  userId: string              // 平台用户 ID
  provider: 'github' | 'gitlab'
  
  // Git 平台用户信息
  gitUserId: string           // GitHub/GitLab 用户 ID
  gitUsername: string         // @username
  gitEmail: string
  gitAvatarUrl: string
  
  // OAuth 凭证（加密存储）
  accessToken: string         // 访问令牌
  refreshToken: string        // 刷新令牌
  tokenExpiresAt: Date
  
  // 同步状态
  connectedAt: Date
  lastSyncAt: Date
  syncStatus: 'active' | 'expired' | 'revoked'
  
  createdAt: Date
  updatedAt: Date
}

// project_git_collaborators 表（同步状态）
interface ProjectGitCollaborator {
  id: string
  projectId: string
  userId: string
  
  // 平台权限
  platformRole: 'maintainer' | 'developer' | 'viewer'
  
  // Git 平台权限
  gitProvider: 'github' | 'gitlab'
  gitPermission: string       // GitHub: 'admin' | 'write' | 'read'
                              // GitLab: 50 | 40 | 30 | 20
  
  // 同步状态
  syncStatus: 'synced' | 'pending' | 'failed'
  lastSyncedAt: Date
  syncError: string
  
  createdAt: Date
  updatedAt: Date
}
```

## 🔄 权限同步服务

### GitPermissionSyncService

```typescript
@Injectable()
export class GitPermissionSyncService {
  constructor(
    private readonly gitProvider: GitProviderService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * 同步项目成员到 Git 平台
   */
  async syncProjectMember(
    projectId: string,
    userId: string,
    role: 'maintainer' | 'developer' | 'viewer'
  ): Promise<void> {
    // 1. 检查用户是否连接了 Git 账号
    const gitAccount = await this.getGitAccount(userId)
    if (!gitAccount) {
      throw new Error('用户未连接 Git 账号，请先连接')
    }

    // 2. 获取项目的 Git 仓库信息
    const project = await this.db.projects.findById(projectId)
    const repo = project.repository

    // 3. 映射权限
    const gitPermission = this.mapPermission(role, repo.provider)

    // 4. 调用 Git API 添加协作者
    try {
      if (repo.provider === 'github') {
        await this.gitProvider.addGitHubCollaborator(
          repo.fullName,
          gitAccount.gitUsername,
          gitPermission
        )
      } else {
        await this.gitProvider.addGitLabMember(
          repo.fullName,
          gitAccount.gitUserId,
          gitPermission
        )
      }

      // 5. 记录同步状态
      await this.recordSync(projectId, userId, 'synced')
    } catch (error) {
      await this.recordSync(projectId, userId, 'failed', error.message)
      throw error
    }
  }

  /**
   * 映射平台角色到 Git 权限
   */
  private mapPermission(
    role: string,
    provider: 'github' | 'gitlab'
  ): string | number {
    if (provider === 'github') {
      const mapping = {
        maintainer: 'admin',
        developer: 'write',
        viewer: 'read',
      }
      return mapping[role]
    } else {
      const mapping = {
        maintainer: 40,  // Maintainer
        developer: 30,   // Developer
        viewer: 20,      // Reporter
      }
      return mapping[role]
    }
  }

  /**
   * 从 Git 平台同步（处理在 Git 平台直接修改的情况）
   */
  async syncFromGit(projectId: string): Promise<void> {
    const project = await this.db.projects.findById(projectId)
    const repo = project.repository

    // 获取 Git 平台的协作者列表
    const gitCollaborators = await this.gitProvider.listCollaborators(
      repo.provider,
      repo.fullName
    )

    // 对比平台成员列表
    const platformMembers = await this.db.projectMembers.findByProject(projectId)

    // 检测差异并同步
    for (const gitCollab of gitCollaborators) {
      const platformMember = platformMembers.find(
        m => m.gitUsername === gitCollab.username
      )

      if (!platformMember) {
        // Git 平台有，但平台没有 → 添加到平台
        await this.addMemberFromGit(projectId, gitCollab)
      } else if (this.hasPermissionMismatch(platformMember, gitCollab)) {
        // 权限不一致 → 以平台为准，同步到 Git
        await this.syncProjectMember(
          projectId,
          platformMember.userId,
          platformMember.role
        )
      }
    }
  }

  /**
   * 批量同步（定时任务）
   */
  @Cron('0 * * * *') // 每小时执行一次
  async syncAllProjects(): Promise<void> {
    const projects = await this.db.projects.findAll()

    for (const project of projects) {
      try {
        await this.syncFromGit(project.id)
      } catch (error) {
        this.logger.error(`Failed to sync project ${project.id}:`, error)
      }
    }
  }
}
```

### GitProviderService 扩展

```typescript
@Injectable()
export class GitProviderService {
  /**
   * 添加 GitHub 协作者
   */
  async addGitHubCollaborator(
    repoFullName: string,
    username: string,
    permission: 'admin' | 'write' | 'read'
  ): Promise<void> {
    const url = `https://api.github.com/repos/${repoFullName}/collaborators/${username}`
    
    await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.getGitHubToken()}`,
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({ permission }),
    })
  }

  /**
   * 添加 GitLab 成员
   */
  async addGitLabMember(
    projectPath: string,
    userId: string,
    accessLevel: number
  ): Promise<void> {
    const projectId = encodeURIComponent(projectPath)
    const url = `${this.gitlabUrl}/api/v4/projects/${projectId}/members`
    
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getGitLabToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        access_level: accessLevel,
      }),
    })
  }

  /**
   * 列出仓库协作者
   */
  async listCollaborators(
    provider: 'github' | 'gitlab',
    repoFullName: string
  ): Promise<GitCollaborator[]> {
    if (provider === 'github') {
      return this.listGitHubCollaborators(repoFullName)
    } else {
      return this.listGitLabMembers(repoFullName)
    }
  }

  /**
   * 移除协作者
   */
  async removeCollaborator(
    provider: 'github' | 'gitlab',
    repoFullName: string,
    username: string
  ): Promise<void> {
    if (provider === 'github') {
      await this.removeGitHubCollaborator(repoFullName, username)
    } else {
      await this.removeGitLabMember(repoFullName, username)
    }
  }
}
```

## 🎨 用户流程设计

### 1. 连接 Git 账号流程

```
┌─────────────────────────────────────────────────┐
│ 🔗 连接 Git 账号                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ 为了在平台内管理 Git 仓库，你需要连接你的        │
│ GitHub 或 GitLab 账号。                          │
│                                                 │
│ ┌───────────────────────────────────────────┐  │
│ │ 🐙 GitHub                                  │  │
│ │                                            │  │
│ │ 连接后可以：                                │  │
│ │ • 自动同步仓库权限                          │  │
│ │ • 在平台内管理代码                          │  │
│ │ • 查看 Commits 和 Branches                 │  │
│ │                                            │  │
│ │ 状态: 未连接                                │  │
│ │                                            │  │
│ │                    [连接 GitHub]           │  │
│ └───────────────────────────────────────────┘  │
│                                                 │
│ ┌───────────────────────────────────────────┐  │
│ │ 🦊 GitLab                                  │  │
│ │                                            │  │
│ │ 连接后可以：                                │  │
│ │ • 自动同步仓库权限                          │  │
│ │ • 在平台内管理代码                          │  │
│ │ • 查看 Commits 和 Branches                 │  │
│ │                                            │  │
│ │ 状态: 已连接 (@your_username)              │  │
│ │                                            │  │
│ │                    [重新连接] [断开连接]    │  │
│ └───────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 2. 添加项目成员（自动同步）

```
┌─────────────────────────────────────────────────┐
│ 添加成员到项目                                   │
├─────────────────────────────────────────────────┤
│                                                 │
│ 选择成员:                                        │
│ ┌───────────────────────────────────────────┐  │
│ │ 🔍 搜索成员...                             │  │
│ └───────────────────────────────────────────┘  │
│                                                 │
│ ┌───────────────────────────────────────────┐  │
│ │ ☑ 李四                                     │  │
│ │   li@example.com                          │  │
│ │   GitHub: @lisi ✅                        │  │
│ └───────────────────────────────────────────┘  │
│                                                 │
│ ┌───────────────────────────────────────────┐  │
│ │ ☐ 王五                                     │  │
│ │   wang@example.com                        │  │
│ │   ⚠️ 未连接 Git 账号                       │  │
│ └───────────────────────────────────────────┘  │
│                                                 │
│ 角色:                                            │
│ ○ Maintainer - 完全控制项目                     │
│ ● Developer - 可以推送代码                      │
│ ○ Viewer - 只读访问                            │
│                                                 │
│ 权限映射:                                        │
│ GitHub: write | GitLab: developer (30)         │
│                                                 │
│ ℹ️ 添加后将自动同步到 Git 平台                   │
│                                                 │
│                          [取消] [添加成员]      │
└─────────────────────────────────────────────────┘
```

### 3. 权限同步状态

```
┌─────────────────────────────────────────────────┐
│ 项目成员 - my-awesome-project                    │
├─────────────────────────────────────────────────┤
│                                                 │
│ ┌───────────────────────────────────────────┐  │
│ │ 👤 李四                                    │  │
│ │    li@example.com                         │  │
│ │    角色: Developer                         │  │
│ │    GitHub: @lisi                          │  │
│ │    权限: write                             │  │
│ │    同步状态: ✅ 已同步 (2分钟前)            │  │
│ │    [管理] [移除]                           │  │
│ └───────────────────────────────────────────┘  │
│                                                 │
│ ┌───────────────────────────────────────────┐  │
│ │ 👤 王五                                    │  │
│ │    wang@example.com                       │  │
│ │    角色: Developer                         │  │
│ │    ⚠️ 未连接 Git 账号                      │  │
│ │    同步状态: ⏸️ 等待连接                   │  │
│ │    [提醒连接] [移除]                       │  │
│ └───────────────────────────────────────────┘  │
│                                                 │
│ ┌───────────────────────────────────────────┐  │
│ │ 👤 赵六                                    │  │
│ │    zhao@example.com                       │  │
│ │    角色: Viewer                            │  │
│ │    GitLab: @zhaoliu                       │  │
│ │    权限: reporter (20)                     │  │
│ │    同步状态: ❌ 同步失败                    │  │
│ │    错误: Token 已过期                      │  │
│ │    [重试同步] [管理]                       │  │
│ └───────────────────────────────────────────┘  │
│                                                 │
│                          [批量同步] [添加成员]  │
└─────────────────────────────────────────────────┘
```

## ⚠️ 关键挑战和解决方案

### 挑战 1：用户未连接 Git 账号

**问题**：用户在平台有账号，但没有连接 GitHub/GitLab

**解决方案**：
```typescript
// 1. 检测未连接状态
if (!user.hasGitAccount(provider)) {
  // 2. 显示引导页面
  showConnectGitAccountModal()
  
  // 3. OAuth 流程
  redirectToOAuth(provider)
  
  // 4. 回调后自动同步
  await syncPendingPermissions(user.id)
}
```

### 挑战 2：Token 过期

**问题**：OAuth token 会过期，导致同步失败

**解决方案**：
```typescript
// 1. 定期检查 token 状态
@Cron('0 0 * * *') // 每天检查
async checkTokenExpiry() {
  const expiringTokens = await this.db.gitAccounts.findExpiring()
  
  for (const account of expiringTokens) {
    // 2. 自动刷新 token
    try {
      await this.refreshToken(account)
    } catch (error) {
      // 3. 刷新失败，通知用户重新连接
      await this.notifyUserToReconnect(account.userId)
    }
  }
}
```

### 挑战 3：权限冲突

**问题**：用户在 Git 平台直接修改了权限

**解决方案**：
```typescript
// 以平台权限为准
async resolveConflict(projectId: string, userId: string) {
  const platformRole = await this.getPlatformRole(projectId, userId)
  const gitPermission = await this.getGitPermission(projectId, userId)
  
  if (platformRole !== gitPermission) {
    // 同步到 Git 平台
    await this.syncToGit(projectId, userId, platformRole)
    
    // 记录冲突日志
    await this.logConflict({
      projectId,
      userId,
      platformRole,
      gitPermission,
      action: 'synced_to_git',
    })
  }
}
```

### 挑战 4：批量操作性能

**问题**：大量成员同步会很慢

**解决方案**：
```typescript
// 使用队列异步处理
@Injectable()
export class GitSyncQueue {
  async addSyncJob(projectId: string, userId: string, role: string) {
    await this.queue.add('git-sync', {
      projectId,
      userId,
      role,
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    })
  }

  @Process('git-sync')
  async processSyncJob(job: Job) {
    const { projectId, userId, role } = job.data
    await this.gitSyncService.syncProjectMember(projectId, userId, role)
  }
}
```

## 🎯 实施路线图

### Phase 1：基础权限同步（2-3周）

**目标**：实现基本的权限同步功能

- [ ] 用户-Git账号关联表
- [ ] OAuth 连接流程（GitHub + GitLab）
- [ ] 基础权限映射
- [ ] 添加/移除成员同步
- [ ] 同步状态显示

### Phase 2：双向同步（2周）

**目标**：保持平台和 Git 平台一致

- [ ] 定期从 Git 平台同步
- [ ] Webhook 监听 Git 平台变更
- [ ] 冲突检测和解决
- [ ] Token 自动刷新

### Phase 3：高级功能（3-4周）

**目标**：提升用户体验

- [ ] 代码浏览器
- [ ] Commits 历史
- [ ] Branches 管理
- [ ] 文件编辑（可选）
- [ ] 批量操作优化

### Phase 4：协作功能（4-6周，可选）

**目标**：完整的 Git 平台体验

- [ ] Issues 管理
- [ ] Pull Requests
- [ ] Code Review
- [ ] CI/CD 集成

## 🎯 总结

**核心设计原则**:

1. **OAuth 关联** - 用户必须连接 Git 账号
2. **平台角色为主** - 用户在平台的角色决定一切
3. **自动映射** - 自动映射到 GitHub/GitLab 的实际权限
4. **双向同步** - 平台和 Git 平台保持同步
5. **清晰可见** - UI 清晰显示权限和映射关系
6. **权限检查** - 前后端都进行权限验证

**用户体验**:
- 用户只需理解平台的角色（Owner/Admin/Member）
- 系统自动处理 GitHub/GitLab 的权限映射
- 清晰的权限提示和错误信息
- 永远不需要打开 GitHub/GitLab

**技术实现**:
- 使用 OAuth 2.0 连接 Git 账号
- 使用队列处理批量同步
- 使用 Webhook 监听变更
- 使用定时任务保持同步

**简洁、安全、易用！** 🔐
