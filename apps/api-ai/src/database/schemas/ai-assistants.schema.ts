import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, integer, index, foreignKey } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './users.schema';
import { organizations } from './organizations.schema';

export const aiAssistants = pgTable(
  'ai_assistants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    avatar: text('avatar'),
    
    // AI Assistant Type & Specialization
    type: varchar('type', { length: 50 }).notNull(), // 'code-reviewer', 'devops-engineer', 'security-analyst', 'cost-optimizer', 'incident-responder'
    specialization: varchar('specialization', { length: 100 }), // 'frontend', 'backend', 'infrastructure', 'security', 'performance'
    
    // AI Model Configuration
    aiModel: jsonb('ai_model').$type<{
      provider: 'openai' | 'anthropic' | 'google' | 'custom';
      modelName: string;
      version?: string;
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
    }>(),
    
    // Capabilities & Skills
    capabilities: jsonb('capabilities').$type<{
      codeReview?: {
        languages: string[];
        frameworks: string[];
        focusAreas: string[]; // 'security', 'performance', 'maintainability', 'best-practices'
        autoApprove?: boolean;
      };
      devopsAutomation?: {
        cicd: boolean;
        deployment: boolean;
        monitoring: boolean;
        scaling: boolean;
        rollback: boolean;
      };
      securityAnalysis?: {
        vulnerabilityScanning: boolean;
        complianceChecking: boolean;
        threatDetection: boolean;
        accessReview: boolean;
      };
      costOptimization?: {
        resourceAnalysis: boolean;
        rightsizing: boolean;
        scheduledShutdown: boolean;
        reservedInstances: boolean;
      };
      incidentResponse?: {
        alertTriage: boolean;
        rootCauseAnalysis: boolean;
        mitigationSuggestions: boolean;
        postmortemGeneration: boolean;
      };
    }>(),
    
    // Personality & Behavior
    personality: jsonb('personality').$type<{
      tone?: 'professional' | 'friendly' | 'concise' | 'detailed';
      communicationStyle?: 'direct' | 'collaborative' | 'educational';
      proactiveness?: 'reactive' | 'proactive' | 'autonomous';
      riskTolerance?: 'conservative' | 'balanced' | 'aggressive';
    }>(),
    
    // Knowledge Base & Training
    knowledgeBase: jsonb('knowledge_base').$type<{
      trainingData?: string[];
      customInstructions?: string;
      contextWindow?: number;
      lastTrainingUpdate?: string;
      specializedKnowledge?: {
        domains: string[];
        certifications: string[];
        experience: string[];
      };
    }>(),
    
    // Performance Metrics
    performanceMetrics: jsonb('performance_metrics').$type<{
      accuracy?: number;
      responseTime?: number; // milliseconds
      userSatisfaction?: number; // 1-5 scale
      tasksCompleted?: number;
      successRate?: number;
      lastEvaluated?: string;
    }>(),
    
    // Access Control
    isPublic: boolean('is_public').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    
    // Ownership
    createdBy: uuid('created_by').notNull().references(() => users.id),
    organizationId: uuid('organization_id').references(() => organizations.id),
    
    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at'),
  }
);

// 索引定义
export const aiAssistantsIndexes = {
  typeIdx: index('ai_assistants_type_idx').on(aiAssistants.type),
  specializationIdx: index('ai_assistants_specialization_idx').on(aiAssistants.specialization),
  createdByIdx: index('ai_assistants_created_by_idx').on(aiAssistants.createdBy),
  organizationIdIdx: index('ai_assistants_organization_id_idx').on(aiAssistants.organizationId),
  isActiveIdx: index('ai_assistants_is_active_idx').on(aiAssistants.isActive),
  isPublicIdx: index('ai_assistants_is_public_idx').on(aiAssistants.isPublic),
};

// Zod schemas for validation
export const insertAiAssistantSchema = createInsertSchema(aiAssistants, {
  name: z.string().min(1).max(100),
});

export const selectAiAssistantSchema = createSelectSchema(aiAssistants);

export const updateAiAssistantSchema = insertAiAssistantSchema.partial().omit({
  id: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export const aiAssistantPublicSchema = selectAiAssistantSchema.pick({
  id: true,
  name: true,
  description: true,
  avatar: true,
  type: true,
  specialization: true,
  capabilities: true,
  personality: true,
  isPublic: true,
  createdAt: true,
});

export type AiAssistant = typeof aiAssistants.$inferSelect;
export type NewAiAssistant = typeof aiAssistants.$inferInsert;
export type UpdateAiAssistant = z.infer<typeof updateAiAssistantSchema>;
export type AiAssistantPublic = z.infer<typeof aiAssistantPublicSchema>;