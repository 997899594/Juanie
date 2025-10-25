import { pgTable, uuid, integer, text, timestamp, decimal, index, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { aiAssistants } from './ai-assistants.schema';

// 枚举定义
export const ContextTypeEnum = z.enum(['code', 'security', 'performance', 'cost']);
export const RecommendationPriorityEnum = z.enum(['low', 'medium', 'high', 'critical']);
export const UserFeedbackEnum = z.enum(['accepted', 'rejected', 'modified']);

export const ContextTypePgEnum = pgEnum('recommendation_context_type', ['code', 'security', 'performance', 'cost']);
export const RecommendationPriorityPgEnum = pgEnum('recommendation_priority', ['low', 'medium', 'high', 'critical']);
export const UserFeedbackPgEnum = pgEnum('user_feedback', ['accepted', 'rejected', 'modified']);

export const aiRecommendations = pgTable('ai_recommendations', {
  id: uuid('id').defaultRandom().primaryKey(),
  assistantId: uuid('assistant_id').references(() => aiAssistants.id),
  contextType: ContextTypePgEnum('context_type').notNull(),
  contextId: integer('context_id').notNull(),
  
  // 推荐内容
  title: text('title').notNull(),
  description: text('description'),
  recommendationType: text('recommendation_type').notNull(),
  recommendationDetails: text('recommendation_details'),
  implementationSteps: text('implementation_steps'),
  confidenceScore: decimal('confidence_score', { precision: 3, scale: 2 }).notNull(),
  priority: RecommendationPriorityPgEnum('priority').default('medium'),
  
  // 反馈
  userFeedback: UserFeedbackPgEnum('user_feedback'),
  feedbackNotes: text('feedback_notes'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Indexes
export const aiRecommendationsAssistantIdx = index('ai_recommendations_assistant_idx').on(aiRecommendations.assistantId);
export const aiRecommendationsContextIdx = index('ai_recommendations_context_idx').on(aiRecommendations.contextType, aiRecommendations.contextId);
export const aiRecommendationsPriorityIdx = index('ai_recommendations_priority_idx').on(aiRecommendations.priority);

// Relations
export const aiRecommendationsRelations = relations(aiRecommendations, ({ one }) => ({
  assistant: one(aiAssistants, {
    fields: [aiRecommendations.assistantId],
    references: [aiAssistants.id],
  }),
}));

// Zod Schemas
export const insertAiRecommendationSchema = createInsertSchema(aiRecommendations);
export const selectAiRecommendationSchema = createSelectSchema(aiRecommendations);
export const updateAiRecommendationSchema = selectAiRecommendationSchema.pick({
  assistantId: true,
  contextType: true,
  contextId: true,
  title: true,
  description: true,
  recommendationType: true,
  recommendationDetails: true,
  implementationSteps: true,
  confidenceScore: true,
  priority: true,
  userFeedback: true,
  feedbackNotes: true,
}).partial();

export type AiRecommendation = typeof aiRecommendations.$inferSelect;
export type NewAiRecommendation = typeof aiRecommendations.$inferInsert;
export type UpdateAiRecommendation = z.infer<typeof updateAiRecommendationSchema>;
export type ContextType = z.infer<typeof ContextTypeEnum>;
export type RecommendationPriority = z.infer<typeof RecommendationPriorityEnum>;
export type UserFeedback = z.infer<typeof UserFeedbackEnum>;