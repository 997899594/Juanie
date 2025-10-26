import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '../../trpc/trpc.service';
import { AuditLogsService } from './audit-logs.service';
import { 
  insertAuditLogSchema,
  updateAuditLogSchema,
  selectAuditLogSchema,
  AuditOutcomeEnum,
  AuditSeverityEnum,
  AuditActorTypeEnum
} from '../../database/schemas/audit-logs.schema';

@Injectable()
export class AuditLogsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  public get auditLogsRouter() {
    return this.trpc.router({
      // 创建审计日志
      create: this.trpc.protectedProcedure
        .input(insertAuditLogSchema)
        .mutation(async ({ input }) => {
          return this.auditLogsService.create(input);
        }),

      // 批量创建审计日志
      createMany: this.trpc.protectedProcedure
        .input(z.object({
          logs: z.array(insertAuditLogSchema)
        }))
        .mutation(async ({ input }) => {
          return this.auditLogsService.createMany(input.logs);
        }),

      // 根据ID获取审计日志
      getById: this.trpc.protectedProcedure
        .input(z.object({
          id: z.string().uuid()
        }))
        .query(async ({ input }) => {
          return this.auditLogsService.getById(input.id);
        }),

      // 根据组织ID获取审计日志
      getByOrganization: this.trpc.protectedProcedure
        .input(z.object({
          organizationId: z.string().uuid(),
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
          sortBy: z.enum(['createdAt', 'action', 'outcome', 'severity']).default('createdAt'),
          sortOrder: z.enum(['asc', 'desc']).default('desc'),
          action: z.string().optional(),
          outcome: AuditOutcomeEnum.optional(),
          severity: AuditSeverityEnum.optional(),
          actorType: AuditActorTypeEnum.optional(),
          userId: z.string().uuid().optional(),
          resourceType: z.string().optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
        }))
        .query(async ({ input }) => {
          const { organizationId, ...options } = input;
          return this.auditLogsService.getByOrganization(organizationId, options);
        }),

  // 根据项目ID获取审计日志
  getByProject: this.trpc.protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      sortBy: z.enum(['createdAt', 'action', 'outcome', 'severity']).default('createdAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
      action: z.string().optional(),
      outcome: AuditOutcomeEnum.optional(),
      severity: AuditSeverityEnum.optional(),
      actorType: AuditActorTypeEnum.optional(),
      userId: z.string().uuid().optional(),
      resourceType: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .output(z.object({
      logs: z.array(selectAuditLogSchema),
      total: z.number()
    }))
    .query(async ({ input, ctx }) => {
      const auditLogsService = new AuditLogsService(ctx.db);
      const { projectId, ...options } = input;
      return await auditLogsService.getByProject(projectId, options);
    }),

  // 根据用户ID获取审计日志
  getByUser: this.trpc.protectedProcedure
    .input(z.object({
      userId: z.string().uuid(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      sortBy: z.enum(['createdAt', 'action', 'outcome', 'severity']).default('createdAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
      organizationId: z.string().uuid().optional(),
      projectId: z.string().uuid().optional(),
      action: z.string().optional(),
      outcome: AuditOutcomeEnum.optional(),
      severity: AuditSeverityEnum.optional(),
      resourceType: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .output(z.object({
      logs: z.array(selectAuditLogSchema),
      total: z.number()
    }))
    .query(async ({ input, ctx }) => {
      const auditLogsService = new AuditLogsService(ctx.db);
      const { userId, ...options } = input;
      return await auditLogsService.getByUser(userId, options);
    }),

  // 根据关联ID获取审计日志
  getByCorrelationId: this.trpc.protectedProcedure
    .input(z.object({
      correlationId: z.string()
    }))
    .output(z.array(selectAuditLogSchema))
    .query(async ({ input, ctx }) => {
      const auditLogsService = new AuditLogsService(ctx.db);
      return await auditLogsService.getByCorrelationId(input.correlationId);
    }),

  // 根据请求ID获取审计日志
  getByRequestId: this.trpc.protectedProcedure
    .input(z.object({
      requestId: z.string()
    }))
    .output(z.array(selectAuditLogSchema))
    .query(async ({ input, ctx }) => {
      const auditLogsService = new AuditLogsService(ctx.db);
      return await auditLogsService.getByRequestId(input.requestId);
    }),

  // 根据资源获取审计日志
  getByResource: this.trpc.protectedProcedure
    .input(z.object({
      resourceType: z.string(),
      resourceId: z.string(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      sortBy: z.enum(['createdAt', 'action', 'outcome', 'severity']).default('createdAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
      organizationId: z.string().uuid().optional(),
      projectId: z.string().uuid().optional(),
      action: z.string().optional(),
      outcome: AuditOutcomeEnum.optional(),
      severity: AuditSeverityEnum.optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .output(z.object({
      logs: z.array(selectAuditLogSchema),
      total: z.number()
    }))
    .query(async ({ input, ctx }) => {
      const auditLogsService = new AuditLogsService(ctx.db);
      const { resourceType, resourceId, ...options } = input;
      return await auditLogsService.getByResource(resourceType, resourceId, options);
    }),

  // 更新审计日志
  update: this.trpc.protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: updateAuditLogSchema
    }))
    .output(selectAuditLogSchema.nullable())
    .mutation(async ({ input, ctx }) => {
      const auditLogsService = new AuditLogsService(ctx.db);
      return await auditLogsService.update(input.id, input.data);
    }),

  // 删除审计日志
  delete: this.trpc.protectedProcedure
    .input(z.object({
      id: z.string().uuid()
    }))
    .output(z.boolean())
    .mutation(async ({ input, ctx }) => {
      const auditLogsService = new AuditLogsService(ctx.db);
      return await auditLogsService.delete(input.id);
    }),

  // 批量删除审计日志
  deleteMany: this.trpc.protectedProcedure
    .input(z.object({
      ids: z.array(z.string().uuid())
    }))
    .output(z.number())
    .mutation(async ({ input, ctx }) => {
      const auditLogsService = new AuditLogsService(ctx.db);
      return await auditLogsService.deleteMany(input.ids);
    }),

  // 清理旧的审计日志
  cleanupOldLogs: this.trpc.protectedProcedure
    .input(z.object({
      organizationId: z.string().uuid(),
      retentionDays: z.number().min(1).default(90)
    }))
    .output(z.number())
    .mutation(async ({ input, ctx }) => {
      const auditLogsService = new AuditLogsService(ctx.db);
      return await auditLogsService.cleanupOldLogs(input.organizationId, input.retentionDays);
    }),

  // 获取审计日志统计信息
  getStatistics: this.trpc.protectedProcedure
    .input(z.object({
      organizationId: z.string().uuid().optional(),
      projectId: z.string().uuid().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .output(z.object({
      total: z.number(),
      byOutcome: z.record(AuditOutcomeEnum, z.number()),
      bySeverity: z.record(AuditSeverityEnum, z.number()),
      byActorType: z.record(AuditActorTypeEnum, z.number()),
      topActions: z.array(z.object({
        action: z.string(),
        count: z.number()
      })),
      topResources: z.array(z.object({
        resourceType: z.string(),
        count: z.number()
      }))
    }))
    .query(async ({ input, ctx }) => {
      const auditLogsService = new AuditLogsService(ctx.db);
      return await auditLogsService.getStatistics(
        input.organizationId,
        input.projectId,
        input.startDate,
        input.endDate
      );
    }),

      // 搜索审计日志
      search: this.trpc.protectedProcedure
        .input(z.object({
          query: z.string().min(1),
          organizationId: z.string().uuid().optional(),
          projectId: z.string().uuid().optional(),
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
          sortBy: z.enum(['createdAt', 'action', 'outcome', 'severity']).default('createdAt'),
          sortOrder: z.enum(['asc', 'desc']).default('desc'),
          outcome: AuditOutcomeEnum.optional(),
          severity: AuditSeverityEnum.optional(),
          actorType: AuditActorTypeEnum.optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
        }))
        .query(async ({ input }) => {
          const { query, ...options } = input;
          return this.auditLogsService.search(query, options);
        }),
    });
  }
}