import { relations } from 'drizzle-orm'
import {
  decimal,
  index,
  integer,
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { z } from 'zod'
import { repositories } from './repositories.schema'

// 枚举定义
export const AnalyzerTypeEnum = z.enum(['security', 'quality', 'performance', 'ai_review'])
export const AnalyzerTypePgEnum = pgEnum('analyzer_type', ['security', 'quality', 'performance', 'ai_review'])

export const codeAnalysisResults = pgTable('code_analysis_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  repositoryId: uuid('repository_id').references(() => repositories.id),
  commitHash: text('commit_hash').notNull(),
  branch: text('branch'),
  
  // 分析器信息
  analyzerType: AnalyzerTypePgEnum('analyzer_type').notNull(),
  analyzerVersion: text('analyzer_version'),
  
  // 分析结果
  overallScore: decimal('overall_score', { precision: 3, scale: 2 }),
  issuesFound: integer('issues_found').default(0),
  criticalIssues: integer('critical_issues').default(0),
  securityVulnerabilities: integer('security_vulnerabilities').default(0),
  
  // 详细结果
  // 简化findings JSONB字段
  topFindingCategory: text('top_finding_category'),
  findingCount: integer('finding_count').default(0),
  findingSeverity: text('finding_severity'), // 'low', 'medium', 'high', 'critical'
  
  // 简化suggestions JSONB字段
  suggestionCount: integer('suggestion_count').default(0),
  topSuggestion: text('top_suggestion'),
  
  // AI增强分析
  aiSummary: text('ai_summary'),
  // 简化ai_priority_recommendations JSONB字段
  aiRecommendationCount: integer('ai_recommendation_count').default(0),
  topAiRecommendation: text('top_ai_recommendation'),
  aiConfidenceScore: decimal('ai_confidence_score', { precision: 3, scale: 2 }),
  
  // 趋势分析
  // 简化improvement_trend JSONB字段
  scoreTrend: text('score_trend'), // 'improving', 'stable', 'declining'
  trendPercentage: decimal('trend_percentage', { precision: 5, scale: 2 }), // 变化百分比
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('code_analysis_results_repository_idx').on(table.repositoryId),
  index('code_analysis_results_commit_idx').on(table.commitHash),
  index('code_analysis_results_analyzer_type_idx').on(table.analyzerType),
  index('code_analysis_results_branch_idx').on(table.branch),
  index('code_analysis_results_created_at_idx').on(table.createdAt),
  index('code_analysis_results_repo_created_idx').on(table.repositoryId, table.createdAt),
]);

// Relations
export const codeAnalysisResultsRelations = relations(codeAnalysisResults, ({ one }) => ({
  repository: one(repositories, {
    fields: [codeAnalysisResults.repositoryId],
    references: [repositories.id],
  }),
}))

// Zod Schemas with detailed enums
export const insertCodeAnalysisResultSchema = z.object({
  id: z.string().uuid().optional(),
  repositoryId: z.string().uuid().optional(),
  commitHash: z.string(),
  branch: z.string().optional(),
  analyzerType: AnalyzerTypeEnum,
  analyzerVersion: z.string().optional(),
  overallScore: z.number().min(0).max(1).optional(),
  issuesFound: z.number().int().optional(),
  criticalIssues: z.number().int().optional(),
  securityVulnerabilities: z.number().int().optional(),
  topFindingCategory: z.string().optional(),
  findingCount: z.number().int().optional(),
  findingSeverity: z.string().optional(),
  suggestionCount: z.number().int().optional(),
  topSuggestion: z.string().optional(),
  aiSummary: z.string().optional(),
  aiRecommendationCount: z.number().int().optional(),
  topAiRecommendation: z.string().optional(),
  aiConfidenceScore: z.number().min(0).max(1).optional(),
  scoreTrend: z.string().optional(),
  trendPercentage: z.number().min(0).max(100).optional(),
  createdAt: z.date().optional(),
});

export const selectCodeAnalysisResultSchema = z.object({
  id: z.string().uuid(),
  repositoryId: z.string().uuid().nullable(),
  commitHash: z.string(),
  branch: z.string().nullable(),
  analyzerType: AnalyzerTypeEnum,
  analyzerVersion: z.string().nullable(),
  overallScore: z.number().nullable(),
  issuesFound: z.number().int(),
  criticalIssues: z.number().int(),
  securityVulnerabilities: z.number().int(),
  topFindingCategory: z.string().nullable(),
  findingCount: z.number().int(),
  findingSeverity: z.string().nullable(),
  suggestionCount: z.number().int(),
  topSuggestion: z.string().nullable(),
  aiSummary: z.string().nullable(),
  aiRecommendationCount: z.number().int(),
  topAiRecommendation: z.string().nullable(),
  aiConfidenceScore: z.number().nullable(),
  scoreTrend: z.string().nullable(),
  trendPercentage: z.number().nullable(),
  createdAt: z.date(),
});

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
  topFindingCategory: true,
  findingCount: true,
  findingSeverity: true,
  suggestionCount: true,
  topSuggestion: true,
  aiSummary: true,
  aiRecommendationCount: true,
  topAiRecommendation: true,
  aiConfidenceScore: true,
  scoreTrend: true,
  trendPercentage: true,
}).partial();

export type CodeAnalysisResult = typeof codeAnalysisResults.$inferSelect
export type NewCodeAnalysisResult = typeof codeAnalysisResults.$inferInsert
export type UpdateCodeAnalysisResult = z.infer<typeof updateCodeAnalysisResultSchema>
export type AnalyzerType = z.infer<typeof AnalyzerTypeEnum>
