# 数据库优化方案

## 🎯 问题总结

1. **Schema 命名不一致** - 单数 vs 复数混用
2. **缺少软删除** - 部分表没有 deletedAt
3. **缺少索引** - 查询性能问题
4. **N+1 查询问题** - 关联查询未优化

## 📋 解决方案

### 1. Schema 命名标准化

**当前问题**: 
- `projects` (复数) ✅
- `environments` (复数) ✅
- `deployments` (复数) ✅
- 但有些关联字段用单数

**标准**: 表名用复数，字段名根据语义

**无需修改** - 当前命名已经合理

### 2. 添加软删除支持

**需要添加 deletedAt 的表**:

```typescript
// packages/core/src/database/schemas/environments.schema.ts
export const environments = pgTable('environments', {
  // ... 现有字段
  deletedAt: timestamp('deleted_at'),  // ✅ 添加
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// packages/core/src/database/schemas/deployments.schema.ts
export const deployments = pgTable('deployments', {
  // ... 现有字段
  deletedAt: timestamp('deleted_at'),  // ✅ 添加
})

// packages/core/src/database/schemas/repositories.schema.ts
export const repositories = pgTable('repositories', {
  // ... 现有字段
  deletedAt: timestamp('deleted_at'),  // ✅ 添加
})
```

**生成迁移**:
```bash
bun run db:generate
bun run db:push
```

### 3. 添加数据库索引

**性能关键索引**:

```typescript
// 1. 组织查询索引
index('organizations_slug_idx').on(table.slug),
index('organizations_owner_idx').on(table.ownerId),

// 2. 项目查询索引（已有部分）
index('projects_org_idx').on(table.organizationId),
index('projects_git_repo_idx').on(table.gitRepoUrl),

// 3. 环境查询索引
index('environments_project_idx').on(table.projectId),
index('environments_name_idx').on(table.name),

// 4. 部署查询索引
index('deployments_project_idx').on(table.projectId),
index('deployments_env_idx').on(table.environmentId),
index('deployments_status_idx').on(table.status),
index('deployments_created_idx').on(table.createdAt),

// 5. 仓库查询索引
index('repositories_project_idx').on(table.projectId),
index('repositories_url_idx').on(table.url),

// 6. GitOps 资源索引
index('gitops_resources_project_idx').on(table.projectId),
index('gitops_resources_type_idx').on(table.resourceType),
index('gitops_resources_status_idx').on(table.status),

// 7. 成员查询索引
index('project_members_project_idx').on(table.projectId),
index('project_members_user_idx').on(table.userId),
index('project_members_role_idx').on(table.role),

// 8. 审计日志索引
index('audit_logs_user_idx').on(table.userId),
index('audit_logs_resource_idx').on(table.resourceType, table.resourceId),
index('audit_logs_created_idx').on(table.createdAt),
```

### 4. 解决 N+1 查询问题

**问题示例**:
```typescript
// ❌ N+1 查询
const projects = await db.select().from(schema.projects)
for (const project of projects) {
  const members = await db.select()
    .from(schema.projectMembers)
    .where(eq(schema.projectMembers.projectId, project.id))
}
```

**解决方案 - 使用 Drizzle Relations**:
```typescript
// ✅ 使用关联查询
const projectsWithMembers = await db.query.projects.findMany({
  with: {
    members: true,
    environments: true,
    repositories: true,
  },
})
```

**批量查询优化**:
```typescript
// ✅ 批量查询
const projectIds = projects.map(p => p.id)
const allMembers = await db.select()
  .from(schema.projectMembers)
  .where(inArray(schema.projectMembers.projectId, projectIds))

// 按项目分组
const membersByProject = allMembers.reduce((acc, member) => {
  if (!acc[member.projectId]) acc[member.projectId] = []
  acc[member.projectId].push(member)
  return acc
}, {} as Record<string, typeof allMembers>)
```

### 5. 查询优化工具函数

```typescript
// packages/core/src/database/query-helpers.ts
import { inArray } from 'drizzle-orm'

/**
 * 批量加载关联数据，避免 N+1 查询
 */
export async function batchLoad<T extends { id: string }, R>(
  items: T[],
  loader: (ids: string[]) => Promise<R[]>,
  getKey: (item: R) => string,
): Promise<Map<string, R[]>> {
  const ids = items.map(item => item.id)
  const results = await loader(ids)
  
  const grouped = new Map<string, R[]>()
  for (const result of results) {
    const key = getKey(result)
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(result)
  }
  
  return grouped
}

/**
 * 使用示例
 */
async function getProjectsWithMembers(projectIds: string[]) {
  const projects = await db.select()
    .from(schema.projects)
    .where(inArray(schema.projects.id, projectIds))
  
  const membersMap = await batchLoad(
    projects,
    async (ids) => db.select()
      .from(schema.projectMembers)
      .where(inArray(schema.projectMembers.projectId, ids)),
    (member) => member.projectId,
  )
  
  return projects.map(project => ({
    ...project,
    members: membersMap.get(project.id) || [],
  }))
}
```

## 📊 实施清单

### Phase 1: 添加软删除 (1天)

- [ ] 更新 Schema 文件添加 `deletedAt`
- [ ] 生成数据库迁移: `bun run db:generate`
- [ ] 应用迁移: `bun run db:push`
- [ ] 更新查询添加 `isNull(deletedAt)` 过滤
- [ ] 实现软删除方法

### Phase 2: 添加索引 (1天)

- [ ] 在 Schema 文件中添加索引定义
- [ ] 生成迁移
- [ ] 在测试环境验证性能提升
- [ ] 应用到生产环境

### Phase 3: 优化查询 (2天)

- [ ] 识别所有 N+1 查询位置
- [ ] 使用 Drizzle Relations 重写
- [ ] 实现批量查询工具函数
- [ ] 性能测试对比

### Phase 4: 验证 (1天)

- [ ] 运行性能基准测试
- [ ] 检查慢查询日志
- [ ] 验证索引使用情况
- [ ] 更新文档

## 🎯 预期效果

- **查询性能**: 提升 50-80%
- **N+1 查询**: 完全消除
- **索引覆盖率**: 从 40% 提升到 90%
- **软删除**: 支持数据恢复，符合合规要求

## 🔗 相关文档

- [Drizzle ORM Relations](https://orm.drizzle.team/docs/rqb)
- [PostgreSQL 索引最佳实践](https://www.postgresql.org/docs/current/indexes.html)
