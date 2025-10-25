import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { organizations } from './organizations.schema';
import { users } from './users.schema';

export const aiAssistants = pgTable('ai_assistants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  avatar: text('avatar'),

  // AI助手类型和专业化（简化）
  type: varchar('type', { length: 50 }).notNull(), // 'code-reviewer', 'devops-engineer', 'security-analyst', 'cost-optimizer', 'incident-responder'
  specialization: varchar('specialization', { length: 100 }), // 'frontend', 'backend', 'infrastructure', 'security', 'performance'

  // 多模型配置（核心功能，保留但简化）
  modelType: varchar('model_type', { length: 50 }).notNull(), // 模型类型标识
  modelConfig: jsonb('model_config').notNull().$type<{
    provider: 'openai' | 'anthropic' | 'google' | 'custom';
    modelName: string;
    version?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  }>(),

  // 能力管理（简化结构）
  capabilities: text('capabilities').array().default([]), // 能力数组，如 ['code-review', 'devops-automation', 'security-analysis']

  // 基础性能指标（删除复杂JSONB结构）
  usageCount: integer('usage_count').default(0),
  averageRating: integer('average_rating').default(0), // 1-5评分

  // 状态控制
  isPublic: boolean('is_public').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),

  // 所有权
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  organizationId: uuid('organization_id').references(() => organizations.id),

  // 时间戳
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at'),
});

// 简化索引定义
export const aiAssistantsIndexes = {
  typeIdx: index('ai_assistants_type_idx').on(aiAssistants.type),
  specializationIdx: index('ai_assistants_specialization_idx').on(
    aiAssistants.specialization
  ),
  createdByIdx: index('ai_assistants_created_by_idx').on(
    aiAssistants.createdBy
  ),
  organizationIdIdx: index('ai_assistants_organization_id_idx').on(
    aiAssistants.organizationId
  ),
  isActiveIdx: index('ai_assistants_is_active_idx').on(aiAssistants.isActive),
  modelTypeIdx: index('ai_assistants_model_type_idx').on(
    aiAssistants.modelType
  ),
};

// 简化Zod schemas
export const insertAiAssistantSchema = createInsertSchema(aiAssistants, {
  name: z.string().min(1).max(100),
  type: z.enum([
    'code-reviewer',
    'devops-engineer',
    'security-analyst',
    'cost-optimizer',
    'incident-responder',
  ]),
  modelType: z.string().max(50),
  modelConfig: z.object({
    provider: z.enum(['openai', 'anthropic', 'google', 'custom']),
    modelName: z.string(),
    version: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().positive().optional(),
    topP: z.number().min(0).max(1).optional(),
    frequencyPenalty: z.number().min(-2).max(2).optional(),
    presencePenalty: z.number().min(-2).max(2).optional(),
  }),
  capabilities: z.array(z.string()).max(20),
  usageCount: z.number().int().min(0),
  averageRating: z.number().int().min(1).max(5),
});

export const selectAiAssistantSchema = createSelectSchema(aiAssistants);

export const updateAiAssistantSchema = selectAiAssistantSchema
  .pick({
    name: true,
    description: true,
    avatar: true,
    type: true,
    specialization: true,
    modelType: true,
    modelConfig: true,
    capabilities: true,
    usageCount: true,
    averageRating: true,
    isPublic: true,
    isActive: true,
    lastUsedAt: true,
  })
  .partial();

export const aiAssistantPublicSchema = selectAiAssistantSchema
  .pick({
    id: true,
    name: true,
    description: true,
    avatar: true,
    type: true,
    specialization: true,
    modelType: true,
    capabilities: true,
    usageCount: true,
    averageRating: true,
    isPublic: true,
    createdAt: true,
  })
  .partial();

export type AiAssistant = typeof aiAssistants.$inferSelect;
export type NewAiAssistant = typeof aiAssistants.$inferInsert;
export type UpdateAiAssistant = z.infer<typeof updateAiAssistantSchema>;
export type AiAssistantPublic = z.infer<typeof aiAssistantPublicSchema>;
