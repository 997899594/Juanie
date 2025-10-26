import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '../../trpc/trpc.service';
import { WebhookEndpointsService } from './webhook-endpoints.service';
import { 
  insertWebhookEndpointSchema,
  updateWebhookEndpointSchema,
  selectWebhookEndpointSchema 
} from '../../database/schemas/webhook-endpoints.schema';

@Injectable()
export class WebhookEndpointsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly webhookEndpointsService: WebhookEndpointsService,
  ) {}

  public get webhookEndpointsRouter() {
    return this.trpc.router({
      // 创建Webhook端点
      create: this.trpc.protectedProcedure
        .input(insertWebhookEndpointSchema)
        .mutation(async ({ input }) => {
          return this.webhookEndpointsService.createWebhookEndpoint(input);
        }),

      // 根据ID获取Webhook端点
      getById: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .query(async ({ input }) => {
          return this.webhookEndpointsService.getWebhookEndpointById(input.id);
        }),

      // 根据组织ID获取Webhook端点列表
      getByOrganization: this.trpc.protectedProcedure
        .input(z.object({
          organizationId: z.string().uuid(),
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
          enabled: z.boolean().optional(),
        }))
        .query(async ({ input }) => {
          return this.webhookEndpointsService.getWebhookEndpointsByOrganization(
            input.organizationId,
            input.limit,
            input.offset,
            input.enabled
          );
        }),

      // 根据项目ID获取Webhook端点列表
      getByProject: this.trpc.protectedProcedure
        .input(z.object({
          projectId: z.string().uuid(),
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
          enabled: z.boolean().optional(),
        }))
        .query(async ({ input }) => {
          return this.webhookEndpointsService.getWebhookEndpointsByProject(
            input.projectId,
            input.limit,
            input.offset,
            input.enabled
          );
        }),

      // 更新Webhook端点
      update: this.trpc.protectedProcedure
        .input(z.object({
          id: z.string().uuid(),
          data: updateWebhookEndpointSchema,
        }))
        .mutation(async ({ input }) => {
          return this.webhookEndpointsService.updateWebhookEndpoint(input.id, input.data);
        }),

      // 删除Webhook端点
      delete: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ input }) => {
          await this.webhookEndpointsService.deleteWebhookEndpoint(input.id);
        }),

      // 批量删除Webhook端点
      batchDelete: this.trpc.protectedProcedure
        .input(z.object({
          ids: z.array(z.string().uuid()).min(1),
        }))
        .mutation(async ({ input }) => {
          await this.webhookEndpointsService.deleteWebhookEndpoints(input.ids);
        }),

      // 启用/禁用Webhook端点
      toggle: this.trpc.protectedProcedure
        .input(z.object({
          id: z.string().uuid(),
          enabled: z.boolean(),
        }))
        .mutation(async ({ input }) => {
          return this.webhookEndpointsService.toggleWebhookEndpoint(input.id, input.enabled);
        }),

      // 重新生成Secret
      regenerateSecret: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ input }) => {
          return this.webhookEndpointsService.regenerateSecret(input.id);
        }),

      // 测试Webhook端点
      test: this.trpc.protectedProcedure
        .input(z.object({
          id: z.string().uuid(),
          testPayload: z.any().optional(),
        }))
        .mutation(async ({ input }) => {
          return this.webhookEndpointsService.testWebhookEndpoint(input.id, input.testPayload);
        }),

      // 获取统计信息
      getStats: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .query(async ({ input }) => {
          return this.webhookEndpointsService.getWebhookEndpointStats(input.id);
        }),

      // 搜索Webhook端点
      search: this.trpc.protectedProcedure
        .input(z.object({
          query: z.string().min(1),
          organizationId: z.string().uuid().optional(),
          projectId: z.string().uuid().optional(),
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
        }))
        .query(async ({ input }) => {
          return this.webhookEndpointsService.searchWebhookEndpoints(
            input.query,
            input.organizationId,
            input.projectId,
            input.limit,
            input.offset
          );
        }),
    });
  }
}