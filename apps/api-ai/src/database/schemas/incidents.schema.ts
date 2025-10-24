import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, integer, index, foreignKey } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './users.schema';
import { projects } from './projects.schema';

export const incidents = pgTable(
  'incidents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    
    // Basic Information
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description').notNull(),
    
    // Classification
    severity: varchar('severity', { length: 20 }).notNull(), // 'critical', 'high', 'medium', 'low'
    priority: varchar('priority', { length: 20 }).notNull(), // 'urgent', 'high', 'medium', 'low'
    status: varchar('status', { length: 20 }).notNull().default('open'), // 'open', 'investigating', 'resolved', 'closed'
    category: varchar('category', { length: 50 }).notNull(), // 'infrastructure', 'application', 'security', 'performance'
    subcategory: varchar('subcategory', { length: 50 }),
    
    // Impact Assessment
    impactAssessment: jsonb('impact_assessment').$type<{
      affectedServices?: string[];
      affectedUsers?: {
        count?: number;
        percentage?: number;
        regions?: string[];
      };
      businessImpact?: {
        revenue?: number;
        sla?: {
          breached: boolean;
          target: number;
          actual: number;
        };
        reputation?: 'low' | 'medium' | 'high';
      };
      technicalImpact?: {
        systemsDown?: string[];
        performanceDegradation?: string[];
        dataIntegrity?: boolean;
      };
    }>(),
    
    // Detection & Response
    detectionResponse: jsonb('detection_response').$type<{
      detectionMethod?: 'monitoring' | 'user-report' | 'automated-alert' | 'manual-discovery';
      detectionTime?: string; // ISO timestamp
      responseTime?: number; // minutes
      escalationPath?: Array<{
        level: number;
        role: string;
        notified: boolean;
        timestamp?: string;
      }>;
      communicationChannels?: string[]; // 'slack', 'email', 'sms', 'pagerduty'
    }>(),
    
    // Technical Details
    technicalDetails: jsonb('technical_details').$type<{
      errorMessages?: string[];
      stackTraces?: string[];
      logEntries?: Array<{
        timestamp: string;
        level: string;
        message: string;
        source: string;
      }>;
      metrics?: {
        cpu?: number;
        memory?: number;
        network?: number;
        responseTime?: number;
        errorRate?: number;
      };
      affectedComponents?: Array<{
        name: string;
        type: string;
        status: string;
        version?: string;
      }>;
    }>(),
    
    // Root Cause Analysis
    rootCauseAnalysis: jsonb('root_cause_analysis').$type<{
      primaryCause?: string;
      contributingFactors?: string[];
      timeline?: Array<{
        timestamp: string;
        event: string;
        impact: string;
      }>;
      investigation?: {
        methods?: string[];
        tools?: string[];
        findings?: string[];
      };
      preventionMeasures?: string[];
    }>(),
    
    // Resolution & Mitigation
    resolutionMitigation: jsonb('resolution_mitigation').$type<{
      immediateActions?: string[];
      temporaryWorkarounds?: string[];
      permanentSolution?: string;
      rollbackPlan?: {
        available: boolean;
        steps?: string[];
        estimatedTime?: number; // minutes
      };
      verificationSteps?: string[];
      monitoringPlan?: string[];
    }>(),
    
    // Communication & Updates
    communicationUpdates: jsonb('communication_updates').$type<{
      statusPageUpdates?: Array<{
        timestamp: string;
        status: string;
        message: string;
        author: string;
      }>;
      internalUpdates?: Array<{
        timestamp: string;
        audience: string;
        message: string;
        author: string;
      }>;
      customerNotifications?: Array<{
        timestamp: string;
        channel: string;
        message: string;
        recipients?: number;
      }>;
    }>(),
    
    // AI-Assisted Response
    aiAssistedResponse: jsonb('ai_assisted_response').$type<{
      recommendations?: Array<{
        type: 'diagnosis' | 'mitigation' | 'prevention';
        confidence: number;
        suggestion: string;
        reasoning: string;
      }>;
      similarIncidents?: Array<{
        id: string;
        similarity: number;
        resolution: string;
      }>;
      automatedActions?: Array<{
        action: string;
        status: 'pending' | 'executed' | 'failed';
        timestamp?: string;
        result?: string;
      }>;
      knowledgeBase?: {
        articles?: string[];
        runbooks?: string[];
        procedures?: string[];
      };
    }>(),
    
    // Metrics & SLA
    metricsSla: jsonb('metrics_sla').$type<{
      timeToDetect?: number; // minutes
      timeToRespond?: number; // minutes
      timeToResolve?: number; // minutes
      timeToRecover?: number; // minutes
      slaCompliance?: {
        target: number;
        actual: number;
        breached: boolean;
      };
      availability?: {
        before: number;
        during: number;
        after: number;
      };
    }>(),
    
    // Post-Incident Review
    postIncidentReview: jsonb('post_incident_review').$type<{
      scheduled?: boolean;
      conductedAt?: string;
      attendees?: string[];
      findings?: {
        whatWentWell?: string[];
        whatWentWrong?: string[];
        improvements?: string[];
      };
      actionItems?: Array<{
        description: string;
        assignee: string;
        dueDate: string;
        status: 'open' | 'in-progress' | 'completed';
      }>;
      documentation?: {
        runbookUpdates?: string[];
        processImprovements?: string[];
        toolingChanges?: string[];
      };
    }>(),
    
    // Relationships
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    reportedBy: uuid('reported_by').notNull().references(() => users.id),
    assignedTo: uuid('assigned_to').references(() => users.id),
    
    // Timestamps
    reportedAt: timestamp('reported_at').defaultNow().notNull(),
    acknowledgedAt: timestamp('acknowledged_at'),
    resolvedAt: timestamp('resolved_at'),
    closedAt: timestamp('closed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
);

// 索引定义
export const incidentsIndexes = {
  projectIdIdx: index('incidents_project_id_idx').on(incidents.projectId),
  severityIdx: index('incidents_severity_idx').on(incidents.severity),
  statusIdx: index('incidents_status_idx').on(incidents.status),
  reportedByIdx: index('incidents_reported_by_idx').on(incidents.reportedBy),
  assignedToIdx: index('incidents_assigned_to_idx').on(incidents.assignedTo),
  categoryIdx: index('incidents_category_idx').on(incidents.category),
  reportedAtIdx: index('incidents_reported_at_idx').on(incidents.reportedAt),
};

// Zod schemas for validation
export const insertIncidentSchema = createInsertSchema(incidents, {
  title: z.string().min(1).max(200),
});

export const selectIncidentSchema = createSelectSchema(incidents);

export const updateIncidentSchema = insertIncidentSchema.partial().omit({
  id: true,
  reportedBy: true,
  createdAt: true,
});

export const incidentPublicSchema = selectIncidentSchema.pick({
  id: true,
  title: true,
  description: true,
  severity: true,
  priority: true,
  status: true,
  category: true,
  subcategory: true,
  impact: true,
  metrics: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
});

export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
export type UpdateIncident = z.infer<typeof updateIncidentSchema>;
export type IncidentPublic = z.infer<typeof incidentPublicSchema>;