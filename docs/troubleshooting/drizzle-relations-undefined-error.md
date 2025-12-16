# Drizzle ORM Relations 循环依赖问题

## 问题描述

使用 Drizzle ORM 关系查询时出现错误：

```
TypeError: undefined is not an object (evaluating 'relation.referencedTable')
```

或：

```
There is not enough information to infermbers.findMany({
  where: eq(schema.projectMembers.projectId, projectId),
  with: {
    user: { ... }  // 关联查询 user
  }
})
```

## 根本原因

Drizzle ORM 的 `relations` 函数导入位置错误，导致循环依赖和运行时关系定义丢失。

### 错误模式

```typescript
// ❌ 错误：relations 在文件底部导入
export const users = pgTable('users', { ... })
export type User = typeof users.$inferSelect

// Relations
import { relations } from 'drizzle-orm'  // 导入位置错误
import { projectMembers } from './project-members.schema'

export const usersRelations = relations(users, ({ many }) => ({
  projectMembers: many(projectMembers),
}))
```

### 正确模式

```typescript
// ✅ 正确：relations 在文件顶部导入
import { relations } from 'drizzle-orm'  // 顶部导入
import { pgTable, ... } from 'drizzle-orm/pg-core'

export const users = pgTable('users', { ... })
export type User = typeof users.$inferSelect

// Relations
import { projectMembers } from './project-members.schema'

export const usersRelations = relations(users, ({ many }) => ({
  projectMembers: many(projectMembers),
}))
```

## 解决方案

### 1. 修复所有 schema 文件的导入顺序

确保 `relations` 在文件顶部导入：

```bash
# 检查所有 schema 文件
grep -n "import { relations }" packages/core/src/database/schemas/*.ts
```

### 2. 确保双向关系定义完整

对于多对一关系，需要在两端都定义：

```typescript
// project-members.schema.ts
export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
}))

// users.schema.ts
export const usersRelations = relations(users, ({ many }) => ({
  projectMembers: many(projectMembers),  // 反向关系
}))

// projects.schema.ts
export const projectsRelations = relations(projects, ({ many }) => ({
  members: many(projectMembers),  // 反向关系
}))
```

### 3. 清理构建缓存

```bash
rm -rf packages/core/dist node_modules/.cache .turbo/cache
bun run build --filter=@juanie/core
```

### 4. 重启开发服务器

```bash
# 重启后端
bun run dev:api
```

## 影响范围

修复的 schema 文件：
- `packages/core/src/database/schemas/users.schema.ts`
- `packages/core/src/database/schemas/project-members.schema.ts`
- `packages/core/src/database/schemas/environments.schema.ts`
- `packages/core/src/database/schemas/organizations.schema.ts`
- `packages/core/src/database/schemas/organization-members.schema.ts`

## 预防措施

1. **统一导入顺序**：所有 schema 文件的 `relations` 导入必须在顶部
2. **完整关系定义**：确保多对一关系的两端都有定义
3. **代码审查**：在 PR 中检查 schema 文件的导入顺序
4. **Lint 规则**：考虑添加 ESLint 规则检查导入顺序

## 相关资源

- [Drizzle ORM Relations 文档](https://orm.drizzle.team/docs/rqb)
- [TypeScript 循环依赖问题](https://www.typescriptlang.org/docs/handbook/modules.html#circular-dependencies)
