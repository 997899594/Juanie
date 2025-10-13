import { createId } from '@paralleldrive/cuid2'
import { boolean, integer, json, text, timestamp } from 'drizzle-orm/pg-core'

// 现代化基础字段混入 (2025年最佳实践)
export const baseFields = {
  // 使用CUID2作为主键，比UUID更高效且更安全
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  // 使用 timestamp with time zone 并设置默认值
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
} as const

// 软删除字段混入
export const softDeleteFields = {
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  isDeleted: boolean('is_deleted').default(false).notNull(),
} as const

// 审计字段混入
export const auditFields = {
  createdBy: text('created_by'),
  updatedBy: text('updated_by'),
  // 添加版本控制字段，用于乐观锁
  version: integer('version').default(1).notNull(),
} as const

// 元数据字段混入 (用于扩展性)
export const metadataFields = {
  metadata: json('metadata').$type<Record<string, any>>().default({}).notNull(),
  tags: json('tags').$type<string[]>().default([]).notNull(),
} as const

// 全文搜索字段混入
export const searchFields = {
  searchVector: text('search_vector'), // PostgreSQL tsvector 字段
} as const
