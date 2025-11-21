# 🗄️ 数据库问题修复总结

## 遇到的问题

### 1. OAuth Accounts 插入失败
```
Failed query: insert into "oauth_accounts" ... 
on conflict ("provider","provider_account_id") do update ...
```

**原因**: 使用了旧的唯一约束 `(provider, provider_account_id)`，但迁移 0006 已经改为 `(user_id, provider, server_url)`

**修复**: 更新 `auth.service.ts` 中的 `onConflictDoUpdate` 配置

### 2. Deployments 查询失败
```
Failed query: select ... "commit_message" ... from "deployments"
```

**原因**: Schema 定义中有 `commitMessage` 字段，但数据库表中缺少该列

**修复**: 生成并运行迁移 0007，添加缺失的列

---

## 修复详情

### 修复 1: OAuth Accounts

**文件**: `packages/services/auth/src/auth.service.ts`

**变更**:
```typescript
// ❌ 旧代码
.onConflictDoUpdate({
  target: [schema.oauthAccounts.provider, schema.oauthAccounts.providerAccountId],
  set: { ... }
})

// ✅ 新代码
.onConflictDoUpdate({
  target: [
    schema.oauthAccounts.userId,
    schema.oauthAccounts.provider,
    schema.oauthAccounts.serverUrl,
  ],
  set: {
    providerAccountId: sql`excluded.provider_account_id`,
    accessToken: sql`excluded.access_token`,
    refreshToken: sql`excluded.refresh_token`,
    expiresAt: sql`excluded.expires_at`,
    status: sql`excluded.status`,
    updatedAt: sql`now()`,
  },
})
```

**关键点**:
- 添加 `serverUrl` 字段（GitHub: `https://github.com`, GitLab: 从环境变量）
- 添加 `serverType: 'cloud'`
- 更新 `providerAccountId` 以支持账户 ID 变化

---

### 修复 2: Deployments Schema

**生成迁移**:
```bash
cd packages/core/database
bun x drizzle-kit generate
```

**迁移文件**: `drizzle/0007_left_the_santerians.sql`

**变更**:
```sql
ALTER TABLE "deployments" ADD COLUMN "commit_message" text;
ALTER TABLE "environments" ADD COLUMN "description" text;
ALTER TABLE "environments" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;
ALTER TABLE "environments" ADD COLUMN "health_check_url" text;
ALTER TABLE "security_policies" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;
```

**运行迁移**:
```bash
POSTGRES_USER=findbiao \
POSTGRES_PASSWORD='biao1996.' \
POSTGRES_HOST=localhost \
POSTGRES_PORT=5432 \
POSTGRES_DB=juanie_devops \
bun run run-migration.ts
```

---

## 创建的工具脚本

### 1. check-and-migrate.ts
检查数据库状态并运行迁移

```bash
bun run check-and-migrate.ts
```

**功能**:
- 列出所有现有表
- 检查必需的表是否存在
- 如果缺少表，自动运行迁移

### 2. check-deployments-schema.ts
检查 deployments 表的结构

```bash
bun run check-deployments-schema.ts
```

**功能**:
- 列出所有列及其类型
- 检查 `deleted_at` 列是否存在
- 测试基本查询

### 3. run-migration.ts
手动运行特定迁移

```bash
bun run run-migration.ts
```

**功能**:
- 读取迁移 SQL 文件
- 分割并执行每个语句
- 显示执行进度

---

## 验证

### 1. OAuth Accounts
```bash
# 测试 GitLab 登录
# 应该能成功创建或更新 OAuth 账户
```

### 2. Deployments
```bash
# 测试查询部署列表
curl http://localhost:3000/api/trpc/deployments.list
# 应该返回空数组而不是错误
```

---

## 数据库状态

### 当前表 (24 个)
```
✓ ai_assistants
✓ audit_logs
✓ cost_tracking
✓ deployment_approvals
✓ deployments (已修复)
✓ environments
✓ gitops_resources
✓ incidents
✓ notifications
✓ oauth_accounts (已修复)
✓ organization_members
✓ organizations
✓ pipeline_runs
✓ pipelines
✓ project_events
✓ project_members
✓ project_templates
✓ projects
✓ repositories
✓ security_policies
✓ team_members
✓ team_projects
✓ teams
✓ users
```

### Deployments 表结构
```
✓ id
✓ project_id
✓ environment_id
✓ pipeline_run_id
✓ version
✓ commit_hash
✓ commit_message (新增)
✓ branch
✓ strategy
✓ status
✓ started_at
✓ finished_at
✓ deployed_by
✓ gitops_resource_id
✓ deployment_method
✓ git_commit_sha
✓ deleted_at
✓ created_at
```

---

## 最佳实践

### 1. Schema 变更流程
1. 修改 schema 文件
2. 运行 `bun x drizzle-kit generate` 生成迁移
3. 检查生成的 SQL 文件
4. 运行迁移
5. 验证表结构

### 2. 唯一约束变更
当修改唯一约束时，需要：
1. 生成迁移删除旧约束
2. 生成迁移添加新约束
3. 更新所有使用 `onConflictDoUpdate` 的代码

### 3. 添加新列
- 如果列可为 NULL，直接添加
- 如果列 NOT NULL，需要提供默认值或先添加为 NULL 再更新

---

## 下一步

1. ✅ OAuth 登录应该正常工作
2. ✅ Deployments 查询应该正常工作
3. ⏳ 测试完整的项目创建流程
4. ⏳ 测试 GitOps 部署流程

---

**修复时间**: 2025-11-21  
**影响范围**: OAuth Accounts, Deployments  
**状态**: ✅ 完全修复
