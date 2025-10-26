import { z } from 'zod';
import { publicProcedure, router } from '../../trpc/trpc';
import { IncidentsService } from './incidents.service';
import { 
  insertIncidentSchema,
  selectIncidentSchema,
  updateIncidentSchema,
  IncidentSeverityEnum,
  IncidentPriorityEnum,
  IncidentStatusEnum,
  IncidentCategoryEnum
} from '../../database/schemas/incidents.schema';

// 输入验证 schemas
const createIncidentSchema = insertIncidentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  acknowledgedAt: true,
  resolvedAt: true,
  closedAt: true
});

const getIncidentsByProjectSchema = z.object({
  projectId: z.string().uuid(),
  status: z.enum(['open', 'investigating', 'resolved', 'closed']).optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
  category: z.enum(['infrastructure', 'application', 'security', 'performance']).optional(),
  assignedTo: z.string().uuid().optional(),
  reportedBy: z.string().uuid().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
  sortBy: z.enum(['reportedAt', 'severity', 'priority', 'status']).default('reportedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

const batchUpdateStatusSchema = z.object({
  incidentIds: z.array(z.string().uuid()).min(1),
  status: z.enum(['open', 'investigating', 'resolved', 'closed']),
  assignedTo: z.string().uuid().optional()
});

const acknowledgeIncidentSchema = z.object({
  id: z.string().uuid(),
  assignedTo: z.string().uuid().optional()
});

const resolveIncidentSchema = z.object({
  id: z.string().uuid(),
  resolutionData: z.object({
    resolutionMitigation: z.any().optional(),
    rootCauseAnalysis: z.any().optional()
  }).optional()
});

const closeIncidentSchema = z.object({
  id: z.string().uuid(),
  postIncidentReview: z.any().optional()
});

const assignIncidentSchema = z.object({
  id: z.string().uuid(),
  assignedTo: z.string().uuid()
});

const updateSeveritySchema = z.object({
  id: z.string().uuid(),
  severity: z.enum(['critical', 'high', 'medium', 'low'])
});

const updatePrioritySchema = z.object({
  id: z.string().uuid(),
  priority: z.enum(['urgent', 'high', 'medium', 'low'])
});

const addCommunicationUpdateSchema = z.object({
  id: z.string().uuid(),
  update: z.object({
    type: z.enum(['status-page', 'internal', 'customer']),
    message: z.string().min(1),
    author: z.string().uuid(),
    audience: z.string().optional(),
    channel: z.string().optional(),
    recipients: z.number().optional()
  })
});

const getStatisticsSchema = z.object({
  projectId: z.string().uuid().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional()
});

// 输出 schemas
const incidentListResponseSchema = z.object({
  incidents: z.array(selectIncidentSchema),
  total: z.number()
});

const incidentStatisticsSchema = z.object({
  total: z.number(),
  byStatus: z.record(z.enum(['open', 'investigating', 'resolved', 'closed']), z.number()),
  bySeverity: z.record(z.enum(['critical', 'high', 'medium', 'low']), z.number()),
  byCategory: z.record(z.enum(['infrastructure', 'application', 'security', 'performance']), z.number()),
  avgResolutionTime: z.number(),
  slaCompliance: z.number(),
  trendsOverTime: z.array(z.object({
    date: z.string(),
    count: z.number(),
    resolved: z.number()
  }))
});

const aiRecommendationsSchema = z.object({
  recommendations: z.array(z.object({
    type: z.enum(['diagnosis', 'mitigation', 'prevention']),
    confidence: z.number().min(0).max(1),
    suggestion: z.string(),
    reasoning: z.string()
  })),
  similarIncidents: z.array(z.object({
    id: z.string().uuid(),
    similarity: z.number().min(0).max(1),
    resolution: z.string()
  })),
  knowledgeBase: z.object({
    articles: z.array(z.string()),
    runbooks: z.array(z.string()),
    procedures: z.array(z.string())
  })
});

export const incidentsRouter = router({
  // 创建事件
  create: publicProcedure
    .input(createIncidentSchema)
    .output(selectIncidentSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new IncidentsService(ctx.db);
      return service.createIncident(input);
    }),

  // 根据ID获取事件
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(selectIncidentSchema.nullable())
    .query(async ({ input, ctx }) => {
      const service = new IncidentsService(ctx.db);
      return service.getIncidentById(input.id);
    }),

  // 获取项目的事件列表
  getByProject: publicProcedure
    .input(getIncidentsByProjectSchema)
    .output(incidentListResponseSchema)
    .query(async ({ input, ctx }) => {
      const service = new IncidentsService(ctx.db);
      const { projectId, ...options } = input;
      return service.getIncidentsByProject(projectId, options);
    }),

  // 更新事件
  update: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: updateIncidentSchema
    }))
    .output(selectIncidentSchema.nullable())
    .mutation(async ({ input, ctx }) => {
      const service = new IncidentsService(ctx.db);
      return service.updateIncident(input.id, input.data);
    }),

  // 确认事件
  acknowledge: publicProcedure
    .input(acknowledgeIncidentSchema)
    .output(selectIncidentSchema.nullable())
    .mutation(async ({ input, ctx }) => {
      const service = new IncidentsService(ctx.db);
      return service.acknowledgeIncident(input.id, input.assignedTo);
    }),

  // 解决事件
  resolve: publicProcedure
    .input(resolveIncidentSchema)
    .output(selectIncidentSchema.nullable())
    .mutation(async ({ input, ctx }) => {
      const service = new IncidentsService(ctx.db);
      return service.resolveIncident(input.id, input.resolutionData);
    }),

  // 关闭事件
  close: publicProcedure
    .input(closeIncidentSchema)
    .output(selectIncidentSchema.nullable())
    .mutation(async ({ input, ctx }) => {
      const service = new IncidentsService(ctx.db);
      return service.closeIncident(input.id, input.postIncidentReview);
    }),

  // 重新打开事件
  reopen: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(selectIncidentSchema.nullable())
    .mutation(async ({ input, ctx }) => {
      const service = new IncidentsService(ctx.db);
      return service.reopenIncident(input.id);
    }),

  // 分配事件
  assign: publicProcedure
    .input(assignIncidentSchema)
    .output(selectIncidentSchema.nullable())
    .mutation(async ({ input, ctx }) => {
      const service = new IncidentsService(ctx.db);
      return service.assignIncident(input.id, input.assignedTo);
    }),

  // 更新事件严重级别
  updateSeverity: publicProcedure
    .input(updateSeveritySchema)
    .output(selectIncidentSchema.nullable())
    .mutation(async ({ input, ctx }) => {
      const service = new IncidentsService(ctx.db);
      return service.updateSeverity(input.id, input.severity);
    }),

  // 更新事件优先级
  updatePriority: publicProcedure
    .input(updatePrioritySchema)
    .output(selectIncidentSchema.nullable())
    .mutation(async ({ input, ctx }) => {
      const service = new IncidentsService(ctx.db);
      return service.updatePriority(input.id, input.priority);
    }),

  // 添加沟通更新
  addCommunicationUpdate: publicProcedure
    .input(addCommunicationUpdateSchema)
    .output(selectIncidentSchema.nullable())
    .mutation(async ({ input, ctx }) => {
      const service = new IncidentsService(ctx.db);
      return service.addCommunicationUpdate(input.id, input.update);
    }),

  // 获取事件统计信息
  getStatistics: publicProcedure
    .input(getStatisticsSchema)
    .output(incidentStatisticsSchema)
    .query(async ({ input, ctx }) => {
      const service = new IncidentsService(ctx.db);
      return service.getIncidentStatistics(
        input.projectId,
        input.dateFrom,
        input.dateTo
      );
    }),

  // 批量更新事件状态
  batchUpdateStatus: publicProcedure
    .input(batchUpdateStatusSchema)
    .output(z.object({ updatedCount: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const service = new IncidentsService(ctx.db);
      const updatedCount = await service.batchUpdateStatus(
        input.incidentIds,
        input.status,
        input.assignedTo
      );
      return { updatedCount };
    }),

  // 删除事件
  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const service = new IncidentsService(ctx.db);
      const success = await service.deleteIncident(input.id);
      return { success };
    }),

  // 批量删除事件
  batchDelete: publicProcedure
    .input(z.object({ incidentIds: z.array(z.string().uuid()).min(1) }))
    .output(z.object({ deletedCount: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const service = new IncidentsService(ctx.db);
      const deletedCount = await service.batchDeleteIncidents(input.incidentIds);
      return { deletedCount };
    }),

  // 获取相似事件
  getSimilarIncidents: publicProcedure
    .input(z.object({
      incidentId: z.string().uuid(),
      limit: z.number().min(1).max(50).default(10)
    }))
    .output(z.array(selectIncidentSchema))
    .query(async ({ input, ctx }) => {
      const service = new IncidentsService(ctx.db);
      return service.getSimilarIncidents(input.incidentId, input.limit);
    }),

  // AI 辅助诊断
  getAIRecommendations: publicProcedure
    .input(z.object({ incidentId: z.string().uuid() }))
    .output(aiRecommendationsSchema)
    .query(async ({ input, ctx }) => {
      const service = new IncidentsService(ctx.db);
      return service.getAIRecommendations(input.incidentId);
    })
});

export type IncidentsRouter = typeof incidentsRouter;