# 工作空间策略 - 最终方案

## 核心决策

### ✅ 采用个人工作空间 + 项目级协作

**原因:**
1. 个人用户不需要组织的复杂性
2. 但必须支持协作,不能是单机游戏
3. 项目级协作提供最大灵活性

## 架构设计

### 工作空间类型

```typescript
type WorkspaceType = 'personal' | 'team'

// 个人工作空间
{
  type: 'personal',
  ownerId: userId,
  gitSyncEnabled: false,  // 不同步组织
}

// 团队工作空间
{
  type: 'team',
  gitProvider: 'github',
  gitOrgId: '...',
  gitSyncEnabled: true,   // 同步组织
}
```

### 协作模型

#### 个人工作空间: 项目级协作

```
个人工作空间
  ├─ 项目 A
  │   ├─ 所有者: 张三
  │   └─ 协作者: 李四 (developer)
  │
  ├─ 项目 B
  │   ├─ 所有者: 张三
  │   └─ 协作者: 王五 (viewer)
  │
  └─ 项目 C
      └─ 所有者: 张三 (无协作者)
```

**特点:**
- ✅ 灵活: 不同项目可以邀请不同的人
- ✅ 安全: 协作者只能访问被邀请的项目
- ✅ Git 同步: 自动同步到 GitHub 仓库协作者

#### 团队工作空间: 工作空间级协作

```
团队工作空间
  ├─ 成员: 张三 (owner)
  ├─ 成员: 李四 (admin)
  ├─ 成员: 王五 (member)
  │
  └─ 所有项目
      ├─ 项目 A (所有成员可访问)
      ├─ 项目 B (所有成员可访问)
      └─ 项目 C (所有成员可访问)
```

**特点:**
- ✅ 统一: 一次添加,访问所有项目
- ✅ Git 组织: 仓库在组织下
- ✅ 权限细粒度: 支持多种角色

## Git 仓库策略

### 个人工作空间

```typescript
// 仓库在用户个人账号下
gitRepoUrl: "https://github.com/username/project-name"

// 协作者通过 GitHub Collaborators 功能
await gitProvider.addGitHubCollaborator(
  ownerToken,
  'username/project-name',
  'collaborator-username',
  'push',  // write permission
)
```

### 团队工作空间

```typescript
// 仓库在组织账号下
gitRepoUrl: "https://github.com/org-name/project-name"

// 成员通过组织成员同步
await gitProvider.addOrgMember(
  orgToken,
  'org-name',
  'member-username',
  'member',
)
```

## 用户体验流程

### 个人用户

```
1. 注册账号
   ↓
2. 自动创建个人工作空间
   ↓
3. 创建项目
   ↓
4. 邀请朋友协作
   ↓
5. 朋友自动获得 Git 权限
   ↓
6. 一起开发项目 ✅
```

### 团队用户

```
1. 创建团队工作空间
   ↓
2. 关联 Git 组织 (或创建)
   ↓
3. 邀请团队成员
   ↓
4. 成员自动同步到 Git 组织
   ↓
5. 创建项目
   ↓
6. 团队协作 ✅
```

## 功能对比

| 功能 | 个人工作空间 | 团队工作空间 |
|------|------------|------------|
| **创建方式** | 注册时自动创建 | 手动创建 |
| **Git 仓库** | 个人账号下 | 组织账号下 |
| **协作方式** | 项目级邀请 | 工作空间级成员 |
| **权限粒度** | 项目级 | 工作空间级 + 项目级 |
| **Git 同步** | 仓库协作者 | 组织成员 |
| **适用场景** | 个人项目、临时协作 | 团队项目、长期协作 |
| **成本** | 免费 | 付费 |
| **协作能力** | ✅ 完整支持 | ✅ 完整支持 |

## 关键特性

### 1. 不是单机游戏

**个人工作空间支持:**
- ✅ 邀请无限数量的协作者
- ✅ 自动同步 Git 仓库权限
- ✅ 实时协作和代码审查
- ✅ 完整的项目管理功能

### 2. 灵活的协作

**项目级协作的优势:**
- 可以针对不同项目邀请不同的人
- 协作者只能访问被邀请的项目
- 项目完成后可以轻松移除协作者
- 适合外包、开源、临时协作

### 3. 清晰的升级路径

**从个人到团队:**
```
个人工作空间 (免费)
  ↓ 需要更多功能时
团队工作空间 (付费)
  ↓ 获得
- 工作空间级成员管理
- Git 组织同步
- 更多高级功能
```

## 实现优先级

### Phase 1: 个人工作空间基础 (立即)

- ✅ 添加 `type` 和 `ownerId` 字段
- ✅ 用户注册时自动创建个人工作空间
- ✅ 项目创建在用户个人 Git 账号下

### Phase 2: 项目级协作 (立即)

- ✅ 项目成员管理 (已有)
- ✅ Git 仓库协作者同步
- ✅ 邀请和通知功能
- ✅ 协作者权限管理

### Phase 3: 团队工作空间 (后续)

- 创建团队工作空间
- 关联 Git 组织
- 工作空间级成员管理
- 组织成员同步

### Phase 4: 高级功能 (未来)

- 工作空间升级
- 批量迁移
- 高级权限控制
- 工作空间分析

## 数据库变更

```sql
-- 1. 扩展 organizations 表
ALTER TABLE organizations 
ADD COLUMN type TEXT NOT NULL DEFAULT 'team',
ADD COLUMN owner_id UUID REFERENCES users(id);

-- 2. 为现有用户创建个人工作空间
INSERT INTO organizations (id, name, slug, type, owner_id)
SELECT 
  gen_random_uuid(),
  CONCAT(name, '的工作空间'),
  CONCAT('user-', id),
  'personal',
  id
FROM users;

-- 3. project_members 表已存在,添加 Git 同步状态
ALTER TABLE project_members
ADD COLUMN git_sync_status TEXT DEFAULT 'pending',
ADD COLUMN git_synced_at TIMESTAMP;
```

## API 变更

### 新增 API

```typescript
// 项目协作
- addProjectMember()      // 添加项目成员
- removeProjectMember()   // 移除项目成员
- listProjectMembers()    // 列出项目成员
- updateMemberRole()      // 更新成员角色

// Git 同步
- syncProjectMember()     // 同步成员到 Git
- removeMemberFromGit()   // 从 Git 移除成员
- getGitSyncStatus()      // 获取同步状态
```

### 现有 API 保持不变

项目创建、部署等 API 无需修改,只需在内部判断工作空间类型。

## 总结

### 核心价值

1. **简单**: 个人用户无需创建组织
2. **协作**: 支持完整的项目级协作
3. **灵活**: 不同项目可以邀请不同的人
4. **同步**: 自动同步 Git 仓库权限
5. **升级**: 清晰的升级到团队工作空间的路径

### 关键决策

- ✅ 个人工作空间 + 项目级协作
- ✅ 不是单机游戏,支持完整协作
- ✅ Git 仓库在个人账号下
- ✅ 自动同步仓库协作者权限
- ✅ 未来可以升级到团队工作空间

这个方案完美平衡了简单性和协作能力! 🎉

## 相关文档

- [个人工作空间设计](./personal-workspace-design.md)
- [个人工作空间协作](./personal-workspace-collaboration.md)
- [GitHub 个人账号解决方案](./github-personal-account-solution.md)
