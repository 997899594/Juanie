# OrganizationSyncService 修复指南

## startSync 正确调用模式

```typescript
const logId = await this.errorService.startSync({
  syncType: 'organization',  // 或 'member'
  action: 'create',  // 或 'update', 'delete', 'sync'
  provider: gitProvider as 'github' | 'gitlab',
  organizationId,
  userId,  // 如果是成员操作
  metadata: {
    triggeredBy: 'system',  // 或 'user', 'webhook'
    workspaceType: organization.type as 'personal' | 'team',
  },
})
```

## 所有需要修复的调用

### 1. createGitOrganization (行 ~502)
```typescript
// 修复前
const logId = await this.errorService.startSync({
  organizationId,
  syncType: 'organization',
  status: 'pending',  // ❌ 错误
  triggeredBy,  // ❌ 错误位置
})

// 修复后
const logId = await this.errorService.startSync({
  syncType: 'organization',
  action: 'create',
  provider: gitProvider as 'github' | 'gitlab',
  organizationId,
  metadata: {
    triggeredBy: triggeredBy as 'user' | 'system' | 'webhook',
  },
})
```

### 2. addMemberToGitOrganization (行 ~566)
```typescript
// 修复后
const logId = await this.errorService.startSync({
  syncType: 'member',
  action: 'create',
  provider: org.gitProvider as 'github' | 'gitlab',
  organizationId,
  userId,
  metadata: {
    triggeredBy: triggeredBy as 'user' | 'system' | 'webhook',
    workspaceType: 'team',
  },
})
```

### 3. removeMemberFromGitOrganization (行 ~676)
```typescript
// 修复后
const logId = await this.errorService.startSync({
  syncType: 'member',
  action: 'delete',
  provider: org.gitProvider as 'github' | 'gitlab',
  organizationId,
  userId,
  metadata: {
    triggeredBy: triggeredBy as 'user' | 'system' | 'webhook',
    workspaceType: 'team',
  },
})
```

### 4. updateMemberRoleInGitOrganization (行 ~785)
```typescript
// 修复后
const logId = await this.errorService.startSync({
  syncType: 'member',
  action: 'update',
  provider: org.gitProvider as 'github' | 'gitlab',
  organizationId,
  userId,
  metadata: {
    triggeredBy: triggeredBy as 'user' | 'system' | 'webhook',
    workspaceType: 'team',
  },
})
```

## GitLab 权限类型修复

### mapOrgRoleToGitPermission 方法
```typescript
private mapOrgRoleToGitPermission(
  role: string,
  provider: 'github' | 'gitlab',
): 'admin' | 'member' | 10 | 20 | 30 | 40 | 50 {
  if (provider === 'github') {
    const githubRoleMap: Record<string, 'admin' | 'member'> = {
      owner: 'admin',
      admin: 'admin',
      maintainer: 'admin',
      member: 'member',
      developer: 'member',
      viewer: 'member',
    }
    return githubRoleMap[role.toLowerCase()] || 'member'
  }

  // GitLab 组织角色映射
  const gitlabRoleMap: Record<string, 10 | 20 | 30 | 40 | 50> = {
    owner: 50,
    admin: 40,
    maintainer: 40,
    member: 30,
    developer: 30,
    viewer: 20,
  }
  return gitlabRoleMap[role.toLowerCase()] || 30
}
```

## 批量修复命令

由于需要修复多处,建议手动修复以确保正确性。
