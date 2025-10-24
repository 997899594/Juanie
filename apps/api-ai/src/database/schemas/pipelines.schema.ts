import { pgTable, serial, integer, text, timestamp, jsonb, boolean, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { projects } from './projects.schema';

// 枚举定义
export const ConfigSourceEnum = z.enum(['repository', 'ui', 'api', 'template']);
export const TriggerTypeEnum = z.enum(['push', 'pull_request', 'schedule', 'manual', 'webhook']);

export const pipelines = pgTable('pipelines', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  repositoryId: integer('repository_id'),
  name: text('name').notNull(),
  description: text('description'),
  configSource: text('config_source').default('repository'), // 'repository', 'ui', 'api', 'template'
  configPath: text('config_path').default('.github/workflows/ci.yml'),
  pipelineConfig: jsonb('pipeline_config').default({}),
  triggers: jsonb('triggers').default([]), // Array of trigger types
  triggerBranches: jsonb('trigger_branches').default([]),
  triggerPaths: jsonb('trigger_paths').default([]),
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
  pipelineConfig: true,
  triggers: true,
  triggerBranches: true,
  triggerPaths: true,
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