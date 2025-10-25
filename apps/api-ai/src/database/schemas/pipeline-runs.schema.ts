import { pgTable, uuid, integer, text, timestamp, jsonb, decimal, boolean, index, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { pipelines } from './pipelines.schema'
import { users } from './users.schema'

// 枚举定义
export const PipelineRunTriggerTypeEnum = z.enum(['push', 'pull_request', 'schedule', 'manual']);
export const PipelineRunStatusEnum = z.enum(['pending', 'running', 'success', 'failed', 'cancelled']);
export const PipelineRunTriggerTypePgEnum = pgEnum('pipeline_run_trigger_type', ['push', 'pull_request', 'schedule', 'manual']);
export const PipelineRunStatusPgEnum = pgEnum('pipeline_run_status', ['pending', 'running', 'success', 'failed', 'cancelled']);

export const pipelineRuns = pgTable('pipeline_runs', {
  id: uuid('id').defaultRandom().primaryKey(), // 运行唯一ID
  pipelineId: uuid('pipeline_id').references(() => pipelines.id, { onDelete: 'cascade' }), // 所属流水线ID
  // 触发信息
  triggerType: PipelineRunTriggerTypePgEnum('trigger_type').notNull(), // 触发类型
  triggerUserId: uuid('trigger_user_id').references(() => users.id), // 触发用户ID
  // 简化 triggerData - 核心触发信息
  triggerSource: text('trigger_source'), // 触发源（repository/scheduler/manual）
  triggerBranch: text('trigger_branch'), // 触发分支
  triggerCommit: text('trigger_commit'), // 触发提交
  // 执行信息
  runNumber: integer('run_number').notNull(), // 运行序号（递增）
  commitHash: text('commit_hash'), // 提交哈希
  branch: text('branch'), // 分支
  // 状态管理
  status: PipelineRunStatusPgEnum('status').default('pending'), // 运行状态
  startedAt: timestamp('started_at'), // 开始时间
  finishedAt: timestamp('finished_at'), // 完成时间
  duration: integer('duration'), // 持续时长（秒）
  // 资源使用
  computeUnitsUsed: decimal('compute_units_used', { precision: 10, scale: 2 }), // 消耗计算单元
  estimatedCost: decimal('estimated_cost', { precision: 10, scale: 2 }), // 预估成本
  carbonFootprint: decimal('carbon_footprint', { precision: 10, scale: 4 }), // 碳排放（kg CO2）
  // AI分析
  failurePredictionScore: decimal('failure_prediction_score', { precision: 3, scale: 2 }), // 失败预测分
  // 简化 optimizationSuggestions - 核心优化建议
  optimizationSuggestion: text('optimization_suggestion'), // 主要优化建议
  performanceScore: integer('performance_score'), // 性能评分（1-100）
  // 简化 testResults - 核心测试结果
  testsTotal: integer('tests_total').default(0), // 总测试数
  testsPassed: integer('tests_passed').default(0), // 通过测试数
  testsFailed: integer('tests_failed').default(0), // 失败测试数
  testCoverage: decimal('test_coverage', { precision: 5, scale: 2 }), // 覆盖率（%）
  // 简化 securityScanResults - 核心安全扫描结果
  vulnerabilitiesCritical: integer('vulnerabilities_critical').default(0), // 严重漏洞数
  vulnerabilitiesHigh: integer('vulnerabilities_high').default(0), // 高危漏洞数
  vulnerabilitiesMedium: integer('vulnerabilities_medium').default(0), // 中危漏洞数
  vulnerabilitiesLow: integer('vulnerabilities_low').default(0), // 低危漏洞数
  securityScore: integer('security_score'), // 安全评分（1-100）
  // 简化 artifacts - 制品信息
  artifactCount: integer('artifact_count').default(0), // 制品数量
  artifactSizeMb: decimal('artifact_size_mb', { precision: 10, scale: 2 }), // 制品大小MB
  createdAt: timestamp('created_at').defaultNow().notNull(), // 创建时间
})

// Indexes
export const pipelineRunsPipelineIdx = index('pipeline_runs_pipeline_idx').on(pipelineRuns.pipelineId);
export const pipelineRunsStatusIdx = index('pipeline_runs_status_idx').on(pipelineRuns.status);
export const pipelineRunsTriggerUserIdx = index('pipeline_runs_trigger_user_idx').on(pipelineRuns.triggerUserId);
export const pipelineRunsRunNumberIdx = index('pipeline_runs_run_number_idx').on(pipelineRuns.pipelineId, pipelineRuns.runNumber);
export const pipelineRunsPipelineStatusCreatedIdx = index('pipeline_runs_pipeline_status_created_idx').on(
  pipelineRuns.pipelineId,
  pipelineRuns.status,
  pipelineRuns.createdAt,
);

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
export const insertPipelineRunSchema = createInsertSchema(pipelineRuns, {
  performanceScore: z.number().int().min(1).max(100).optional(),
  testCoverage: z.number().min(0).max(100).optional(),
  securityScore: z.number().int().min(1).max(100).optional(),
  failurePredictionScore: z.number().min(0).max(1).optional(),
});

export const selectPipelineRunSchema = createSelectSchema(pipelineRuns);

export const updatePipelineRunSchema = selectPipelineRunSchema.pick({
  pipelineId: true
}).partial();

export type PipelineRun = typeof pipelineRuns.$inferSelect;
export type NewPipelineRun = typeof pipelineRuns.$inferInsert;
export type UpdatePipelineRun = z.infer<typeof updatePipelineRunSchema>;
export type PipelineRunTriggerType = z.infer<typeof PipelineRunTriggerTypeEnum>;
export type PipelineRunStatus = z.infer<typeof PipelineRunStatusEnum>;