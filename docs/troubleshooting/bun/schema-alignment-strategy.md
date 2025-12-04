# Schema 对齐修复策略

## 问题根源

**核心问题**: 业务代码使用的字段名与数据库 Schema 定义不一致。

## 修复原则

**以数据库 Schema 为权威标准**，所有业务代码必须适配 Schema 设计。

## Schema 字段映射表

### 1. Projects Schema

**实际字段** (packages/core/src/database/schemas/projects.schema.ts):
- ✅ `gitProvider`: 'github' | 'gitlab'
- ✅ `gitRepoUrl`: string
- ✅ `gitRepoName`: string  
- ✅ `gitDefaultBranch`: string
- ✅ `organizationId`: string
- ❌ **不存在**: `gitRepoId`, `gitRepositoryId`, `createdBy`

**修复规则**:
```typescript
// ❌ 错误
eq(schema.projects.gitRepoId, ...)
eq(schema.projects.gitRepositoryId, ...)
project.createdBy

// ✅ 正确
eq(schema.projects.gitRepoUrl, event.repository.url)
project.organizationId
```

### 2. Git Sync Logs Schema

**实际字段** (packages/core/src/database/schemas/git-sync-logs.schema.ts):
- ✅ `gitResourceType`: string ('repository' | 'organization' | 'user' | 'team')
- ✅ `gitResourceId`: string
- ✅ `completedAt`: timestamp
- ❌ **不存在**: `entityType`, `entityId`, `resourceType`, `resourceId`, `syncedAt`, `details`

**修复规则**:
```typescript
// ❌ 错误
{
  entityType: 'project',
  entityId: id,
  syncedAt: new Date(),
  details: {...}
}

// ✅ 正确
{
  gitResourceType: 'repository',
  gitResourceId: id,
  completedAt: new Date(),
  metadata: {...}  // 使用 metadata 而不是 details
}
```

### 3. User Git Accounts Schema

**实际字段** (packages/core/src/database/schemas/user-git-accounts.schema.ts):
- ✅ `gitUsername`: string
- ✅ `gitUserId`: string
- ❌ **不存在**: `gitLogin`, `gitName`

**修复规则**:
```typescript
// ❌ 错误
gitAccount.gitLogin
collaborator.gitLogin

// ✅ 正确
gitAccount.gitUsername
collaborator.username
```

### 4. Users Schema

**实际字段** (packages/core/src/database/schemas/users.schema.ts):
- ✅ `displayName`: string | null
- ✅ `username`: string | null
- ❌ **不存在**: `name`

**修复规则**:
```typescript
// ❌ 错误
user.name

// ✅ 正确
user.displayName
```

### 5. Project Members Schema

**实际字段** (packages/core/src/database/schemas/project-members.schema.ts):
- ✅ `userId`: string
- ✅ `projectId`: string
- ✅ `role`: string
- ✅ `joinedAt`: timestamp
- ❌ **不存在**: `invitedAt`, `gitSyncedAt`

## 批量修复脚本

创建 `scripts/align-with-schema.ts`:

```typescript
#!/usr/bin/env bun
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function* walkFiles(dir: string, pattern: RegExp): Generator<string> {
  const files = readdirSync(dir)
  for (const file of files) {
    const path = join(dir, file)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('dist')) {
        yield* walkFiles(path, pattern)
      }
    } else if (pattern.test(file)) {
      yield path
    }
  }
}

function fixFile(filePath: string): boolean {
  let content = readFileSync(filePath, 'utf-8')
  const original = content

  // 1. Projects Schema 修复
  content = content.replace(/schema\.projects\.gitRepoId/g, 'schema.projects.gitRepoUrl')
  content = content.replace(/schema\.projects\.gitRepositoryId/g, 'schema.projects.gitRepoUrl')
  content = content.replace(/project\.createdBy/g, 'project.organizationId')
  
  // 2. Git Sync Logs Schema 修复
  content = content.replace(/entityType:/g, 'gitResourceType:')
  content = content.replace(/entityId:/g, 'gitResourceId:')
  content = content.replace(/resourceType:/g, 'gitResourceType:')
  content = content.replace(/resourceId:/g, 'gitResourceId:')
  content = content.replace(/syncedAt:/g, 'completedAt:')
  content = content.replace(/details:/g, 'metadata:')
  
  // 3. User Git Accounts Schema 修复
  content = content.replace(/\.gitLogin\b/g, '.gitUsername')
  content = content.replace(/gitLogin:/g, 'gitUsername:')
  
  // 4. Users Schema 修复
  content = content.replace(/user\.name\b/g, 'user.displayName')
  content = content.replace(/member\.name\b/g, 'member.displayName')
  
  // 5. Event Repository 修复
  content = content.replace(/event\.repository\.gitId/g, 'event.repository.url')

  if (content !== original) {
    writeFileSync(filePath, content, 'utf-8')
    return true
  }
  return false
}

const dirs = [
  'packages/services/business/src/gitops',
  'packages/services/business/src/projects',
]

let fixedCount = 0
for (const dir of dirs) {
  for (const file of walkFiles(dir, /\.ts$/)) {
    if (fixFile(file)) {
      console.log(`✅ ${file}`)
      fixedCount++
    }
  }
}

console.log(`\n✨ 修复了 ${fixedCount} 个文件`)
```

## 需要手动修复的复杂问题

### 1. HealthStatus 接口不匹配

**问题**: credential-manager.service.ts 使用了错误的 HealthStatus 格式

**修复**: 参考 git-credential.interface.ts 中的正确定义

### 2. 方法签名不匹配

**问题**: 
- `getCredential` → `getCredentials`
- `queueOrganizationSync` → `syncOrganization`
- `queueMemberSync` → `syncMember`

### 3. Event Repository 结构

**问题**: `event.repository` 没有 `url` 字段

**需要**: 检查实际的 webhook 事件类型定义

## 执行计划

1. ✅ 运行批量修复脚本
2. ⏳ 手动修复 HealthStatus 相关代码
3. ⏳ 修复方法调用不匹配
4. ⏳ 修复 Event 类型定义
5. ⏳ 运行构建测试
6. ⏳ 修复剩余错误

## 当前状态

- **已修复**: git-platform-sync.service.ts 部分字段
- **待修复**: 约 100+ 个类型错误
- **策略**: 分批次系统性修复，而不是逐个文件修复

---

**修复日期**: 2024-12-03  
**负责人**: AI Assistant  
**状态**: 进行中
