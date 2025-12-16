# Drizzle ORM Relations 循环依赖问题

## 问题描述

使用 Drizzle ORM 关系查询时出现错误：

```
TypeError: undefined is not an object (evaluating 'relation.referencedTable')
```

或：

```
There is not enough information to infer relation "projects.environments"
```

## 根本原因

在各个 schema 文件中分散定义 relations，导致循环依赖：

```
projects.schema.ts 导入 environments.schema.ts（定义 many(environments)）
environments.schema.ts 导入 projects.schema.ts（定义 one(projects)）
```

TypeScript/JavaScript 模块加载时，循环依赖会导致某些导出为 `undefined`。

## 解决方案

**集中定义所有 relations 到独立文件**：

```
packages/core/src/database/
├── schemas/           # 只包含表定义，不包含 relations
│   ├── users.schema.ts
│   ├── projects.schema.ts
│   └── ...
├── relations.ts       # 集中定义所有 relations
└── index.ts           # 先导出 schemas，再导出 relations
```

### relations.ts 示例

```typescript
import { relations } from 'drizzle-orm'
import {
  users,
  projects,
  projectMembers,
  environments,
  // ... 其他表
} from './schemas'

export const usersRelations = relations(users, ({ many }) => ({
  projectMembers: many(projectMembers),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  members: many(projectMembers),
  environments: many(environments),
}))

// ... 其他 relations
```

### index.ts 导出顺序

```typescript
// 先导出表定义
export * from './schemas'
// 再导出关系定义
export * from './relations'
```

## 关键原则

1. **Schema 文件只定义表结构**，不导入其他 schema 文件的 relations
2. **Relations 集中定义**，在一个文件中导入所有需要的表
3. **导出顺序**：先 schemas，后 relations
4. **避免在 schema 文件中间写 import**

## 相关文件

- `packages/core/src/database/relations.ts` - 集中定义所有关系
- `packages/core/src/database/index.ts` - 统一导出
- `packages/core/src/database/schemas/` - 表定义目录
