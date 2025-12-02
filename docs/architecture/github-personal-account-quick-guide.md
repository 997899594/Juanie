# GitHub 个人账号快速指南

## 问题

GitHub 个人账号无法通过 API 创建 Organization。

## 解决方案

### 方案 1: 关联已有组织 (推荐)

1. 在 GitHub 网站创建 Organization
2. 在平台选择"关联已有组织"
3. 从列表中选择组织
4. 完成关联

### 方案 2: 使用 GitLab

1. 连接 GitLab 账号
2. 通过 API 创建 GitLab Group
3. 功能与 GitHub Organization 完全相同

## 技术实现

### 检测账号类型

```typescript
const check = await gitProvider.canCreateGitHubOrganization(accessToken)

if (!check.canCreate) {
  // 显示关联选项
  console.log(check.reason) // "GitHub 个人账号无法通过 API 创建 Organization..."
  console.log(check.accountType) // "personal"
}
```

### 列出可访问的组织

```typescript
const orgs = await gitProvider.listGitHubOrganizations(accessToken)

// 返回:
// [
//   {
//     id: 123,
//     login: "my-org",
//     name: "My Organization",
//     url: "https://github.com/my-org",
//     avatarUrl: "...",
//     role: "admin"  // 只有 admin 角色才能关联
//   }
// ]
```

### 关联已有组织

```typescript
const linked = await gitProvider.linkExistingGitHubOrganization(
  accessToken,
  'my-org'
)

// 返回:
// {
//   id: 123,
//   login: "my-org",
//   name: "My Organization",
//   url: "https://github.com/my-org",
//   avatarUrl: "...",
//   role: "admin"
// }
```

## UI 流程

```
┌─────────────────────────────────────┐
│  创建组织                            │
├─────────────────────────────────────┤
│                                     │
│  检测到您使用的是 GitHub 个人账号    │
│  个人账号无法通过 API 创建组织       │
│                                     │
│  请选择以下方式:                     │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 关联已有 GitHub Organization │   │
│  │ 如果您已在 GitHub 创建了组织  │   │
│  │ [选择组织]                   │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 使用 GitLab Group            │   │
│  │ GitLab 支持 API 创建组织     │   │
│  │ [使用 GitLab]                │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

## 数据库

```typescript
// organizations 表新增字段
gitSyncMode: 'created' | 'linked'  // 区分创建和关联
```

## API 端点

```typescript
// 检测账号类型
GET /api/git-sync/account-type
Response: {
  provider: 'github',
  accountType: 'personal',
  canCreateOrg: false,
  availableOrgs: [...]
}

// 列出可访问的组织
GET /api/git-sync/organizations
Response: [
  { id, login, name, url, avatarUrl, role }
]

// 关联已有组织
POST /api/git-sync/link-organization
Body: { provider: 'github', orgName: 'my-org' }
Response: {
  success: true,
  organization: { ... }
}
```

## 优势

✅ **完整闭环** - 个人账号也能完整使用平台
✅ **灵活选择** - GitHub 或 GitLab 都可以
✅ **清晰引导** - UI 明确告知限制和方案
✅ **功能对等** - 关联后功能完全相同

## 相关文档

- [完整设计文档](./github-personal-account-solution.md)
- [扩展方法实现](../../packages/services/business/src/gitops/git-providers/git-provider-org-extensions.ts)
- [Task 12 完成文档](../troubleshooting/refactoring/git-platform-integration-task12-complete.md)
