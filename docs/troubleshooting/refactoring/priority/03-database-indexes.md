# 任务 3: 数据库索引优化

**优先级**: 🟡 中  
**预计时间**: 1天  
**依赖**: 无

---

## 📋 问题描述

### 现状

1. **缺少关键索引**
   - `projects` 表的 `organizationId` 没有索引
   - `project_members` 表的 `userId` 没有索引
   - `git_sync_logs` 表的查询字段没有索引

2. **查询性能问题**
   ```sql
   -- 慢查询示例（无索引）
   SELECT * FROM projects WHERE organization_id = 'xxx';  -- 全表扫描
   SELECT * FROM project_members WHERE user_id = 'xxx';   -- 全表扫描
   ```

3. **复合查询无优化**
   - 经常同时查询 `organizationId` + `status`
   - 经常同时查询 `userId` + `role`

### 影响

- ❌ 列表查询慢（>500ms）
- ❌ 数据量增长后性能急剧下降
- ❌ 数据库 CPU 使用率高

---

## 🎯 方案

### 需要添加的索引

```sql
-- 1. projects 表
CREATE INDEX idx_projects_organization_id ON projects(organization_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_org_status ON projects(organization_id, status);
CREATE INDEX idx_projects_created_by ON projects(created_by);

-- 2. project_members 表
CREATE INDEX idx_project_members_user_id ON project_members(user_id);
CREATE INDEX idx_project_members_project_user ON project_members(project_id, user_id);
CREATE INDEX idx_project_members_role ON project_members(role);

-- 3. git_sync_logs 表
CREATE INDEX idx_git_sync_logs_project_id ON git_sync_logs(project_id);
CREATE INDEX idx_git_sync_logs_status ON git_sync_logs(status);
CREATE INDEX idx_git_sync_logs_created_at ON git_sync_logs(created_at DESC);
CREATE INDEX idx_git_sync_logs_project_status ON git_sync_logs(project_id, status);

-- 4. environments 表
CREATE INDEX idx_environments_project_id ON environments(project_id);
CREATE INDEX idx_environments_type ON environments(type);
```

---

## 🔧 实施步骤

### 3.1 创建迁移文件 (0.25天)

```typescript
// packages/core/drizzle/0003_add_indexes.sql

-- Projects 索引
CREATE INDEX IF NOT EXISTS idx_projects_organization_id 
ON projects(organization_id);

CREATE INDEX IF NOT EXISTS idx_projects_status 
ON projects(status) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_org_status 
ON projects(organization_id, status) 
WHERE deleted_at IS NULL;

-- Project Members 索引
CREATE INDEX IF NOT EXISTS idx_project_members_user_id 
ON project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_project_members_project_user 
ON project_members(project_id, user_id);

-- Git Sync Logs 索引
CREATE INDEX IF NOT EXISTS idx_git_sync_logs_project_id 
ON git_sync_logs(project_id);

CREATE INDEX IF NOT EXISTS idx_git_sync_logs_status 
ON git_sync_logs(status);

CREATE INDEX IF NOT EXISTS idx_git_sync_logs_created_at 
ON git_sync_logs(created_at DESC);
```

### 3.2 更新 Drizzle Schema (0.25天)

```typescript
// packages/core/src/database/schemas/projects.schema.ts

export const projects = pgTable('projects', {
  // ... 字段定义
}, (table) => ({
  // 索引定义
  organizationIdIdx: index('idx_projects_organization_id')
    .on(table.organizationId),
  statusIdx: index('idx_projects_status')
    .on(table.status),
  orgStatusIdx: index('idx_projects_org_status')
    .on(table.organizationId, table.status),
}))
```

### 3.3 性能测试 (0.25天)

```typescript
// scripts/test-query-performance.ts

async function testQueryPerformance() {
  console.log('Testing query performance...')
  
  // 测试 1: 按组织查询项目
  const start1 = Date.now()
  await db.query.projects.findMany({
    where: eq(schema.projects.organizationId, 'test-org'),
  })
  console.log(`Query 1: ${Date.now() - start1}ms`)
  
  // 测试 2: 按用户查询项目成员
  const start2 = Date.now()
  await db.query.projectMembers.findMany({
    where: eq(schema.projectMembers.userId, 'test-user'),
  })
  console.log(`Query 2: ${Date.now() - start2}ms`)
}
```

### 3.4 监控和优化 (0.25天)

- 使用 `EXPLAIN ANALYZE` 分析查询计划
- 监控慢查询日志
- 根据实际使用情况调整索引

---

## ✅ 验收标准

- [ ] 所有迁移文件创建完成
- [ ] 索引在开发和生产环境都已应用
- [ ] 查询性能提升 > 50%
- [ ] 没有引入新的性能问题

---

## 📊 预期收益

- ✅ 列表查询速度提升 5-10倍
- ✅ 数据库 CPU 使用率降低 30%
- ✅ 支持更大的数据量

---

## 📝 相关文档

- [数据库优化指南](../../guides/database-optimization.md)
