import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '../../trpc/trpc.service';
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

// 响应 schemas
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

@Injectable()
export class IncidentsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly incidentsService: IncidentsService,
  ) {}

  public get incidentsRouter() {
    return this.trpc.router({
      // 创建事件
      create: this.trpc.publicProcedure
        .input(createIncidentSchema)
        .output(selectIncidentSchema)
        .mutation(async ({ input }) => {
          return this.incidentsService.createIncident(input);
        }),

      // 根据ID获取事件
      getById: this.trpc.publicProcedure
        .input(z.object({ id: z.string().uuid() }))
        .output(selectIncidentSchema.nullable())
        .query(async ({ input }) => {
          return this.incidentsService.getIncidentById(input.id);
        }),

      // 根据项目获取事件列表
      getByProject: this.trpc.publicProcedure
        .input(getIncidentsByProjectSchema)
        .output(incidentListResponseSchema)
        .query(async ({ input }) => {
          return this.incidentsService.getIncidentsByProject(input.projectId, input);
        }),

      // 更新事件
      update: this.trpc.publicProcedure
        .input(z.object({
          id: z.string().uuid(),
          data: updateIncidentSchema
        }))
        .output(selectIncidentSchema.nullable())
        .mutation(async ({ input }) => {
          return this.incidentsService.updateIncident(input.id, input.data);
        }),

      // 确认事件
      acknowledge: this.trpc.publicProcedure
        .input(acknowledgeIncidentSchema)
        .output(selectIncidentSchema.nullable())
        .mutation(async ({ input }) => {
          return this.incidentsService.acknowledgeIncident(input.id, input.assignedTo);
        }),

      // 解决事件
      resolve: this.trpc.publicProcedure
        .input(resolveIncidentSchema)
        .output(selectIncidentSchema.nullable())
        .mutation(async ({ input }) => {
          return this.incidentsService.resolveIncident(input.id, input.resolutionData);
        }),

      // 关闭事件
      close: this.trpc.publicProcedure
        .input(closeIncidentSchema)
        .output(selectIncidentSchema.nullable())
        .mutation(async ({ input }) => {
          return this.incidentsService.closeIncident(input.id, input.postIncidentReview);
        }),

      // 重新打开事件
      reopen: this.trpc.publicProcedure
        .input(z.object({ id: z.string().uuid() }))
        .output(selectIncidentSchema.nullable())
        .mutation(async ({ input }) => {
          return this.incidentsService.reopenIncident(input.id);
        }),

      // 分配事件
      assign: this.trpc.publicProcedure
        .input(assignIncidentSchema)
        .output(selectIncidentSchema.nullable())
        .mutation(async ({ input }) => {
          return this.incidentsService.assignIncident(input.id, input.assignedTo);
        }),

      // 更新严重程度
      updateSeverity: this.trpc.publicProcedure
        .input(updateSeveritySchema)
        .output(selectIncidentSchema.nullable())
        .mutation(async ({ input }) => {
          return this.incidentsService.updateSeverity(input.id, input.severity);
        }),

      // 更新优先级
      updatePriority: this.trpc.publicProcedure
        .input(updatePrioritySchema)
        .output(selectIncidentSchema.nullable())
        .mutation(async ({ input }) => {
          return this.incidentsService.updatePriority(input.id, input.priority);
        }),

      // 添加沟通更新
      addCommunicationUpdate: this.trpc.publicProcedure
        .input(addCommunicationUpdateSchema)
        .output(selectIncidentSchema.nullable())
        .mutation(async ({ input }) => {
          return this.incidentsService.addCommunicationUpdate(input.id, input.update);
        }),

      // 获取统计信息
      getStatistics: this.trpc.publicProcedure
        .input(getStatisticsSchema)
        .output(incidentStatisticsSchema)
        .query(async ({ input }) => {
          return this.incidentsService.getIncidentStatistics(
            input.projectId,
            input.dateFrom,
            input.dateTo
          );
        }),

      // 批量更新状态
      batchUpdateStatus: this.trpc.publicProcedure
        .input(batchUpdateStatusSchema)
        .output(z.object({ updatedCount: z.number() }))
        .mutation(async ({ input }) => {
          const updatedCount = await this.incidentsService.batchUpdateStatus(
            input.incidentIds,
            input.status,
            input.assignedTo
          );
          return { updatedCount };
        }),

      // 删除事件
      delete: this.trpc.publicProcedure
        .input(z.object({ id: z.string().uuid() }))
        .output(z.object({ success: z.boolean() }))
        .mutation(async ({ input }) => {
          const success = await this.incidentsService.deleteIncident(input.id);
          return { success };
        }),

      // 批量删除事件
      batchDelete: this.trpc.publicProcedure
        .input(z.object({ incidentIds: z.array(z.string().uuid()).min(1) }))
        .output(z.object({ deletedCount: z.number() }))
        .mutation(async ({ input }) => {
          const deletedCount = await this.incidentsService.batchDeleteIncidents(input.incidentIds);
          return { deletedCount };
        }),

      // 获取相似事件
      getSimilarIncidents: this.trpc.publicProcedure
        .input(z.object({
          incidentId: z.string().uuid(),
          limit: z.number().min(1).max(50).default(10)
        }))
        .output(z.array(selectIncidentSchema))
        .query(async ({ input }) => {
          return this.incidentsService.getSimilarIncidents(input.incidentId, input.limit);
        }),

      // 获取AI推荐
      getAIRecommendations: this.trpc.publicProcedure
        .input(z.object({ incidentId: z.string().uuid() }))
        .output(aiRecommendationsSchema)
        .query(async ({ input }) => {
          return this.incidentsService.getAIRecommendations(input.incidentId);
        })
    });
  }
}
