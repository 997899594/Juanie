import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '../../trpc/trpc.service';
import { WebhookEventsService } from './webhook-events.service';
import { 
  insertWebhookEventSchema,
  updateWebhookEventSchema,
  selectWebhookEventSchema,
  WebhookEventStatusEnum 
} from '../../database/schemas/webhook-events.schema';

@Injectable()
export class WebhookEventsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly webhookEventsService: WebhookEventsService,
  ) {}

  public get webhookEventsRouter() {
    return this.trpc.router({

      // 创建Webhook事件
      create: this.trpc.protectedProcedure
        .input(insertWebhookEventSchema)
        .mutation(async ({ input }) => {
          return this.webhookEventsService.createWebhookEvent(input);
        }),
      // 根据ID获取Webhook事件
      getById: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .query(async ({ input }) => {
          return this.webhookEventsService.getWebhookEventById(input.id);
        }),

      // 根据端点ID获取Webhook事件列表
       getByEndpoint: this.trpc.protectedProcedure
         .input(z.object({
           endpointId: z.string().uuid(),
           limit: z.number().min(1).max(100).default(20),
           offset: z.number().min(0).default(0),
           status: z.enum(['pending', 'delivered', 'failed']).optional(),
         }))
         .query(async ({ input }) => {
           return this.webhookEventsService.getWebhookEventsByEndpoint(
             input.endpointId,
             input.limit,
             input.offset,
             input.status
           );
         }),

       // 根据事件类型获取Webhook事件列表
       getByType: this.trpc.protectedProcedure
         .input(z.object({
           eventType: z.string().min(1),
           limit: z.number().min(1).max(100).default(20),
           offset: z.number().min(0).default(0),
           status: z.enum(['pending', 'delivered', 'failed']).optional(),
         }))
         .query(async ({ input }) => {
           return this.webhookEventsService.getWebhookEventsByType(
             input.eventType,
             input.limit,
             input.offset,
             input.status
           );
         }),

       // 根据状态获取Webhook事件列表
       getByStatus: this.trpc.protectedProcedure
         .input(z.object({
           status: z.enum(['pending', 'delivered', 'failed']),
           limit: z.number().min(1).max(100).default(20),
           offset: z.number().min(0).default(0),
         }))
         .query(async ({ input }) => {
           return this.webhookEventsService.getWebhookEventsByStatus(
             input.status,
             input.limit,
             input.offset
           );
         }),

       // 根据时间范围获取Webhook事件列表
       getByDateRange: this.trpc.protectedProcedure
         .input(z.object({
           startDate: z.date(),
           endDate: z.date(),
           limit: z.number().min(1).max(100).default(20),
           offset: z.number().min(0).default(0),
           endpointId: z.string().uuid().optional(),
           status: z.enum(['pending', 'delivered', 'failed']).optional(),
         }))
         .query(async ({ input }) => {
           return this.webhookEventsService.getWebhookEventsByDateRange(
             input.startDate,
             input.endDate,
             input.limit,
             input.offset,
             input.endpointId,
             input.status
           );
         }),

      // 更新Webhook事件
      update: this.trpc.protectedProcedure
        .input(z.object({
          id: z.string().uuid(),
          data: updateWebhookEventSchema,
        }))
        .mutation(async ({ input }) => {
          return this.webhookEventsService.updateWebhookEvent(input.id, input.data);
        }),

      // 删除Webhook事件
      delete: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ input }) => {
          await this.webhookEventsService.deleteWebhookEvent(input.id);
        }),

      // 批量删除Webhook事件
      batchDelete: this.trpc.protectedProcedure
        .input(z.object({
          ids: z.array(z.string().uuid()).min(1),
        }))
        .mutation(async ({ input }) => {
          await this.webhookEventsService.deleteWebhookEvents(input.ids);
        }),

      // 重试Webhook事件
      retry: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ input }) => {
          return this.webhookEventsService.retryWebhookEvent(input.id);
        }),

      // 批量重试Webhook事件
       batchRetry: this.trpc.protectedProcedure
         .input(z.object({
           endpointId: z.string().uuid().optional(),
           maxRetries: z.number().min(1).max(10).default(3),
         }))
         .mutation(async ({ input }) => {
           return this.webhookEventsService.retryFailedWebhookEvents(input.endpointId, input.maxRetries);
         }),

       // 获取统计信息
       getStats: this.trpc.protectedProcedure
         .input(z.object({
           endpointId: z.string().uuid().optional(),
           startDate: z.date().optional(),
           endDate: z.date().optional(),
         }))
         .query(async ({ input }) => {
           return this.webhookEventsService.getWebhookEventStats(
             input.endpointId,
             input.startDate,
             input.endDate
           );
         }),

       // 搜索Webhook事件
       search: this.trpc.protectedProcedure
         .input(z.object({
           query: z.string().min(1),
           limit: z.number().min(1).max(100).default(20),
           offset: z.number().min(0).default(0),
           endpointId: z.string().uuid().optional(),
           status: z.enum(['pending', 'delivered', 'failed']).optional(),
         }))
         .query(async ({ input }) => {
           return this.webhookEventsService.searchWebhookEvents(
             input.query,
             input.limit,
             input.offset,
             input.endpointId,
             input.status
           );
         }),

       // 清理旧事件
       cleanup: this.trpc.protectedProcedure
         .input(z.object({
           daysToKeep: z.number().min(1).max(365).default(30),
         }))
         .mutation(async ({ input }) => {
           const deletedCount = await this.webhookEventsService.cleanupOldWebhookEvents(input.daysToKeep);
           return deletedCount;
         }),
    });
  }
}