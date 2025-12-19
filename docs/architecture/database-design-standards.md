# 数据库设计规范

**版本**: 1.0  
**日期**: 2025-12-19  
**状态**: 生效中

---

## 命名规范

### 表名（Table Names）

- **格式**: 小写 + 下划线分隔（snake_case）
- **复数形式**: 使用复数名词
- **示例**: `projects`, `environments`, `git_connections`, `project_initialization_steps`

### 字段名（Column Names）

- **格式**: 小写 + 下划线分隔（snake_case）
- **驼峰转换**: TypeScript 中使用 camelCase，数据库中使用 snake_case
- **示例**: `created_at` (数据库) → `createdAt` (TypeScript)

### 主键（Primary Keys）

- **名称**: 统一使用 `id`
- **类型**: `uuid`
- **默认值**: `defaultRandom()`
- **示例**: `id: uuid('id').primaryKey().defaultRandom()`

### 外键（Foreign Keys）

- **命名**: `{关联表单数}_id`
- **示例**: `project_id`, `environment_id`, `user_id`
- **级联删除**: 根据业务需求设置 `onDelete: 'cascade'` 或 `'set null'`

### 状态字段（Status Fields）

- **统一命名**: `status`（不使用 `syncStatus`, `gitSyncStatus` 等）
- **类型**: `text`
- **值**: 使用小写字符串，用下划线分隔
- **示例**: `'pending'`, `'active'`, `'failed'`, `'in_progress'`
- **注释**: 必须在注释中列出所有可能的值

**正确示例**:
```typescript
status: text('status').notNull().default('pending'), // 'pending', 'active', 'inactive', 'failed'
```

**错误示例**:
```typescript
syncStatus: text('sync_status').default('pending'), // ❌ 应该使用 status
gitSyncStatus: text('git_sync_status'), // ❌ 应该使用 status
```

### 时间戳字段（Timestamp Fields）

- **统一使用**: `timestamp with timezone`
- **格式**: `timestamp('field_name', { withTimezone: true })`
- **标准字段**:
  - `created_at` - 创建时间（必需）
  - `updated_at` - 更新时间（必需）
  - `deleted_at` - 软删除时间（可选）

**示例**:
```typescript
createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
deletedAt: timestamp('deleted_at', { withTimezone: true }),
```

### 布尔字段（Boolean Fields）

- **命名**: 使用 `is_` 或 `has_` 前缀
- **示例**: `is_active`, `has_access`, `is_deleted`
- **默认值**: 明确设置默认值

### JSONB 字段（JSONB Fields）

- **命名**: 使用单数名词
- **常用名称**: `config`, `metadata`, `settings`, `permissions`
- **类型定义**: 必须使用 `.$type<>()` 定义 TypeScript 类型
- **默认值**: 必须设置合理的默认值

**示例**:
```typescript
config: jsonb('config')
  .$type<{
    key1: string
    key2: number
  }>()
  .default({ key1: 'default', key2: 0 }),
```

---

## 索引规范

### 命名规范

- **格式**: `{表名}_{字段名}_idx`
- **唯一索引**: `{表名}_{字段名}_unique`
- **复合索引**: `{表名}_{字段1}_{字段2}_idx`

### 索引类型

1. **主键索引**: 自动创建，无需手动定义
2. **外键索引**: 必须为所有外键创建索引
3. **查询索引**: 为常用查询字段创建索引
4. **唯一索引**: 为需要唯一性约束的字段创建

### 索引示例

```typescript
(table) => [
  // 外键索引
  index('projects_organization_id_idx').on(table.organizationId),
  
  // 查询索引
  index('projects_status_idx').on(table.status),
  
  // 唯一索引
  uniqueIndex('projects_org_slug_unique').on(table.organizationId, table.slug),
  
  // 软删除索引
  index('projects_deleted_idx').on(table.deletedAt),
]
```

---

## 关系规范

### 一对多关系

- **外键**: 在"多"的一方添加外键
- **级联删除**: 根据业务需求设置
- **示例**: `projects` → `environments`（一个项目有多个环境）

### 多对多关系

- **中间表**: 创建独立的关联表
- **命名**: `{表1}_{表2}` 或 `{表1}_to_{表2}`
- **示例**: `team_members`（teams ↔ users）

### 避免循环依赖

- **单向引用**: 优先使用单向外键引用
- **反向查询**: 通过查询实现反向关联，不添加反向外键
- **示例**: `gitops_resources.environmentId` → `environments`（单向）

---

## 数据类型规范

### 文本类型

- **短文本**: `text` 或 `varchar(length)`
- **长文本**: `text`
- **枚举值**: 使用 `text` + 注释说明可能的值

### 数字类型

- **整数**: `integer`
- **大整数**: `bigint`
- **小数**: `numeric` 或 `decimal`

### 日期时间

- **统一使用**: `timestamp with timezone`
- **不使用**: `date`, `time`, `timestamp without timezone`

### UUID

- **主键**: 统一使用 `uuid`
- **外键**: 统一使用 `uuid`
- **生成**: 使用 `defaultRandom()`

---

## 注释规范

### 表注释

- **位置**: 在表定义前添加 JSDoc 注释
- **内容**: 说明表的用途和职责

```typescript
/**
 * 项目表
 * 存储项目的基本信息和配置
 */
export const projects = pgTable(...)
```

### 字段注释

- **位置**: 在字段定义后添加行内注释
- **内容**: 说明字段用途和可能的值

```typescript
status: text('status').notNull().default('active'), // 'active', 'inactive', 'archived'
```

### 复杂字段

- **JSONB**: 必须详细说明结构
- **外键**: 说明关联的表和关系

---

## 软删除规范

### 实现方式

- **字段**: `deleted_at`
- **类型**: `timestamp with timezone`
- **默认值**: `null`（未删除）

### 查询规范

- **必须**: 在所有查询中添加 `isNull(table.deletedAt)` 条件
- **索引**: 为 `deleted_at` 创建索引

### 唯一约束

- **部分索引**: 使用 `where` 子句排除已删除记录

```typescript
uniqueIndex('projects_org_slug_unique')
  .on(table.organizationId, table.slug)
  .where(sql`deleted_at IS NULL`)
```

---

## 性能优化规范

### 索引优化

1. **外键索引**: 所有外键必须有索引
2. **查询索引**: 为常用查询字段创建索引
3. **复合索引**: 为常用的多字段查询创建复合索引
4. **避免过度索引**: 不要为所有字段创建索引

### JSONB 优化

1. **避免深层嵌套**: 最多 2-3 层
2. **提取常用字段**: 将常查询的字段提取为独立列
3. **使用 GIN 索引**: 为需要查询的 JSONB 字段创建 GIN 索引

### 查询优化

1. **避免 SELECT ***: 明确指定需要的字段
2. **使用 LIMIT**: 分页查询必须使用 LIMIT
3. **使用关联查询**: 优先使用 JOIN 而不是多次查询

---

## 迁移规范

### 迁移脚本

- **工具**: 使用 Drizzle Kit
- **命令**: `bun run db:push`
- **验证**: 迁移前在测试环境验证

### 数据迁移

1. **备份**: 迁移前备份数据库
2. **测试**: 在测试环境充分测试
3. **回滚**: 准备回滚脚本
4. **记录**: 记录迁移日志

### 破坏性变更

- **删除字段**: 确认字段不再使用
- **修改类型**: 确保数据兼容
- **删除表**: 确认表不再使用

---

## 安全规范

### 敏感数据

- **加密**: 敏感数据必须加密存储
- **访问控制**: 限制敏感数据的访问权限
- **审计**: 记录敏感数据的访问日志

### SQL 注入

- **参数化查询**: 始终使用参数化查询
- **ORM**: 使用 Drizzle ORM 的类型安全查询
- **验证**: 验证所有用户输入

---

## 示例：标准表定义

```typescript
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { organizations } from './organizations.schema'

/**
 * 项目表
 * 存储项目的基本信息和配置
 */
export const projects = pgTable(
  'projects',
  {
    // 主键
    id: uuid('id').primaryKey().defaultRandom(),
    
    // 外键
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    
    // 基本字段
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    
    // 状态字段
    status: text('status').notNull().default('active'), // 'active', 'inactive', 'archived'
    
    // JSONB 配置
    config: jsonb('config')
      .$type<{
        key1: string
        key2: number
      }>()
      .default({ key1: 'default', key2: 0 }),
    
    // 时间戳
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // 唯一索引（排除已删除）
    uniqueIndex('projects_org_slug_unique')
      .on(table.organizationId, table.slug)
      .where(sql`deleted_at IS NULL`),
    
    // 外键索引
    index('projects_organization_id_idx').on(table.organizationId),
    
    // 查询索引
    index('projects_status_idx').on(table.status),
    index('projects_deleted_idx').on(table.deletedAt),
  ],
)

// 类型导出
export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
```

---

## 检查清单

### 新表创建

- [ ] 表名使用复数形式
- [ ] 主键使用 uuid
- [ ] 所有外键有索引
- [ ] 状态字段命名为 `status`
- [ ] 时间戳使用 `with timezone`
- [ ] 添加 `created_at` 和 `updated_at`
- [ ] JSONB 字段有类型定义
- [ ] 唯一约束排除已删除记录
- [ ] 添加表和字段注释
- [ ] 导出类型定义

### 字段修改

- [ ] 确认字段不再使用
- [ ] 更新所有引用代码
- [ ] 准备回滚脚本
- [ ] 在测试环境验证
- [ ] 记录变更日志

### 代码审查

- [ ] 遵循命名规范
- [ ] 索引配置合理
- [ ] 类型定义完整
- [ ] 注释清晰准确
- [ ] 无循环依赖
- [ ] 性能优化合理

---

## 参考资料

- [Drizzle ORM 文档](https://orm.drizzle.team/)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)
- [数据库设计最佳实践](https://www.postgresql.org/docs/current/ddl.html)

---

**维护者**: 开发团队  
**最后更新**: 2025-12-19
