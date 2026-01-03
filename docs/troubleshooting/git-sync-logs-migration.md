# Git 同步日志系统迁移指南

## 问题背景

之前创建了一个多余的 `GitSyncErrorService`（内存存储），与已有的 `GitSyncLogsService`（数据库存储）功能重复。

## 正确的架构

```
PinoLogger (应用日志)
    ↓ 用于调试和监控
    
GitSyncLogsService (Git 同步日志) ✅ 使用这个
    ↓ 记录 Git 同步操作的状态
    ↓ 存储在数据库，可查询、统计
    ↓ 支持 projectId, userId, organizationId
    
AuditLogsService (审计日志)
    ↓ 记录用户操作
    ↓ 用于合规和安全审计
```

## 迁移步骤

### 1. 删除 GitSyncErrorService
- ❌ 删除 `git-sync-error.service.ts`
- ✅ 使用 `GitSyncLogsService` from `@juanie/service-foundation`

### 2. 更新依赖注入

**之前**：
```typescript
constructor(
  private readonly errorService: GitSyncErrorService,
) {}
```

**之后**：
```typescript
import { GitSyncLogsService } from '@juanie/service-foundation'

constructor(
  private readonly syncLogs: GitSyncLogsService,
) {}
```

### 3. API 映射

| 旧方法 (GitSyncErrorService) | 新方法 (GitSyncLogsService) |
|------------------------------|----------------------------|
| `startSync()` | `create()` |
| `updateSyncLog()` | `updateStatus()` |
| `recordSuccess()` | `markSuccess()` |
| `recordError()` | `markFailed()` |
| `getErrorCount()` | `getProjectSyncStats()` |

### 4. 代码示例

**创建同步日志**：
```typescript
// ❌ 旧方式
const logId = await this.errorService.startSync({
  syncType: 'member',
  action: 'create',
  provider: 'github',
  organizationId,
  userId,
})

// ✅ 新方式
const log = await this.syncLogs.create({
  syncType: 'member',
  action: 'create',
  status: 'pending',
  gitProvider: 'github',
  organizationId,
  // projectId 是可选的，组织同步不需要
})
const logId = log.id
```

**标记成功**：
```typescript
// ❌ 旧方式
await this.errorService.updateSyncLog(logId, {
  status: 'success',
})

// ✅ 新方式
await this.syncLogs.markSuccess(logId, {
  gitResourceId: memberGitConnection.providerAccountId,
  gitResourceType: 'user',
})
```

**标记失败**：
```typescript
// ❌ 旧方式
await this.errorService.updateSyncLog(logId, {
  status: 'failed',
  error: error.message,
})

// ✅ 新方式
await this.syncLogs.markFailed(logId, error.message, {
  errorType: 'authentication', // 可选，帮助分类
  attemptCount: 1,
})
```

**查询统计**：
```typescript
// ❌ 旧方式
const errorCount = await this.errorService.getErrorCount({
  syncType: 'member',
  organizationId,
  status: 'failed',
})

// ✅ 新方式 - 使用数据库查询
const failedLogs = await this.db.query.gitSyncLogs.findMany({
  where: and(
    eq(schema.gitSyncLogs.organizationId, organizationId),
    eq(schema.gitSyncLogs.syncType, 'member'),
    eq(schema.gitSyncLogs.status, 'failed'),
  ),
})
const errorCount = failedLogs.length

// 或者使用服务方法
const stats = await this.syncLogs.getProjectSyncStats(projectId)
// stats.failed 包含失败数量
```

## 优势

✅ **持久化存储** - 数据不会丢失  
✅ **完整功能** - 支持查询、统计、清理  
✅ **类型安全** - 使用 PostgreSQL 枚举  
✅ **性能优化** - 有索引支持  
✅ **审计追踪** - 完整的操作历史  

## 需要修改的文件

- ✅ `organization-sync.service.ts` - 主要使用者
- ✅ `git-sync.module.ts` - 移除 GitSyncErrorService
- ✅ 其他使用 GitSyncErrorService 的服务

## 注意事项

1. **organizationId vs projectId**：组织同步使用 `organizationId`，项目同步使用 `projectId`
2. **metadata 字段**：可以存储额外的上下文信息（JSON 格式）
3. **错误类型**：使用 `errorType` 枚举帮助分类和统计
