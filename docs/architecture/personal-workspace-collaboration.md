# 个人工作空间协作设计

## 核心原则

**个人工作空间也要支持协作,不能是单机游戏!**

## 协作模型

### 两种协作方式

#### 方式 1: 项目级协作 (推荐)

个人工作空间支持邀请其他用户协作**特定项目**:

```typescript
// 个人工作空间
{
  type: 'personal',
  ownerId: 'user-a',
  name: '张三的工作空间',
}

// 项目成员
project_members {
  projectId: 'project-1',
  userId: 'user-b',  // 被邀请的协作者
  role: 'developer',
}

// Git 仓库协作者自动同步
// GitHub: https://github.com/user-a/project-1
// 协作者: user-b (write permission)
```

**特点:**
- ✅ 灵活:可以针对不同项目邀请不同的人
- ✅ 安全:协作者只能访问被邀请的项目
- ✅ 简单:不需要创建组织
- ✅ Git 同步:自动同步到 GitHub 仓库协作者

#### 方式 2: 工作空间级协作 (可选)

个人工作空间也可以添加成员,访问所有项目:

```typescript
// 工作空间成员
organization_members {
  organizationId: 'personal-workspace-id',
  userId: 'user-b',
  role: 'member',  // 个人工作空间只有 owner 和 member
}
```

**特点:**
- ✅ 方便:一次邀请,访问所有项目
- ⚠️ 权限较大:可以看到所有项目
- 💡 适合:长期合作伙伴

## 详细设计

### 1. 项目级协作 (主要方式)

#### 邀请流程

```typescript
// 1. 项目所有者邀请协作者
await projectMembers.addMember({
  projectId: 'project-1',
  userId: 'user-b',
  role: 'developer',
})

// 2. 自动同步到 Git 仓库
await gitSync.syncProjectMember({
  projectId: 'project-1',
  userId: 'user-b',
  role: 'developer',
})

// 3. GitHub API 调用
await gitProvider.addGitHubCollaborator(
  accessToken,
  'user-a/project-1',  // 个人仓库
  'user-b',            // 协作者 GitHub 用户名
  'push',              // write permission
)
```

#### 权限映射

```typescript
// 平台角色 → GitHub 权限
{
  maintainer: 'admin',   // 可以管理仓库设置
  developer: 'push',     // 可以推送代码
  viewer: 'pull',        // 只读访问
}

// 平台角色 → GitLab 权限
{
  maintainer: 40,  // Maintainer
  developer: 30,   // Developer  
  viewer: 20,      // Reporter
}
```

#### UI 设计

```vue
<template>
  <ProjectSettings>
    <h3>项目成员</h3>
    
    <!-- 当前成员列表 -->
    <MemberList>
      <MemberItem>
        <Avatar :user="owner" />
        <div>
          <h4>张三 (你)</h4>
          <Badge>所有者</Badge>
        </div>
      </MemberItem>
      
      <MemberItem>
        <Avatar :user="collaborator" />
        <div>
          <h4>李四</h4>
          <Badge>开发者</Badge>
          <Badge variant="success">已同步到 GitHub</Badge>
        </div>
        <Button @click="removeMember">移除</Button>
      </MemberItem>
    </MemberList>
    
    <!-- 邀请新成员 -->
    <InviteMember>
      <Input 
        placeholder="输入用户邮箱或用户名" 
        v-model="inviteEmail"
      />
      <Select v-model="inviteRole">
        <option value="developer">开发者</option>
        <option value="viewer">查看者</option>
      </Select>
      <Button @click="inviteMember">
        邀请协作
      </Button>
    </InviteMember>
    
    <!-- Git 同步状态 -->
    <Alert v-if="!gitAccountLinked" type="warning">
      <p>连接 GitHub 账号后,协作者将自动同步到 Git 仓库</p>
      <Button @click="linkGitAccount">连接 GitHub</Button>
    </Alert>
  </ProjectSettings>
</template>
```

### 2. 工作空间级协作 (可选)

#### 添加工作空间成员

```typescript
// 个人工作空间也可以添加成员
await organizationMembers.addMember({
  organizationId: personalWorkspace.id,
  userId: 'user-b',
  role: 'member',  // 个人工作空间只有 owner 和 member
})

// 工作空间成员可以:
// - 查看所有项目
// - 被添加到任何项目
// - 不能修改工作空间设置
```

#### 权限控制

```typescript
// 个人工作空间的权限模型
{
  owner: {
    // 所有者 (只有一个)
    canManageWorkspace: true,
    canCreateProjects: true,
    canDeleteProjects: true,
    canInviteMembers: true,
  },
  
  member: {
    // 工作空间成员
    canManageWorkspace: false,
    canCreateProjects: false,  // 不能创建项目
    canDeleteProjects: false,
    canInviteMembers: false,
    // 只能访问被邀请的项目
  },
}
```

### 3. Git 仓库协作同步

#### GitHub 个人仓库协作

```typescript
// 场景: 张三邀请李四协作项目
// 仓库: https://github.com/zhangsan/my-project

// 1. 平台添加项目成员
await addProjectMember({
  projectId: 'my-project',
  userId: 'lisi',
  role: 'developer',
})

// 2. 获取李四的 GitHub 用户名
const lisiGitAccount = await getUserGitAccount('lisi', 'github')
// lisiGitAccount.gitUsername = 'lisi-github'

// 3. 添加为 GitHub 仓库协作者
await gitProvider.addGitHubCollaborator(
  zhangsanToken,
  'zhangsan/my-project',
  'lisi-github',
  'push',  // developer → push permission
)

// 4. 李四收到 GitHub 邀请邮件
// 5. 李四接受邀请后,可以访问仓库
```

#### GitLab 个人项目协作

```typescript
// 场景: 张三邀请李四协作 GitLab 项目
// 项目: https://gitlab.com/zhangsan/my-project

// 1. 平台添加项目成员
await addProjectMember({
  projectId: 'my-project',
  userId: 'lisi',
  role: 'developer',
})

// 2. 获取李四的 GitLab 用户 ID
const lisiGitAccount = await getUserGitAccount('lisi', 'gitlab')
// lisiGitAccount.gitUserId = 12345

// 3. 添加为 GitLab 项目成员
await gitProvider.addGitLabMember(
  zhangsanToken,
  'zhangsan/my-project',  // 项目 ID 或路径
  12345,                   // 李四的 GitLab 用户 ID
  30,                      // developer → 30 (Developer)
)

// 4. 李四立即可以访问项目
```

### 4. 协作者发现

#### 通过邮箱邀请

```typescript
// 1. 输入邮箱邀请
async function inviteByEmail(email: string) {
  // 检查用户是否已注册
  const user = await findUserByEmail(email)
  
  if (user) {
    // 已注册,直接添加
    await addProjectMember(projectId, user.id, role)
  } else {
    // 未注册,发送邀请邮件
    await sendInvitationEmail({
      email,
      projectId,
      role,
      invitedBy: currentUser,
    })
  }
}
```

#### 通过用户名搜索

```typescript
// 2. 搜索平台用户
async function searchUsers(query: string) {
  return await db.query.users.findMany({
    where: or(
      like(users.username, `%${query}%`),
      like(users.name, `%${query}%`),
      like(users.email, `%${query}%`),
    ),
    limit: 10,
  })
}
```

### 5. 协作通知

#### 邀请通知

```typescript
// 被邀请时发送通知
await notifications.create({
  userId: invitedUserId,
  type: 'project_invitation',
  title: '项目协作邀请',
  message: `${inviter.name} 邀请你协作项目 "${project.name}"`,
  actions: [
    { label: '接受', action: 'accept' },
    { label: '拒绝', action: 'decline' },
  ],
})
```

#### Git 同步状态通知

```typescript
// Git 同步完成后通知
await notifications.create({
  userId: invitedUserId,
  type: 'git_sync_complete',
  title: 'Git 权限已同步',
  message: `你已被添加为 GitHub 仓库 "${repo}" 的协作者`,
})
```

### 6. 协作场景示例

#### 场景 1: 个人项目邀请朋友协作

```
张三创建个人项目 "my-app"
    ↓
邀请李四作为开发者
    ↓
李四接受邀请
    ↓
自动同步到 GitHub
    ↓
李四可以:
  - 在平台查看项目
  - 推送代码到 GitHub
  - 查看部署状态
  - 管理环境变量
```

#### 场景 2: 外包项目临时协作

```
张三接了外包项目
    ↓
邀请自由职业者李四协作
    ↓
项目完成后移除李四
    ↓
李四失去访问权限
    ↓
Git 仓库协作者自动移除
```

#### 场景 3: 开源项目协作

```
张三创建开源项目
    ↓
设置项目为公开
    ↓
邀请多个贡献者
    ↓
每个贡献者有不同权限:
  - 核心成员: maintainer
  - 贡献者: developer
  - 文档维护: viewer
```

### 7. 与团队工作空间的对比

| 特性 | 个人工作空间 | 团队工作空间 |
|------|------------|------------|
| 成员管理 | ✅ 项目级 | ✅ 工作空间级 |
| Git 仓库 | 个人账号下 | 组织账号下 |
| 权限粒度 | 项目级 | 工作空间级 + 项目级 |
| 适用场景 | 个人项目、临时协作 | 团队项目、长期协作 |
| 成本 | 免费 | 付费 |

### 8. 数据库设计

```typescript
// project_members 表 (已存在)
export const projectMembers = pgTable('project_members', {
  id: uuid('id').primaryKey(),
  projectId: uuid('project_id').references(() => projects.id),
  userId: uuid('user_id').references(() => users.id),
  role: text('role').notNull(), // 'maintainer' | 'developer' | 'viewer'
  
  // Git 同步状态
  gitSyncStatus: text('git_sync_status'), // 'pending' | 'synced' | 'failed'
  gitSyncedAt: timestamp('git_synced_at'),
  
  invitedBy: uuid('invited_by').references(() => users.id),
  invitedAt: timestamp('invited_at').defaultNow(),
  acceptedAt: timestamp('accepted_at'),
})
```

### 9. API 设计

```typescript
// 项目成员管理 API
router.mutation('addProjectMember', {
  input: z.object({
    projectId: z.string(),
    userIdOrEmail: z.string(),
    role: z.enum(['maintainer', 'developer', 'viewer']),
  }),
  async resolve({ input, ctx }) {
    // 1. 验证权限
    // 2. 添加成员
    // 3. 同步到 Git
    // 4. 发送通知
  },
})

router.mutation('removeProjectMember', {
  input: z.object({
    projectId: z.string(),
    userId: z.string(),
  }),
  async resolve({ input, ctx }) {
    // 1. 验证权限
    // 2. 移除成员
    // 3. 从 Git 移除
    // 4. 发送通知
  },
})

router.query('listProjectMembers', {
  input: z.object({
    projectId: z.string(),
  }),
  async resolve({ input, ctx }) {
    // 返回项目成员列表和 Git 同步状态
  },
})
```

### 10. 总结

**核心设计:**
- ✅ 个人工作空间支持项目级协作
- ✅ 自动同步到 Git 仓库协作者
- ✅ 灵活的权限控制
- ✅ 完整的通知机制

**关键优势:**
- 🚀 简单:不需要创建组织
- 🤝 协作:支持多人协作
- 🔄 同步:自动同步 Git 权限
- 🔒 安全:项目级权限隔离

**不是单机游戏:**
- 可以邀请任意数量的协作者
- 协作者有完整的 Git 访问权限
- 支持实时协作和代码审查
- 与团队工作空间功能对等

这样个人用户既能享受简单的体验,又能进行完整的团队协作! 🎉
