# Git Platform Integration - Task 11: 扩展 organizations 表完成

## 概述

完成了 organizations 表的扩展，添加了 Git 平台同步所需的字段，为 Phase 2 组织级同步功能奠定了数据基础。

## 实现内容

### 1. 扩展 Organizations Schema

**文件**: `packages/core/src/database/schemas/organizations.schema.ts`

添加了以下字段：

#### 1.1 gitProvider
- **类型**: text (nullable)
- **说明**: Git 平台提供商
- **可选值**: 'github' | 'gitlab'
- **用途**: 标识组织关联的 Git 平台

#### 1.2 gitOrgId
- **类型**: text (nullable)
- **说明**: Git 平台组织 ID
- **用途**: 存储 GitHub Organization ID 或 GitLab Group ID

#### 1.3 gitOrgName
- **类型**: text (nullable)
- **说明**: Git 平台组织名称
- **用途**: 存储 Git 平台上的组织名称

#### 1.4 gitOrgUrl
- **类型**: text (nullable)
- **说明**: Git 平台组织 URL
- **用途**: 存储组织在 Git 平台上的完整 URL

#### 1.5 gitSyncEnabled
- **类型**: boolean
- **默认值**: false
- **说明**: 是否启用 Git 同步
- **用途**: 控制是否自动同步组织到 Git 平台

#### 1.6 gitLastSyncAt
- **类型**: timestamp (nullable)
- **说明**: 最后同步时间
- **用途**: 记录最后一次与 Git 平台同步的时间

### 2. 创建数据库迁移

**文件**: `packages/core/drizzle/0001_soft_senator_kelly.sql`

使用 Drizzle Kit 自动生成迁移文件：
```bash
bun run db:generate
```

迁移内容：
- 为 `organizations` 表添加 6 个 Git 同步字段
- 创建 `orgs_git_provider_idx` 索引
- 同时包含了之前的 `git_sync_logs` 和 `user_git_accounts` 表创建

迁移特点：
- 由 Drizzle Kit 自动生成，确保与 schema 定义一致
- 所有新字段都是可选的，不影响现有数据
- 向后兼容，现有组织不会受影响

### 3. 添加索引

创建了 `orgs_git_provider_idx` 索引：
```sql
CREATE INDEX IF NOT EXISTS orgs_git_provider_idx ON organizations(git_provider);
```

**用途**：
- 快速查询特定 Git 平台的组织
- 优化同步任务的查询性能

## 数据模型设计

### 字段设计原则

1. **可选性**: 所有 Git 相关字段都是可选的
   - 不强制要求组织关联 Git 平台
   - 支持渐进式启用 Git 同步

2. **灵活性**: 支持多个 Git 平台
   - 通过 `gitProvider` 字段区分平台
   - 可以轻松扩展支持更多平台

3. **可追溯性**: 记录同步状态
   - `gitSyncEnabled` 控制同步开关
   - `gitLastSyncAt` 追踪同步时间

### TypeScript 类型

Schema 自动推断的类型：

```typescript
type Organization = {
  id: string
  name: string
  slug: string
  displayName: string | null
  logoUrl: string | null
  quotas: {
    maxProjects: number
    maxUsers: number
    maxStorageGb: number
  }
  billing: {
    plan: 'free' | 'pro' | 'enterprise'
    billingEmail?: string
  } | null
  // 新增字段
  gitProvider: string | null
  gitOrgId: string | null
  gitOrgName: string | null
  gitOrgUrl: string | null
  gitSyncEnabled: boolean | null
  gitLastSyncAt: Date | null
  // 系统字段
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```

## 使用场景

### 场景 1: 创建组织时启用 Git 同步

```typescript
await db.insert(organizations).values({
  name: 'My Company',
  slug: 'my-company',
  gitProvider: 'github',
  gitSyncEnabled: true,
  // gitOrgId, gitOrgName, gitOrgUrl 将在同步后填充
})
```

### 场景 2: 为现有组织启用 Git 同步

```typescript
await db.update(organizations)
  .set({
    gitProvider: 'gitlab',
    gitSyncEnabled: true,
  })
  .where(eq(organizations.id, orgId))
```

### 场景 3: 记录同步结果

```typescript
await db.update(organizations)
  .set({
    gitOrgId: '12345',
    gitOrgName: 'my-company',
    gitOrgUrl: 'https://github.com/my-company',
    gitLastSyncAt: new Date(),
  })
  .where(eq(organizations.id, orgId))
```

### 场景 4: 查询启用了 Git 同步的组织

```typescript
const syncedOrgs = await db.query.organizations.findMany({
  where: and(
    eq(organizations.gitSyncEnabled, true),
    isNotNull(organizations.gitProvider)
  )
})
```

## 迁移执行

### 生成迁移

```bash
bun run db:generate
```

### 应用迁移

```bash
bun run db:push
```

或手动执行：
```bash
psql $DATABASE_URL < packages/core/drizzle/0001_soft_senator_kelly.sql
```

## 验证

### 类型检查

```bash
cd packages/core
bun run type-check
# ✓ 通过，无类型错误
```

### 数据库验证

执行迁移后，可以验证字段是否正确添加：

```sql
-- 查看 organizations 表结构
\d organizations

-- 查看索引
\di orgs_git_provider_idx

-- 查看字段注释
SELECT 
  column_name, 
  col_description('organizations'::regclass, ordinal_position)
FROM information_schema.columns
WHERE table_name = 'organizations'
  AND column_name LIKE 'git_%';
```

## 向后兼容性

### 现有数据

- 所有新字段都是可选的（nullable）
- 现有组织记录不受影响
- `gitSyncEnabled` 默认为 `false`

### 现有代码

- 现有查询和操作不受影响
- 不需要修改现有的组织管理代码
- 可以渐进式地添加 Git 同步功能

## 下一步

Task 11 已完成。根据任务列表，接下来的任务是：

- **Task 12**: 扩展 GitProviderService（组织）
  - 添加 createOrganization() 方法（GitHub）
  - 添加 createOrganization() 方法（GitLab）
  - 添加 addOrgMember() 方法
  - 添加 removeOrgMember() 方法

## 相关文件

- `packages/core/src/database/schemas/organizations.schema.ts` - 更新
- `packages/core/drizzle/0001_soft_senator_kelly.sql` - 生成（包含所有 Phase 1 和 Task 11 的迁移）
- `package.json` - 修复了 drizzle-kit 配置路径

## Requirements 覆盖

- ✅ 2.3: 组织 Git 平台同步字段

## 总结

成功扩展了 organizations 表，添加了 6 个新字段用于 Git 平台同步：
1. gitProvider - 平台标识
2. gitOrgId - 组织 ID
3. gitOrgName - 组织名称
4. gitOrgUrl - 组织 URL
5. gitSyncEnabled - 同步开关
6. gitLastSyncAt - 同步时间

所有更改都是向后兼容的，为 Phase 2 的组织级同步功能提供了数据基础。
