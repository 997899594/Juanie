import { pgTable, serial, integer, text, timestamp, jsonb, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { aiAssistants } from './ai-assistants.schema';

// 枚举定义
export const ContextTypeEnum = z.enum(['code', 'security', 'performance', 'cost']);
export const RecommendationPriorityEnum = z.enum(['low', 'medium', 'high', 'critical']);
export const UserFeedbackEnum = z.enum(['accepted', 'rejected', 'modified']);

export const aiRecommendations = pgTable('ai_recommendations', {
  id: serial('id').primaryKey(),
  assistantId: integer('assistant_id').references(() => aiAssistants.id),
  contextType: text('context_type').notNull(), // 'code', 'security', 'performance', 'cost'
  contextId: integer('context_id').notNull(), // 关联的具体对象ID
  
  // 推荐内容
  title: text('title').notNull(),
  description: text('description'),
  recommendationData: jsonb('recommendation_data').notNull(),
  confidenceScore: decimal('confidence_score', { precision: 3, scale: 2 }).notNull(),
  priority: text('priority').default('medium'), // 'low', 'medium', 'high', 'critical'
  
  // 分类和标签
  category: text('category'),
  tags: jsonb('tags').default([]),
  
  // 用户反馈
  userFeedback: text('user_feedback'), // 'accepted', 'rejected', 'modified'
  feedbackReason: text('feedback_reason'),
  appliedAt: timestamp('applied_at'),
  
  // 影响评估
  estimatedImpact: jsonb('estimated_impact').default({}), // 成本节省、性能提升等
  actualImpact: jsonb('actual_impact').default({}),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
});

// Indexes
export const aiRecommendationsAssistantIdx = index('ai_recommendations_assistant_idx').on(aiRecommendations.assistantId);
export const aiRecommendationsContextIdx = index('ai_recommendations_context_idx').on(aiRecommendations.contextType, aiRecommendations.contextId);
export const aiRecommendationsPriorityIdx = index('ai_recommendations_priority_idx').on(aiRecommendations.priority);
export const aiRecommendationsFeedbackIdx = index('ai_recommendations_feedback_idx').on(aiRecommendations.userFeedback);
export const aiRecommendationsCreatedAtIdx = index('ai_recommendations_created_at_idx').on(aiRecommendations.createdAt);
export const aiRecommendationsExpiresAtIdx = index('ai_recommendations_expires_at_idx').on(aiRecommendations.expiresAt);

// Relations
export const aiRecommendationsRelations = relations(aiRecommendations, ({ one }) => ({
  assistant: one(aiAssistants, {
    fields: [aiRecommendations.assistantId],
    references: [aiAssistants.id],
  }),
}));

// Zod Schemas with detailed enums
export const insertAiRecommendationSchema = createInsertSchema(aiRecommendations);

export const selectAiRecommendationSchema = createSelectSchema(aiRecommendations);

export const updateAiRecommendationSchema = insertAiRecommendationSchema.partial().omit({
  id: true,
  createdAt: true,
});

export type AiRecommendation = typeof aiRecommendations.$inferSelect;
export type NewAiRecommendation = typeof aiRecommendations.$inferInsert;
export type UpdateAiRecommendation = z.infer<typeof updateAiRecommendationSchema>;
export type ContextType = z.infer<typeof ContextTypeEnum>;
export type RecommendationPriority = z.infer<typeof RecommendationPriorityEnum>;
export type UserFeedback = z.infer<typeof UserFeedbackEnum>;