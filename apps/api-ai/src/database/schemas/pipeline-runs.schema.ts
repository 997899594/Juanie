import { pgTable, serial, integer, text, timestamp, jsonb, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { pipelines } from './pipelines.schema';
import { users } from './users.schema';

// 枚举定义
export const PipelineRunTriggerTypeEnum = z.enum(['push', 'pull_request', 'schedule', 'manual']);
export const PipelineRunStatusEnum = z.enum(['pending', 'running', 'success', 'failed', 'cancelled']);

export const pipelineRuns = pgTable('pipeline_runs', {
  id: serial('id').primaryKey(),
  pipelineId: integer('pipeline_id').references(() => pipelines.id, { onDelete: 'cascade' }),
  
  // 触发信息
  triggerType: text('trigger_type').notNull(), // 'push', 'pull_request', 'schedule', 'manual'
  triggerUserId: integer('trigger_user_id').references(() => users.id),
  triggerData: jsonb('trigger_data').default({}),
  
  // 执行信息
  runNumber: integer('run_number').notNull(),
  commitHash: text('commit_hash'),
  branch: text('branch'),
  
  // 状态管理
  status: text('status').default('pending'), // 'pending', 'running', 'success', 'failed', 'cancelled'
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
  duration: integer('duration'), // 秒
  
  // 资源使用
  computeUnitsUsed: decimal('compute_units_used', { precision: 10, scale: 2 }),
  estimatedCost: decimal('estimated_cost', { precision: 10, scale: 2 }),
  carbonFootprint: decimal('carbon_footprint', { precision: 10, scale: 4 }), // kg CO2
  
  // AI分析
  failurePredictionScore: decimal('failure_prediction_score', { precision: 3, scale: 2 }),
  optimizationSuggestions: jsonb('optimization_suggestions').default([]),
  
  // 结果数据
  artifacts: jsonb('artifacts').default([]),
  testResults: jsonb('test_results').default({}),
  securityScanResults: jsonb('security_scan_results').default({}),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Indexes
export const pipelineRunsPipelineIdx = index('pipeline_runs_pipeline_idx').on(pipelineRuns.pipelineId);
export const pipelineRunsStatusIdx = index('pipeline_runs_status_idx').on(pipelineRuns.status);
export const pipelineRunsTriggerUserIdx = index('pipeline_runs_trigger_user_idx').on(pipelineRuns.triggerUserId);
export const pipelineRunsRunNumberIdx = index('pipeline_runs_run_number_idx').on(pipelineRuns.pipelineId, pipelineRuns.runNumber);

// Relations
export const pipelineRunsRelations = relations(pipelineRuns, ({ one }) => ({
  pipeline: one(pipelines, {
    fields: [pipelineRuns.pipelineId],
    references: [pipelines.id],
  }),
  triggerUser: one(users, {
    fields: [pipelineRuns.triggerUserId],
    references: [users.id],
  }),
}));

// Zod Schemas with detailed enums
export const insertPipelineRunSchema = createInsertSchema(pipelineRuns);

export const selectPipelineRunSchema = createSelectSchema(pipelineRuns);

export const updatePipelineRunSchema = selectPipelineRunSchema.pick({
  pipelineId: true
}).partial();

export type PipelineRun = typeof pipelineRuns.$inferSelect;
export type NewPipelineRun = typeof pipelineRuns.$inferInsert;
export type UpdatePipelineRun = z.infer<typeof updatePipelineRunSchema>;
export type PipelineRunTriggerType = z.infer<typeof PipelineRunTriggerTypeEnum>;
export type PipelineRunStatus = z.infer<typeof PipelineRunStatusEnum>;