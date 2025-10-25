import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, integer, index, foreignKey, pgEnum } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './users.schema';
import { projects } from './projects.schema';

// 事件严重级别枚举（critical/高、high/较高、medium/中、low/低）
export const IncidentSeverityEnum = ['critical', 'high', 'medium', 'low'] as const;
export const IncidentSeverityPgEnum = pgEnum('incident_severity', IncidentSeverityEnum);

// 事件优先级枚举（urgent/紧急、high/高、medium/中、low/低）
export const IncidentPriorityEnum = ['urgent', 'high', 'medium', 'low'] as const;
export const IncidentPriorityPgEnum = pgEnum('incident_priority', IncidentPriorityEnum);

// 事件状态枚举（open/打开、investigating/排查中、resolved/已解决、closed/已关闭）
export const IncidentStatusEnum = ['open', 'investigating', 'resolved', 'closed'] as const;
export const IncidentStatusPgEnum = pgEnum('incident_status', IncidentStatusEnum);

// 事件分类枚举（infrastructure/基础设施、application/应用、security/安全、performance/性能）
export const IncidentCategoryEnum = ['infrastructure', 'application', 'security', 'performance'] as const;
export const IncidentCategoryPgEnum = pgEnum('incident_category', IncidentCategoryEnum);

export const incidents = pgTable(
  'incidents',
  {
    id: uuid('id').primaryKey().defaultRandom(), // 事件ID，主键
    
    // Basic Information
    title: varchar('title', { length: 200 }).notNull(), // 事件标题
    description: text('description').notNull(), // 事件描述
    
    // Classification
    severity: IncidentSeverityPgEnum('severity').notNull(), // 严重级别
    priority: IncidentPriorityPgEnum('priority').notNull(), // 优先级
    status: IncidentStatusPgEnum('status').notNull().default('open'), // 事件状态
    category: IncidentCategoryPgEnum('category').notNull(), // 事件分类
    subcategory: varchar('subcategory', { length: 50 }), // 二级分类
    
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
    }>(), // 影响评估（JSON）
    
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
    }>(), // 监测与响应（JSON）
    
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
    }>(), // 技术细节（JSON）
    
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
    }>(), // 根因分析（JSON）
    
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
    }>(), // 处置与缓解措施（JSON）
    
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
    }>(), // 对外与内部沟通更新（JSON）
    
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
    }>(), // AI辅助响应（JSON）
    
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
    }>(), // 指标与SLA（JSON）
    
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
    }>(), // 事后复盘（JSON）
    
    // Relationships
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }), // 项目ID（外键，级联删除）
    reportedBy: uuid('reported_by').notNull().references(() => users.id), // 上报人用户ID（外键）
    assignedTo: uuid('assigned_to').references(() => users.id), // 处理人用户ID（外键，可为空）
    
    // Timestamps
    reportedAt: timestamp('reported_at').defaultNow().notNull(), // 事件上报时间
    acknowledgedAt: timestamp('acknowledged_at'), // 事件被确认时间
    resolvedAt: timestamp('resolved_at'), // 事件解决时间
    closedAt: timestamp('closed_at'), // 事件关闭时间
    createdAt: timestamp('created_at').defaultNow().notNull(), // 创建时间
    updatedAt: timestamp('updated_at').defaultNow().notNull(), // 更新时间
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

export const updateIncidentSchema = selectIncidentSchema.pick({
  title: true,
  description: true,
  severity: true,
  priority: true,
  status: true,
  category: true,
  subcategory: true,
  impactAssessment: true,
  detectionResponse: true,
  technicalDetails: true,
  rootCauseAnalysis: true,
  resolutionMitigation: true,
  communicationUpdates: true,
  aiAssistedResponse: true,
  metricsSla: true,
  postIncidentReview: true,
  projectId: true,
  reportedBy: true,
  assignedTo: true,
  reportedAt: true,
  acknowledgedAt: true,
  resolvedAt: true,
  closedAt: true,
}).partial();

export const incidentPublicSchema = selectIncidentSchema.pick({
  id: true,
  title: true,
  description: true,
  severity: true,
  priority: true,
  status: true,
  category: true,
  subcategory: true,
  impactAssessment: true,
  metricsSla: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
});

export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
export type UpdateIncident = z.infer<typeof updateIncidentSchema>;
export type IncidentPublic = z.infer<typeof incidentPublicSchema>;