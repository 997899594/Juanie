import { z } from 'zod';
import { publicProcedure, router } from '../../trpc/trpc';
import { IntelligentAlertsService } from './intelligent-alerts.service';
import { 
  insertIntelligentAlertSchema,
  selectIntelligentAlertSchema,
  AlertType,
  AlertSeverity,
  AlertStatus,
  RootCauseCategory,
  RemediationActionType
} from '../../database/schemas/intelligent-alerts.schema';

// 输入验证 schemas
const createAlertSchema = insertIntelligentAlertSchema.omit({
  id: true,
  createdAt: true,
  acknowledgedAt: true,
  resolvedAt: true,
  escalatedAt: true,
  firstNotificationSentAt: true
});

const updateAlertSchema = insertIntelligentAlertSchema.partial().omit({
  id: true,
  createdAt: true
});

const getAlertsByProjectSchema = z.object({
  projectId: z.string().uuid(),
  status: z.enum(['active', 'acknowledged', 'resolved', 'suppressed']).optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
  alertType: z.enum(['threshold', 'anomaly', 'predictive', 'composite', 'correlation']).optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
  sortBy: z.enum(['createdAt', 'severity', 'aiConfidence']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

const batchUpdateStatusSchema = z.object({
  alertIds: z.array(z.string().uuid()).min(1),
  status: z.enum(['active', 'acknowledged', 'resolved', 'suppressed']),
  acknowledgedBy: z.string().uuid().optional()
});

const acknowledgeAlertSchema = z.object({
  id: z.string().uuid(),
  acknowledgedBy: z.string().uuid()
});

const resolveAlertSchema = z.object({
  id: z.string().uuid(),
  resolutionNotes: z.string().optional()
});

const generatePredictiveAlertSchema = z.object({
  monitorConfigId: z.string().uuid(),
  predictionHorizon: z.number().min(1).max(168) // 1 hour to 1 week
});

// 输出 schemas
const alertListResponseSchema = z.object({
  alerts: z.array(selectIntelligentAlertSchema),
  total: z.number()
});

const alertStatisticsSchema = z.object({
  total: z.number(),
  byStatus: z.record(z.enum(['active', 'acknowledged', 'resolved', 'suppressed']), z.number()),
  bySeverity: z.record(z.enum(['critical', 'high', 'medium', 'low', 'info']), z.number()),
  byType: z.record(z.enum(['threshold', 'anomaly', 'predictive', 'composite', 'correlation']), z.number()),
  avgResolutionTime: z.number(),
  autoRemediationRate: z.number()
});

const rootCauseAnalysisSchema = z.object({
  category: z.enum(['infrastructure', 'application', 'network', 'security', 'data', 'external']),
  component: z.string(),
  description: z.string(),
  confidence: z.number().min(0).max(1),
  suggestedActions: z.array(z.string())
});

export const intelligentAlertsRouter = router({
  // 创建告警
  create: publicProcedure
    .input(createAlertSchema)
    .output(selectIntelligentAlertSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new IntelligentAlertsService(ctx.db);
      return service.createAlert(input);
    }),

  // 根据ID获取告警
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(selectIntelligentAlertSchema.nullable())
    .query(async ({ input, ctx }) => {
      const service = new IntelligentAlertsService(ctx.db);
      return service.getAlertById(input.id);
    }),

  // 获取项目的告警列表
  getByProject: publicProcedure
    .input(getAlertsByProjectSchema)
    .output(alertListResponseSchema)
    .query(async ({ input, ctx }) => {
      const service = new IntelligentAlertsService(ctx.db);
      const { projectId, ...options } = input;
      return service.getAlertsByProject(projectId, options);
    }),

  // 更新告警
  update: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: updateAlertSchema
    }))
    .output(selectIntelligentAlertSchema.nullable())
    .mutation(async ({ input, ctx }) => {
      const service = new IntelligentAlertsService(ctx.db);
      return service.updateAlert(input.id, input.data);
    }),

  // 确认告警
  acknowledge: publicProcedure
    .input(acknowledgeAlertSchema)
    .output(selectIntelligentAlertSchema.nullable())
    .mutation(async ({ input, ctx }) => {
      const service = new IntelligentAlertsService(ctx.db);
      return service.acknowledgeAlert(input.id, input.acknowledgedBy);
    }),

  // 解决告警
  resolve: publicProcedure
    .input(resolveAlertSchema)
    .output(selectIntelligentAlertSchema.nullable())
    .mutation(async ({ input, ctx }) => {
      const service = new IntelligentAlertsService(ctx.db);
      return service.resolveAlert(input.id, input.resolutionNotes);
    }),

  // 升级告警
  escalate: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(selectIntelligentAlertSchema.nullable())
    .mutation(async ({ input, ctx }) => {
      const service = new IntelligentAlertsService(ctx.db);
      return service.escalateAlert(input.id);
    }),

  // 应用自动修复
  applyAutoRemediation: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(selectIntelligentAlertSchema.nullable())
    .mutation(async ({ input, ctx }) => {
      const service = new IntelligentAlertsService(ctx.db);
      return service.applyAutoRemediation(input.id);
    }),

  // 获取告警统计信息
  getStatistics: publicProcedure
    .input(z.object({ projectId: z.string().uuid().optional() }))
    .output(alertStatisticsSchema)
    .query(async ({ input, ctx }) => {
      const service = new IntelligentAlertsService(ctx.db);
      return service.getAlertStatistics(input.projectId);
    }),

  // 批量更新告警状态
  batchUpdateStatus: publicProcedure
    .input(batchUpdateStatusSchema)
    .output(z.object({ updatedCount: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const service = new IntelligentAlertsService(ctx.db);
      const updatedCount = await service.batchUpdateStatus(
        input.alertIds,
        input.status,
        input.acknowledgedBy
      );
      return { updatedCount };
    }),

  // 删除告警
  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const service = new IntelligentAlertsService(ctx.db);
      const success = await service.deleteAlert(input.id);
      return { success };
    }),

  // 批量删除告警
  batchDelete: publicProcedure
    .input(z.object({ alertIds: z.array(z.string().uuid()).min(1) }))
    .output(z.object({ deletedCount: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const service = new IntelligentAlertsService(ctx.db);
      const deletedCount = await service.batchDeleteAlerts(input.alertIds);
      return { deletedCount };
    }),

  // 获取相关告警
  getRelatedAlerts: publicProcedure
    .input(z.object({
      alertId: z.string().uuid(),
      limit: z.number().min(1).max(50).default(10)
    }))
    .output(z.array(selectIntelligentAlertSchema))
    .query(async ({ input, ctx }) => {
      const service = new IntelligentAlertsService(ctx.db);
      return service.getRelatedAlerts(input.alertId, input.limit);
    }),

  // AI 根因分析
  performRootCauseAnalysis: publicProcedure
    .input(z.object({ alertId: z.string().uuid() }))
    .output(rootCauseAnalysisSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new IntelligentAlertsService(ctx.db);
      return service.performRootCauseAnalysis(input.alertId);
    }),

  // 生成预测性告警
  generatePredictiveAlert: publicProcedure
    .input(generatePredictiveAlertSchema)
    .output(selectIntelligentAlertSchema.nullable())
    .mutation(async ({ input, ctx }) => {
      const service = new IntelligentAlertsService(ctx.db);
      return service.generatePredictiveAlert(
        input.monitorConfigId,
        input.predictionHorizon
      );
    })
});

export type IntelligentAlertsRouter = typeof intelligentAlertsRouter;