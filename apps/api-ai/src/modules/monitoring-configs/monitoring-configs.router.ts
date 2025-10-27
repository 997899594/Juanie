import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { TrpcService } from '../../trpc/trpc.service';
import { MonitoringConfigsService } from './monitoring-configs.service';
import {
  insertMonitoringConfigSchema,
  selectMonitoringConfigSchema,
  updateMonitoringConfigSchema,
  MonitorTypeEnum,
} from '../../database/schemas/monitoring-configs.schema';

@Injectable()
export class MonitoringConfigsRouter {
  constructor(
    private readonly monitoringConfigsService: MonitoringConfigsService,
    private readonly trpc: TrpcService
  ) {}

  public get monitoringConfigsRouter() {
    return this.trpc.router({
    // Hello endpoint for testing
    hello: this.trpc.publicProcedure
      .input(z.object({ name: z.string().optional() }))
      .query(({ input }) => {
        return {
          greeting: `Hello ${input.name ?? 'Monitoring Configs'}!`,
        };
      }),

    // 创建监控配置
    create: this.trpc.protectedProcedure
      .input(insertMonitoringConfigSchema)
      .mutation(async ({ input }) => {
        return this.monitoringConfigsService.createMonitoringConfig(input);
      }),

    // 根据ID获取监控配置
    getById: this.trpc.protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ input }) => {
        return this.monitoringConfigsService.getMonitoringConfigById(input.id);
      }),

    // 根据项目ID获取监控配置列表
    getByProject: this.trpc.protectedProcedure
      .input(z.object({
        projectId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        return this.monitoringConfigsService.getMonitoringConfigsByProject(
          input.projectId,
          input.limit,
          input.offset
        );
      }),

    // 根据环境ID获取监控配置列表
    getByEnvironment: this.trpc.protectedProcedure
      .input(z.object({
        environmentId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        return this.monitoringConfigsService.getMonitoringConfigsByEnvironment(
          input.environmentId,
          input.limit,
          input.offset
        );
      }),

    // 根据监控类型获取配置列表
    getByType: this.trpc.protectedProcedure
      .input(z.object({
        monitorType: MonitorTypeEnum,
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        return this.monitoringConfigsService.getMonitoringConfigsByType(
          input.monitorType,
          input.limit,
          input.offset
        );
      }),

    // 获取活跃的监控配置
    getActive: this.trpc.protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        return this.monitoringConfigsService.getActiveMonitoringConfigs(
          undefined,
          input.limit,
          input.offset
        );
      }),

    // 更新监控配置
    update: this.trpc.protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
        data: updateMonitoringConfigSchema,
      }))
      .mutation(async ({ input }) => {
        const config = await this.monitoringConfigsService.updateMonitoringConfig(input.id, input.data);
        if (!config) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Monitoring config not found' });
        }
        return config;
      }),

    // 切换监控配置状态
    toggleStatus: this.trpc.protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input }) => {
        const success = await this.monitoringConfigsService.toggleMonitoringConfig(input.id, true);
        if (!success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to toggle monitoring config status',
          });
        }
        return { success: true };
      }),

    // 删除监控配置
    delete: this.trpc.protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input }) => {
        const success = await this.monitoringConfigsService.deleteMonitoringConfig(input.id);
        if (!success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to delete monitoring config',
          });
        }
        return { success: true };
      }),

    // 批量删除监控配置
    batchDelete: this.trpc.protectedProcedure
      .input(z.object({
        ids: z.array(z.string().uuid()).min(1).max(50),
      }))
      .mutation(async ({ input }) => {
        const count = await this.monitoringConfigsService.batchDeleteMonitoringConfigs(input.ids);
        return { deletedCount: count };
      }),

    // 获取监控配置统计信息
    getStats: this.trpc.protectedProcedure
      .input(z.object({
        projectId: z.string().uuid().optional(),
        environmentId: z.string().uuid().optional(),
      }))
      .query(async ({ input }) => {
        return this.monitoringConfigsService.getMonitoringConfigStats(
          input.projectId
        );
      }),

    // 获取监控配置数量
    getCount: this.trpc.protectedProcedure
      .input(z.object({
        projectId: z.string().uuid().optional(),
        isActive: z.boolean().optional(),
      }))
      .query(async ({ input }) => {
        return this.monitoringConfigsService.getMonitoringConfigCount(
          input.projectId,
          input.isActive
        );
      }),

    // 验证监控配置
    validate: this.trpc.protectedProcedure
      .input(insertMonitoringConfigSchema.partial())
      .mutation(async ({ input }) => {
        return this.monitoringConfigsService.validateMonitoringConfig(input);
      }),

    // 获取监控类型列表
    getTypes: this.trpc.protectedProcedure
      .query(async () => {
        return Object.values(MonitorTypeEnum);
      }),

    // 复制监控配置
    duplicate: this.trpc.protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input }) => {
        const config = await this.monitoringConfigsService.duplicateMonitoringConfig(input.id);
        if (!config) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to duplicate monitoring config',
          });
        }
        return config;
      }),

    // 批量更新监控配置状态
    batchUpdateStatus: this.trpc.protectedProcedure
      .input(z.object({
        ids: z.array(z.string().uuid()).min(1).max(50),
        isActive: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        const count = await this.monitoringConfigsService.batchToggleMonitoringConfigs(
          input.ids,
          input.isActive
        );
        return { updatedCount: count };
      }),
    });
  }
}