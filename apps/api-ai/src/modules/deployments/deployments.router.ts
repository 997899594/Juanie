import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '../../trpc/trpc.service';
import { DeploymentsService } from './deployments.service';
import { 
  insertDeploymentSchema, 
  updateDeploymentSchema,
  selectDeploymentSchema,
  DeploymentStatusEnum,
  DeploymentStrategyEnum,
  RollbackStrategyEnum
} from '../../database/schemas/deployments.schema';

// 输入验证schemas
const getDeploymentByIdSchema = z.object({
  id: z.string().uuid(),
});

const getDeploymentsByProjectSchema = z.object({
  projectId: z.string().uuid(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(20),
  status: DeploymentStatusEnum.optional(),
  environmentId: z.string().uuid().optional(),
  deployedBy: z.string().uuid().optional(),
  branch: z.string().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
});

const getDeploymentsByEnvironmentSchema = z.object({
  environmentId: z.string().uuid(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(20),
  status: DeploymentStatusEnum.optional(),
  deployedBy: z.string().uuid().optional(),
  branch: z.string().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
});

const updateDeploymentParamsSchema = z.object({
  id: z.string().uuid(),
  data: updateDeploymentSchema,
});

const startDeploymentSchema = z.object({
  id: z.string().uuid(),
});

const finishDeploymentSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['success', 'failed', 'cancelled']),
  metrics: z.object({
    avgResponseTime: z.number().int().positive().optional(),
    throughputRps: z.number().int().positive().optional(),
    availability: z.number().min(0).max(100).optional(),
    errorRate: z.number().min(0).max(1).optional(),
    responseTimeP95: z.number().int().positive().optional(),
    cpuUsageAvg: z.number().min(0).max(100).optional(),
    memoryUsageAvg: z.number().min(0).max(100).optional(),
    diskUsageGb: z.number().positive().optional(),
    deploymentCost: z.number().positive().optional(),
  }).optional(),
});

const rollbackDeploymentSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(1),
  rollbackDuration: z.number().int().positive().optional(),
});

const cancelDeploymentSchema = z.object({
  id: z.string().uuid(),
});

const getDeploymentStatsSchema = z.object({
  projectId: z.string().uuid().optional(),
  environmentId: z.string().uuid().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
});

const batchUpdateDeploymentStatusSchema = z.object({
  deploymentIds: z.array(z.string().uuid()),
  status: DeploymentStatusEnum,
});

const deleteDeploymentSchema = z.object({
  id: z.string().uuid(),
});

const batchDeleteDeploymentsSchema = z.object({
  deploymentIds: z.array(z.string().uuid()),
});

const getRecentDeploymentsSchema = z.object({
  projectId: z.string().uuid(),
  limit: z.number().int().positive().max(50).optional().default(10),
});

const getActiveDeploymentsSchema = z.object({
  projectId: z.string().uuid().optional(),
});

const assessDeploymentRiskSchema = z.object({
  projectId: z.string().uuid(),
  environmentId: z.string().uuid(),
  commitHash: z.string().min(1),
  branch: z.string().min(1),
});

const predictDeploymentPerformanceSchema = z.object({
  projectId: z.string().uuid(),
  environmentId: z.string().uuid(),
});

const getEnvironmentUsageSchema = z.object({
  environmentId: z.string().uuid(),
});

// 响应schemas
const deploymentWithDetailsSchema = selectDeploymentSchema.extend({
  project: z.object({
    name: z.string(),
  }).optional(),
  environment: z.object({
    name: z.string(),
    type: z.string(),
  }).optional(),
  deployedByUser: z.object({
    name: z.string(),
    email: z.string(),
  }).optional(),
  approvedByUser: z.object({
    name: z.string(),
    email: z.string(),
  }).optional(),
});

const deploymentListResponseSchema = z.object({
  deployments: z.array(deploymentWithDetailsSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

const deploymentStatsResponseSchema = z.object({
  total: z.number(),
  success: z.number(),
  failed: z.number(),
  cancelled: z.number(),
  running: z.number(),
  pending: z.number(),
  rolledBack: z.number(),
  successRate: z.number(),
  avgDeploymentTime: z.number(),
  totalDeploymentCost: z.number(),
  byEnvironment: z.record(z.string(), z.number()),
  byStatus: z.record(z.string(), z.number()),
  byStrategy: z.record(z.string(), z.number()),
});

const riskAssessmentResponseSchema = z.object({
  riskLevel: z.enum(['low', 'medium', 'high']),
  riskScore: z.number().int().min(0).max(100),
  riskFactors: z.array(z.string()),
  recommendations: z.array(z.string()),
});

const performancePredictionResponseSchema = z.object({
  predictedResponseTime: z.number(),
  predictedThroughput: z.number(),
  predictedAvailability: z.number(),
  confidence: z.number().min(0).max(1),
});

const environmentUsageResponseSchema = z.object({
  activeDeployments: z.number(),
  totalDeployments: z.number(),
  lastDeployment: selectDeploymentSchema.optional(),
});

@Injectable()
export class DeploymentsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly deploymentsService: DeploymentsService,
  ) {}

  public get deploymentsRouter() {
    return this.trpc.router({
      // 创建部署 - 需要认证
      create: this.trpc.organizationProcedure
        .input(insertDeploymentSchema)
        .output(selectDeploymentSchema)
        .mutation(async ({ input }) => {
          return this.deploymentsService.createDeployment(input);
        }),

      // 根据ID获取部署 - 需要认证
      getById: this.trpc.organizationProcedure
        .input(z.object({ id: z.string() }))
        .output(selectDeploymentSchema.nullable())
        .query(async ({ input, ctx }) => {
          return this.deploymentsService.getDeploymentById(input.id);
        }),

      // 根据项目获取部署列表 - 需要认证
      getByProject: this.trpc.organizationProcedure
        .input(getDeploymentsByProjectSchema)
        .output(z.object({
          deployments: z.array(selectDeploymentSchema),
          total: z.number(),
          page: z.number(),
          limit: z.number(),
        }))
        .query(async ({ input }) => {
          return this.deploymentsService.getDeploymentsByProject(
            input.projectId,
            {
              page: input.page,
              limit: input.limit,
              status: input.status,
              environmentId: input.environmentId,
              deployedBy: input.deployedBy,
              branch: input.branch,
              dateFrom: input.dateFrom,
              dateTo: input.dateTo,
            }
          );
        }),

      // 根据环境获取部署列表 - 需要认证
      getByEnvironment: this.trpc.organizationProcedure
        .input(getDeploymentsByEnvironmentSchema)
        .output(z.object({
          deployments: z.array(selectDeploymentSchema),
          total: z.number(),
          page: z.number(),
          limit: z.number(),
        }))
        .query(async ({ input }) => {
          return this.deploymentsService.getDeploymentsByEnvironment(
            input.environmentId,
            {
              page: input.page,
              limit: input.limit,
              status: input.status,
              deployedBy: input.deployedBy,
              branch: input.branch,
              dateFrom: input.dateFrom,
              dateTo: input.dateTo,
            }
          );
        }),

      // 更新部署 - 需要认证
      update: this.trpc.organizationProcedure
        .input(updateDeploymentParamsSchema)
        .output(selectDeploymentSchema)
        .mutation(async ({ input }) => {
          return this.deploymentsService.updateDeployment(input.id, input.data);
        }),

      // 开始部署 - 需要认证
      start: this.trpc.organizationProcedure
        .input(startDeploymentSchema)
        .output(selectDeploymentSchema)
        .mutation(async ({ input }) => {
          return this.deploymentsService.startDeployment(input.id);
        }),

      // 完成部署 - 需要认证
      finish: this.trpc.organizationProcedure
        .input(finishDeploymentSchema)
        .output(selectDeploymentSchema)
        .mutation(async ({ input }) => {
          return this.deploymentsService.finishDeployment(
            input.id,
            input.status,
            input.metrics
          );
        }),

      // 回滚部署 - 需要认证
      rollback: this.trpc.organizationProcedure
        .input(rollbackDeploymentSchema)
        .output(selectDeploymentSchema)
        .mutation(async ({ input }) => {
          return this.deploymentsService.rollbackDeployment(
            input.id,
            input.reason,
            input.rollbackDuration
          );
        }),

      // 取消部署 - 需要认证
      cancel: this.trpc.organizationProcedure
        .input(cancelDeploymentSchema)
        .output(selectDeploymentSchema)
        .mutation(async ({ input }) => {
          return this.deploymentsService.cancelDeployment(input.id);
        }),

      // 获取部署统计 - 需要认证
      getStats: this.trpc.organizationProcedure
        .input(getDeploymentStatsSchema)
        .output(deploymentStatsResponseSchema)
        .query(async ({ input }) => {
          return this.deploymentsService.getDeploymentStats(
            input.projectId,
            input.environmentId,
            input.dateFrom,
            input.dateTo
          );
        }),

      // 批量更新部署状态 - 需要认证
      batchUpdateStatus: this.trpc.organizationProcedure
        .input(batchUpdateDeploymentStatusSchema)
        .output(z.object({ updatedCount: z.number() }))
        .mutation(async ({ input }) => {
          const updatedDeployments = await this.deploymentsService.batchUpdateDeploymentStatus(
            input.deploymentIds,
            input.status
          );
          return { updatedCount: updatedDeployments.length };
        }),

      // 删除部署 - 需要认证
      delete: this.trpc.organizationProcedure
      .input(deleteDeploymentSchema)
      .output(z.object({ success: z.boolean() }))
      .mutation(async ({ input }) => {
        await this.deploymentsService.deleteDeployment(input.id);
        return { success: true };
      }),

    batchDelete: this.trpc.organizationProcedure
      .input(batchDeleteDeploymentsSchema)
      .output(z.object({ success: z.boolean() }))
      .mutation(async ({ input }) => {
        await this.deploymentsService.batchDeleteDeployments(input.deploymentIds);
        return { success: true };
      }),

      // 获取最近部署 - 需要认证
      getRecent: this.trpc.organizationProcedure
        .input(getRecentDeploymentsSchema)
        .output(z.array(selectDeploymentSchema))
        .query(async ({ input }) => {
          return this.deploymentsService.getRecentDeployments(input.projectId, input.limit);
        }),

      // 获取活跃部署 - 需要认证
      getActive: this.trpc.organizationProcedure
        .input(getActiveDeploymentsSchema)
        .output(z.array(selectDeploymentSchema))
        .query(async ({ input }) => {
          return this.deploymentsService.getActiveDeployments(input.projectId);
        }),

      // 评估部署风险 - 需要认证
      assessRisk: this.trpc.organizationProcedure
        .input(assessDeploymentRiskSchema)
        .output(riskAssessmentResponseSchema)
        .query(async ({ input }) => {
          return this.deploymentsService.assessDeploymentRisk(
            input.projectId,
            input.environmentId,
            input.commitHash,
            input.branch
          );
        }),

      // 预测部署性能 - 需要认证
      predictPerformance: this.trpc.organizationProcedure
        .input(predictDeploymentPerformanceSchema)
        .output(performancePredictionResponseSchema)
        .query(async ({ input }) => {
          return this.deploymentsService.predictDeploymentPerformance(
            input.projectId,
            input.environmentId
          );
        }),

      // 获取环境使用情况 - 需要认证
      getEnvironmentUsage: this.trpc.organizationProcedure
      .input(getEnvironmentUsageSchema)
      .output(environmentUsageResponseSchema)
      .query(async ({ input }) => {
        return this.deploymentsService.getEnvironmentUsage(input.environmentId);
      }),
    });
  }
}

export type DeploymentsRouterType = typeof DeploymentsRouter;
