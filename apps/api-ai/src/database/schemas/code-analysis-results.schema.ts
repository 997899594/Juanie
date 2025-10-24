import { relations } from 'drizzle-orm'
import {
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { repositories } from './repositories.schema'

// 枚举定义
export const AnalyzerTypeEnum = z.enum(['security', 'quality', 'performance', 'ai_review'])

export const codeAnalysisResults = pgTable('code_analysis_results', {
  id: serial('id').primaryKey(),
  repositoryId: integer('repository_id').references(() => repositories.id),
  commitHash: text('commit_hash').notNull(),
  branch: text('branch'),
  
  // 分析配置
  analyzerType: text('analyzer_type').notNull(), // 'security', 'quality', 'performance', 'ai_review'
  analyzerVersion: text('analyzer_version'),
  
  // 分析结果
  overallScore: decimal('overall_score', { precision: 3, scale: 2 }),
  issuesFound: integer('issues_found').default(0),
  criticalIssues: integer('critical_issues').default(0),
  securityVulnerabilities: integer('security_vulnerabilities').default(0),
  
  // 详细结果
  findings: jsonb('findings').default([]),
  suggestions: jsonb('suggestions').default([]),
  
  // AI增强分析
  aiSummary: text('ai_summary'),
  aiPriorityRecommendations: jsonb('ai_priority_recommendations').default([]),
  
  // 趋势分析
  improvementTrend: jsonb('improvement_trend').default({}),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Indexes
export const codeAnalysisResultsRepositoryIdx = index('code_analysis_results_repository_idx').on(
  codeAnalysisResults.repositoryId,
)
export const codeAnalysisResultsCommitIdx = index('code_analysis_results_commit_idx').on(
  codeAnalysisResults.commitHash,
)
export const codeAnalysisResultsAnalyzerTypeIdx = index(
  'code_analysis_results_analyzer_type_idx',
).on(codeAnalysisResults.analyzerType)
export const codeAnalysisResultsBranchIdx = index('code_analysis_results_branch_idx').on(
  codeAnalysisResults.branch,
)
export const codeAnalysisResultsCreatedAtIdx = index('code_analysis_results_created_at_idx').on(
  codeAnalysisResults.createdAt,
)

// Relations
export const codeAnalysisResultsRelations = relations(codeAnalysisResults, ({ one }) => ({
  repository: one(repositories, {
    fields: [codeAnalysisResults.repositoryId],
    references: [repositories.id],
  }),
}))

// Zod Schemas with detailed enums
export const insertCodeAnalysisResultSchema = createInsertSchema(codeAnalysisResults)

export const selectCodeAnalysisResultSchema = createSelectSchema(codeAnalysisResults)

export const updateCodeAnalysisResultSchema = selectCodeAnalysisResultSchema.pick({
  repositoryId: true,
  commitHash: true,
  branch: true,
  analyzerType: true,
  analyzerVersion: true,
  overallScore: true,
  issuesFound: true,
  criticalIssues: true,
  securityVulnerabilities: true,
  findings: true,
  suggestions: true,
  aiSummary: true,
  aiPriorityRecommendations: true,
  improvementTrend: true,
}).partial();

export type CodeAnalysisResult = typeof codeAnalysisResults.$inferSelect
export type NewCodeAnalysisResult = typeof codeAnalysisResults.$inferInsert
export type UpdateCodeAnalysisResult = z.infer<typeof updateCodeAnalysisResultSchema>
export type AnalyzerType = z.infer<typeof AnalyzerTypeEnum>
