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
  pgEnum,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { organizations } from "./organizations.schema";
import { users } from "./users.schema";

// 枚举定义
export const AssistantTypeEnum = z.enum(['code-reviewer', 'devops-engineer', 'security-analyst', 'cost-optimizer', 'incident-responder']);
export const ModelProviderEnum = z.enum(['openai', 'anthropic', 'google', 'custom']);

// PostgreSQL 枚举定义
export const AssistantTypePgEnum = pgEnum('assistant_type', ['code-reviewer', 'devops-engineer', 'security-analyst', 'cost-optimizer', 'incident-responder']);
export const ModelProviderPgEnum = pgEnum('model_provider', ['openai', 'anthropic', 'google', 'custom']);

export const aiAssistants = pgTable("ai_assistants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  avatar: text("avatar"),
  // 助手类型和专业化
  type: AssistantTypePgEnum("type").notNull(), // 'code-reviewer', 'devops-engineer', 'security-analyst', 'cost-optimizer', 'incident-responder'
  specialization: varchar("specialization", { length: 100 }), // 'frontend', 'backend', 'infrastructure', 'security', 'performance'
  // 模型配置
  modelType: varchar("model_type", { length: 50 }).notNull(), // 模型类型标识
  modelConfig: jsonb("model_config").notNull().$type<{
    provider: "openai" | "anthropic" | "google" | "custom";
    modelName: string;
    version?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  }>(),
  // 提示词配置
  systemPrompt: text("system_prompt").notNull(),
  // 能力配置
  capabilities: text("capabilities").array().notNull().default([]), // 能力数组，如 ['code-review', 'devops-automation', 'security-analysis']
  // 使用统计
  usageCount: integer("usage_count").default(0).notNull(),
  averageRating: integer("average_rating").default(0).notNull(), // 1-5评分
  // 状态配置
  isPublic: boolean("is_public").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  // 关联关系
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  organizationId: uuid("organization_id").references(() => organizations.id),
  // 时间戳
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
}, (table) => [
  index("ai_assistants_type_idx").on(table.type),
  index("ai_assistants_specialization_idx").on(table.specialization),
  index("ai_assistants_created_by_idx").on(table.createdBy),
  index("ai_assistants_organization_id_idx").on(table.organizationId),
  index("ai_assistants_is_active_idx").on(table.isActive),
  index("ai_assistants_model_type_idx").on(table.modelType),
]);

// 手动定义的 Zod schemas - 替换 drizzle-zod
export const insertAiAssistantSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string(),
  description: z.string().optional(),
  avatar: z.string().optional(),
  type: AssistantTypeEnum,
  specialization: z.string().optional(),
  modelType: z.string(),
  modelConfig: z.object({
    provider: ModelProviderEnum,
    modelName: z.string(),
    temperature: z.number().optional(),
    maxTokens: z.number().int().optional(),
    topP: z.number().optional(),
    frequencyPenalty: z.number().optional(),
    presencePenalty: z.number().optional(),
  }),
  systemPrompt: z.string(),
  capabilities: z.array(z.string()),
  isActive: z.boolean().optional(),
  usageCount: z.number().int().optional(),
  averageRating: z.number().int().optional(),
  lastUsedAt: z.date().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  createdBy: z.string().uuid(),
  organizationId: z.string().uuid().optional(),
  isPublic: z.boolean().optional(),
});

export const selectAiAssistantSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  avatar: z.string().nullable(),
  type: AssistantTypeEnum,
  specialization: z.string().nullable(),
  modelType: z.string(),
  modelConfig: z.object({
    provider: ModelProviderEnum,
    modelName: z.string(),
    temperature: z.number().optional(),
    maxTokens: z.number().int().optional(),
    topP: z.number().optional(),
    frequencyPenalty: z.number().optional(),
    presencePenalty: z.number().optional(),
  }),
  systemPrompt: z.string(),
  capabilities: z.array(z.string()),
  isActive: z.boolean(),
  usageCount: z.number().int(),
  averageRating: z.number().int(),
  lastUsedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid(),
  organizationId: z.string().uuid().nullable(),
  isPublic: z.boolean(),
});

export const updateAiAssistantSchema = insertAiAssistantSchema.partial();

export const aiAssistantPublicSchema = selectAiAssistantSchema.omit({
  createdBy: true,
  organizationId: true,
});

export type AiAssistant = typeof aiAssistants.$inferSelect;
export type NewAiAssistant = typeof aiAssistants.$inferInsert;
export type UpdateAiAssistant = z.infer<typeof updateAiAssistantSchema>;
export type AiAssistantPublic = z.infer<typeof aiAssistantPublicSchema>;
