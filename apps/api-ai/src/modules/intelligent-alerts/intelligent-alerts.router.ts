import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  AlertSeverityEnum,
  AlertStatusEnum,
  AlertTypeEnum,
  insertIntelligentAlertSchema,
  RootCauseCategoryEnum,
  selectIntelligentAlertSchema,
} from "../../database/schemas/intelligent-alerts.schema";
import { TrpcService } from "../../trpc/trpc.service";
import { IntelligentAlertsService } from "./intelligent-alerts.service";

// 输入验证 schemas
const createAlertSchema = insertIntelligentAlertSchema.omit({
  id: true,
  createdAt: true,
  acknowledgedAt: true,
  resolvedAt: true,
  escalatedAt: true,
  firstNotificationSentAt: true,
});

const updateAlertSchema = insertIntelligentAlertSchema.partial().omit({});

const getAlertsByProjectSchema = z.object({
  projectId: z.string().uuid(),
  status: z.enum(["open", "acknowledged", "resolved", "suppressed"]).optional(),
  severity: z.enum(["info", "warning", "critical"]).optional(),
  alertType: z
    .enum(["anomaly", "threshold", "prediction", "correlation"])
    .optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
  sortBy: z
    .enum(["createdAt", "severity", "aiConfidence"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const batchUpdateStatusSchema = z.object({
  alertIds: z.array(z.string().uuid()).min(1),
  status: z.enum(["open", "acknowledged", "resolved", "suppressed"]),
  acknowledgedBy: z.string().uuid().optional(),
});

const acknowledgeAlertSchema = z.object({
  id: z.string().uuid(),
  acknowledgedBy: z.string().uuid(),
});

const resolveAlertSchema = z.object({
  id: z.string().uuid(),
  resolutionNotes: z.string().optional(),
});

const generatePredictiveAlertSchema = z.object({
  monitorConfigId: z.string().uuid(),
  predictionHorizon: z.number().min(1).max(168), // 1 hour to 1 week
});

// 响应 schemas
const alertListResponseSchema = z.object({
  alerts: z.array(selectIntelligentAlertSchema),
  total: z.number(),
});

const alertStatisticsSchema = z.object({
  total: z.number(),
  byStatus: z.record(
    z.enum(["open", "acknowledged", "resolved", "suppressed"]),
    z.number()
  ),
  bySeverity: z.record(z.enum(["info", "warning", "critical"]), z.number()),
  byType: z.record(
    z.enum(["anomaly", "threshold", "prediction", "correlation"]),
    z.number()
  ),
  avgResolutionTime: z.number(),
  autoRemediationRate: z.number(),
});

const rootCauseAnalysisSchema = z.object({
  category: z.enum([
    "performance",
    "availability",
    "security",
    "capacity",
    "configuration",
  ]),
  component: z.string(),
  description: z.string(),
  confidence: z.number().min(0).max(1),
  suggestedActions: z.array(z.string()),
});

@Injectable()
export class IntelligentAlertsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly intelligentAlertsService: IntelligentAlertsService
  ) {}

  public get intelligentAlertsRouter() {
    return this.trpc.router({
      // 创建智能告警 - 需要认证
      create: this.trpc.protectedProcedure
        .input(createAlertSchema)
        .output(selectIntelligentAlertSchema)
        .mutation(async ({ input }) => {
          return this.intelligentAlertsService.createAlert(input);
        }),

      // 根据ID获取智能告警 - 需要认证
      getById: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .output(selectIntelligentAlertSchema.nullable())
        .query(async ({ input }) => {
          return this.intelligentAlertsService.getAlertById(input.id);
        }),

      // 根据项目获取智能告警列表 - 需要认证
      getByProject: this.trpc.protectedProcedure
        .input(getAlertsByProjectSchema)
        .output(alertListResponseSchema)
        .query(async ({ input }) => {
          return this.intelligentAlertsService.getAlertsByProject(
            input.projectId,
            {
              status: input.status,
              severity: input.severity,
              alertType: input.alertType,
              limit: input.limit,
              offset: input.offset,
              sortBy: input.sortBy,
              sortOrder: input.sortOrder,
            }
          );
        }),

      // 更新智能告警 - 需要认证
      update: this.trpc.protectedProcedure
        .input(
          z.object({
            id: z.string().uuid(),
            data: updateAlertSchema,
          })
        )
        .output(selectIntelligentAlertSchema.nullable())
        .mutation(async ({ input }) => {
          return this.intelligentAlertsService.updateAlert(
            input.id,
            input.data
          );
        }),

      // 确认告警 - 需要认证
      acknowledge: this.trpc.protectedProcedure
        .input(acknowledgeAlertSchema)
        .output(selectIntelligentAlertSchema.nullable())
        .mutation(async ({ input }) => {
          return this.intelligentAlertsService.acknowledgeAlert(
            input.id,
            input.acknowledgedBy
          );
        }),

      // 解决告警 - 需要认证
      resolve: this.trpc.protectedProcedure
        .input(resolveAlertSchema)
        .output(selectIntelligentAlertSchema.nullable())
        .mutation(async ({ input }) => {
          return this.intelligentAlertsService.resolveAlert(
            input.id,
            input.resolutionNotes
          );
        }),

      // 升级告警 - 需要认证
      escalate: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .output(selectIntelligentAlertSchema.nullable())
        .mutation(async ({ input }) => {
          return this.intelligentAlertsService.escalateAlert(input.id);
        }),

      // 应用自动修复 - 需要认证
      applyAutoRemediation: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .output(selectIntelligentAlertSchema.nullable())
        .mutation(async ({ input }) => {
          return this.intelligentAlertsService.applyAutoRemediation(input.id);
        }),

      // 获取告警统计信息 - 需要认证
      getStatistics: this.trpc.protectedProcedure
        .input(z.object({ projectId: z.string().uuid().optional() }))
        .output(alertStatisticsSchema)
        .query(async ({ input }) => {
          return this.intelligentAlertsService.getAlertStatistics(
            input.projectId
          );
        }),

      // 批量更新告警状态 - 需要认证
      batchUpdateStatus: this.trpc.protectedProcedure
        .input(batchUpdateStatusSchema)
        .output(z.object({ updatedCount: z.number() }))
        .mutation(async ({ input }) => {
          const updatedCount =
            await this.intelligentAlertsService.batchUpdateStatus(
              input.alertIds,
              input.status,
              input.acknowledgedBy
            );
          return { updatedCount };
        }),

      // 删除告警 - 需要认证
      delete: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .output(z.object({ success: z.boolean() }))
        .mutation(async ({ input }) => {
          await this.intelligentAlertsService.deleteAlert(input.id);
          return { success: true };
        }),

      // 批量删除告警 - 需要认证
      batchDelete: this.trpc.protectedProcedure
        .input(z.object({ alertIds: z.array(z.string().uuid()).min(1) }))
        .output(z.object({ deletedCount: z.number() }))
        .mutation(async ({ input }) => {
          const deletedCount =
            await this.intelligentAlertsService.batchDeleteAlerts(
              input.alertIds
            );
          return { deletedCount };
        }),

      // 获取相关告警 - 需要认证
      getRelatedAlerts: this.trpc.protectedProcedure
        .input(
          z.object({
            alertId: z.string().uuid(),
            limit: z.number().min(1).max(50).default(10),
          })
        )
        .output(z.array(selectIntelligentAlertSchema))
        .query(async ({ input }) => {
          return this.intelligentAlertsService.getRelatedAlerts(
            input.alertId,
            input.limit
          );
        }),

      // 执行根因分析 - 需要认证
      performRootCauseAnalysis: this.trpc.protectedProcedure
        .input(z.object({ alertId: z.string().uuid() }))
        .output(rootCauseAnalysisSchema)
        .mutation(async ({ input }) => {
          return this.intelligentAlertsService.performRootCauseAnalysis(
            input.alertId
          );
        }),

      // 生成预测性告警 - 需要认证
      generatePredictiveAlert: this.trpc.protectedProcedure
        .input(generatePredictiveAlertSchema)
        .output(selectIntelligentAlertSchema.nullable())
        .mutation(async ({ input }) => {
          return this.intelligentAlertsService.generatePredictiveAlert(
            input.monitorConfigId,
            input.predictionHorizon
          );
        }),
    });
  }
}

export type IntelligentAlertsRouterType = typeof IntelligentAlertsRouter;
