# 个人工作空间设计方案

## 问题

当前架构要求项目必须属于组织,但个人用户不需要组织的复杂功能。

## 解决方案: 个人工作空间

### 1. 工作空间类型

```typescript
export type WorkspaceType = 'personal' | 'team'

// 扩展 organizations 表
export const organizations = pgTable('organizations', {
  // ... 现有字段
  
  type: text('type').notNull().default('team'), // 'personal' | 'team'
  ownerId: uuid('owner_id').references(() => users.id), // 个人工作空间的所有者
  
  // Git 同步 (仅 team 类型需要)
  gitProvider: text('git_provider'),
  gitOrgId: text('git_org_id'),
  gitSyncEnabled: boolean('git_sync_enabled').default(false),
})
```

### 2. 用户注册流程

```typescript
async function onUserRegister(user: User) {
  // 自动创建个人工作空间
  const personalWorkspace = await db.insert(organizations).values({
    id: generateId(),
    name: `${user.name}的工作空间`,
    slug: user.username || `user-${user.id}`,
    type: 'personal',
    ownerId: user.id,
    
    // 个人工作空间不需要 Git 组织同步
    gitProvider: null,
    gitOrgId: null,
    gitSyncEnabled: false,
  })
  
  // 用户自动成为工作空间的 owner
  await db.insert(organizationMembers).values({
    organizationId: personalWorkspace.id,
    userId: user.id,
    role: 'owner',
  })
}
```

### 3. 项目创建流程

#### 个人用户创建项目

```typescript
// 用户在个人工作空间创建项目
const project = await createProject({
  name: "my-app",
  organizationId: personalWorkspace.id,  // 个人工作空间
  
  // Git 仓库创建在用户个人账号下
  gitProvider: "github",
  gitRepoOwner: user.gitUsername,  // 个人用户名
  gitRepoName: "my-app",
})

// 在 GitHub 创建仓库
await gitProvider.createRepository('github', accessToken, {
  name: "my-app",
  visibility: "private",
})

// 仓库 URL: https://github.com/username/my-app
// 不需要组织!
```

#### 团队用户创建项目

```typescript
// 用户在团队工作空间创建项目
const project = await createProject({
  name: "team-app",
  organizationId: teamWorkspace.id,  // 团队工作空间
  
  // Git 仓库创建在组织下
  gitProvider: "github",
  gitRepoOwner: teamWorkspace.gitOrgName,  // 组织名
  gitRepoName: "team-app",
})

// 在 GitHub Organization 创建仓库
await gitProvider.createRepository('github', accessToken, {
  name: "team-app",
  visibility: "private",
  organization: teamWorkspace.gitOrgName,  // 在组织下创建
})

// 仓库 URL: https://github.com/org-name/team-app
```

### 4. 工作空间升级

个人用户需要团队协作时,可以升级:

```typescript
async function upgradeToTeamWorkspace(
  workspaceId: string,
  options: {
    teamName: string
    gitProvider?: 'github' | 'gitlab'
    gitOrgName?: string  // 关联已有组织
  }
) {
  // 1. 更新工作空间类型
  await db.update(organizations)
    .set({
      type: 'team',
      name: options.teamName,
      gitProvider: options.gitProvider,
      gitOrgName: options.gitOrgName,
      gitSyncEnabled: !!options.gitOrgName,
    })
    .where(eq(organizations.id, workspaceId))
  
  // 2. 迁移现有项目 (可选)
  // 将个人仓库转移到组织下
}
```

### 5. UI 设计

#### 新用户首次登录

```
┌─────────────────────────────────────┐
│  欢迎使用 AI DevOps Platform!       │
├─────────────────────────────────────┤
│                                     │
│  已为您创建个人工作空间              │
│  "张三的工作空间"                    │
│                                     │
│  您可以:                             │
│  • 立即创建项目                      │
│  • 部署应用                          │
│  • 管理环境                          │
│                                     │
│  [开始创建项目]                      │
│                                     │
│  需要团队协作?                       │
│  [创建团队工作空间]                  │
│                                     │
└─────────────────────────────────────┘
```

#### 工作空间切换器

```vue
<WorkspaceSwitcher>
  <!-- 个人工作空间 -->
  <WorkspaceItem type="personal">
    <Avatar />
    <div>
      <h4>我的工作空间</h4>
      <p>个人项目</p>
    </div>
  </WorkspaceItem>
  
  <!-- 团队工作空间 -->
  <WorkspaceItem type="team">
    <Avatar />
    <div>
      <h4>公司团队</h4>
      <p>5 个成员</p>
      <Badge>已同步 GitHub</Badge>
    </div>
  </WorkspaceItem>
  
  <Divider />
  
  <Button @click="createTeamWorkspace">
    创建团队工作空间
  </Button>
</WorkspaceSwitcher>
```

### 6. 数据库迁移

```sql
-- 添加工作空间类型字段
ALTER TABLE organizations 
ADD COLUMN type TEXT NOT NULL DEFAULT 'team',
ADD COLUMN owner_id UUID REFERENCES users(id);

-- 为现有用户创建个人工作空间
INSERT INTO organizations (id, name, slug, type, owner_id, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  CONCAT(name, '的工作空间'),
  CONCAT('user-', id),
  'personal',
  id,
  NOW(),
  NOW()
FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM organizations 
  WHERE type = 'personal' AND owner_id = users.id
);
```

### 7. 权限控制和协作

#### 个人工作空间 (支持协作!)

```typescript
// ✅ 支持项目级协作
{
  // 工作空间所有者
  owner: {
    canManageWorkspace: true,
    canCreateProjects: true,
    canInviteCollaborators: true,  // 可以邀请协作者
  },
  
  // 项目协作者
  projectMember: {
    canAccessProject: true,         // 可以访问被邀请的项目
    canPushCode: true,               // 可以推送代码 (如果是 developer)
    canManageEnvironments: true,     // 可以管理环境
    canViewDeployments: true,        // 可以查看部署
  },
}

// 协作方式
- ✅ 邀请其他用户协作特定项目
- ✅ 自动同步到 Git 仓库协作者
- ✅ 灵活的项目级权限控制
- ✅ 不需要创建组织
```

#### 团队工作空间

```typescript
// 支持工作空间级协作
{
  owner: {
    canManageWorkspace: true,
    canManageAllProjects: true,
    canManageMembers: true,
  },
  
  admin: {
    canManageProjects: true,
    canInviteMembers: true,
  },
  
  member: {
    canAccessProjects: true,
    canCreateProjects: true,
  },
}

// 协作方式
- ✅ 工作空间级成员管理
- ✅ Git 组织同步
- ✅ 更细粒度的角色权限
```

**重要**: 个人工作空间也支持完整的协作功能,不是单机游戏!

### 8. Git 仓库策略

#### 个人工作空间

```typescript
// 仓库创建在用户个人账号下
gitRepoUrl: "https://github.com/username/project-name"

// 不需要 GitHub Organization
// 不需要组织成员同步
// 只有用户自己可以访问
```

#### 团队工作空间

```typescript
// 仓库创建在组织下
gitRepoUrl: "https://github.com/org-name/project-name"

// 需要 GitHub Organization
// 自动同步组织成员权限
// 团队成员可以协作
```

### 9. 优势

#### 对个人用户
- ✅ 注册即可用,无需创建组织
- ✅ 简单直接的体验
- ✅ 降低使用门槛
- ✅ **支持项目协作** - 可以邀请其他人一起工作
- ✅ **Git 权限同步** - 协作者自动获得 Git 仓库访问权限
- ✅ 未来可以升级到团队

#### 对团队用户
- ✅ 完整的组织功能
- ✅ Git 组织同步
- ✅ 工作空间级成员管理
- ✅ 更细粒度的权限控制

#### 对产品
- ✅ 更好的用户体验
- ✅ 更高的转化率
- ✅ 清晰的升级路径
- ✅ 灵活的定价策略
- ✅ **不是单机游戏** - 个人用户也能完整协作

### 10. 定价策略建议

```
个人工作空间 (免费)
- 1 个工作空间
- 无限项目
- 基础功能
- 个人 Git 仓库

团队工作空间 (付费)
- 多个工作空间
- 团队成员管理
- Git 组织同步
- 高级功能
- 优先支持
```

### 11. 实现优先级

#### Phase 1: 个人工作空间 (立即实现)
- ✅ 添加 `type` 和 `ownerId` 字段
- ✅ 用户注册时自动创建个人工作空间
- ✅ 项目创建在用户个人 Git 账号下
- ✅ UI 显示工作空间类型

#### Phase 2: 工作空间升级 (后续)
- 升级到团队工作空间
- 迁移现有项目
- 关联 Git 组织

#### Phase 3: 高级功能 (未来)
- 工作空间模板
- 批量迁移
- 工作空间分析

### 12. 总结

**核心思想**: 
- 个人用户不需要组织,直接使用个人工作空间
- 项目仓库创建在用户个人 Git 账号下
- 需要团队协作时,再升级到团队工作空间

**关键优势**:
- 降低使用门槛
- 提供清晰的升级路径
- 保持架构的灵活性
- 更好的用户体验

这个方案完全解决了"个人用户必须创建组织"的问题! 🎉
