import { pgTable, uuid, integer, text, timestamp, boolean, decimal, index, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { projects } from './projects.schema';

// 枚举定义
export const ConfigSourceEnum = z.enum(['repository', 'ui', 'api', 'template']);
export const TriggerTypeEnum = z.enum(['push', 'pull_request', 'schedule', 'manual', 'webhook']);
export const ConfigSourcePgEnum = pgEnum('config_source', ['repository', 'ui', 'api', 'template']);

export const pipelines = pgTable('pipelines', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  repositoryId: uuid('repository_id'),
  name: text('name').notNull(),
  description: text('description'),
  configSource: ConfigSourcePgEnum('config_source').default('repository'),
  configPath: text('config_path').default('.github/workflows/ci.yml'),
  // 简化pipeline_config JSONB字段
  pipelineTimeout: integer('pipeline_timeout').default(3600), // 默认1小时
  maxRetries: integer('max_retries').default(3),
  enableArtifacts: boolean('enable_artifacts').default(true),
  
  // 简化triggers JSONB字段
  triggerOnPush: boolean('trigger_on_push').default(true),
  triggerOnPr: boolean('trigger_on_pr').default(true),
  triggerOnSchedule: boolean('trigger_on_schedule').default(false),
  triggerOnManual: boolean('trigger_on_manual').default(true),
  
  // 简化trigger_branches JSONB字段
  mainBranch: text('main_branch').default('main'),
  protectedBranches: text('protected_branches').default('main,develop'), // 逗号分隔的分支名
  
  // 简化trigger_paths JSONB字段
  includePaths: text('include_paths').default('**/*'), // 逗号分隔的路径模式
  excludePaths: text('exclude_paths').default('node_modules/**,.git/**'), // 逗号分隔的排除路径
  aiOptimizationEnabled: boolean('ai_optimization_enabled').default(true),
  autoParallelization: boolean('auto_parallelization').default(false),
  smartCaching: boolean('smart_caching').default(true),
  isActive: boolean('is_active').default(true),
  successRate: decimal('success_rate', { precision: 3, scale: 2 }),
  averageDuration: integer('average_duration'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Indexes
export const pipelinesProjectIdx = index('pipelines_project_idx').on(pipelines.projectId);
export const pipelinesRepositoryIdx = index('pipelines_repository_idx').on(pipelines.repositoryId);
export const pipelinesActiveIdx = index('pipelines_active_idx').on(pipelines.isActive);
export const pipelinesConfigSourceIdx = index('pipelines_config_source_idx').on(pipelines.configSource);
export const pipelinesProjectNameUnique = uniqueIndex('pipelines_project_name_unique').on(
  pipelines.projectId,
  pipelines.name,
);

// Relations
export const pipelinesRelations = relations(pipelines, ({ one }) => ({
  project: one(projects, {
    fields: [pipelines.projectId],
    references: [projects.id],
  }),
}));

// Zod Schemas with detailed enums
export const insertPipelineSchema = createInsertSchema(pipelines);

export const selectPipelineSchema = createSelectSchema(pipelines);

export const updatePipelineSchema = selectPipelineSchema.pick({
  projectId: true,
  repositoryId: true,
  name: true,
  description: true,
  configSource: true,
  configPath: true,
  pipelineTimeout: true,
  maxRetries: true,
  enableArtifacts: true,
  triggerOnPush: true,
  triggerOnPr: true,
  triggerOnSchedule: true,
  triggerOnManual: true,
  mainBranch: true,
  protectedBranches: true,
  includePaths: true,
  excludePaths: true,
  aiOptimizationEnabled: true,
  autoParallelization: true,
  smartCaching: true,
  isActive: true,
  successRate: true,
  averageDuration: true,
}).partial();

export type Pipeline = typeof pipelines.$inferSelect;
export type NewPipeline = typeof pipelines.$inferInsert;
export type UpdatePipeline = z.infer<typeof updatePipelineSchema>;
export type ConfigSource = z.infer<typeof ConfigSourceEnum>;
export type TriggerType = z.infer<typeof TriggerTypeEnum>;