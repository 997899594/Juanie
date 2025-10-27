import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '../../trpc/trpc.service';
import { EventsService } from './events.service';
import { 
  insertEventSchema,
  updateEventSchema,
  selectEventSchema,
  EventPriorityEnum 
} from '../../database/schemas/events.schema';

// 输入验证schemas
const getByIdSchema = z.object({
  id: z.string().uuid(),
});

const getByOrganizationSchema = z.object({
  organizationId: z.string().uuid(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  status: z.enum(['created', 'queued', 'processed', 'failed']).optional(),
  eventType: z.string().optional(),
});

const getByProjectSchema = z.object({
  projectId: z.string().uuid(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  status: z.enum(['created', 'queued', 'processed', 'failed']).optional(),
  eventType: z.string().optional(),
});

const getByTypeSchema = z.object({
  eventType: z.string().min(1),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  status: z.enum(['created', 'queued', 'processed', 'failed']).optional(),
  organizationId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
});

const getByStatusSchema = z.object({
  status: z.enum(['created', 'queued', 'processed', 'failed']),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  priority: EventPriorityEnum.optional(),
});

const getByPrioritySchema = z.object({
  priority: EventPriorityEnum,
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  status: z.enum(['created', 'queued', 'processed', 'failed']).optional(),
});

const getByDateRangeSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  organizationId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  status: z.enum(['created', 'queued', 'processed', 'failed']).optional(),
});

const getByTraceIdSchema = z.object({
  traceId: z.string().min(1),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  data: updateEventSchema,
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

const batchDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

const markAsQueuedSchema = z.object({
  id: z.string().uuid(),
});

const markAsProcessedSchema = z.object({
  id: z.string().uuid(),
  result: z.record(z.string(), z.unknown()).optional(),
});

const markAsFailedSchema = z.object({
  id: z.string().uuid(),
  result: z.record(z.string(), z.unknown()).optional(),
});

const getQueueSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  priority: EventPriorityEnum.optional(),
});

const getStatsSchema = z.object({
  organizationId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

const searchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  organizationId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  status: z.enum(['created', 'queued', 'processed', 'failed']).optional(),
});

const cleanupSchema = z.object({
  daysToKeep: z.number().min(1).max(365).default(30),
});

// 输出schemas
const eventStatsSchema = z.object({
  total: z.number(),
  created: z.number(),
  queued: z.number(),
  processed: z.number(),
  failed: z.number(),
  byPriority: z.record(z.string(), z.number()),
  byType: z.record(z.string(), z.number()),
  processingRate: z.number(),
  failureRate: z.number(),
  avgProcessingTime: z.number(),
});

@Injectable()
export class EventsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly eventsService: EventsService,
  ) {}

  public get eventsRouter() {
    return this.trpc.router({
      // 创建事件
      create: this.trpc.protectedProcedure
        .input(insertEventSchema)
        .output(selectEventSchema)
        .mutation(async ({ input }) => {
          return this.eventsService.createEvent(input);
        }),

      // 根据ID获取事件
      getById: this.trpc.protectedProcedure
        .input(getByIdSchema)
        .output(selectEventSchema)
        .query(async ({ input }) => {
          return this.eventsService.getEventById(input.id);
        }),

      // 根据组织ID获取事件列表
      getByOrganization: this.trpc.protectedProcedure
        .input(getByOrganizationSchema)
        .output(z.array(selectEventSchema))
        .query(async ({ input }) => {
          return this.eventsService.getEventsByOrganization(
            input.organizationId,
            input.limit,
            input.offset,
            input.status,
            input.eventType
          );
        }),

      // 根据项目ID获取事件列表
      getByProject: this.trpc.protectedProcedure
        .input(getByProjectSchema)
        .output(z.array(selectEventSchema))
        .query(async ({ input }) => {
          return this.eventsService.getEventsByProject(
            input.projectId,
            input.limit,
            input.offset,
            input.status,
            input.eventType
          );
        }),

      // 根据事件类型获取事件列表
      getByType: this.trpc.protectedProcedure
        .input(getByTypeSchema)
        .output(z.array(selectEventSchema))
        .query(async ({ input }) => {
          return this.eventsService.getEventsByType(
            input.eventType,
            input.limit,
            input.offset,
            input.status,
            input.organizationId,
            input.projectId
          );
        }),

      // 根据状态获取事件列表
      getByStatus: this.trpc.protectedProcedure
        .input(getByStatusSchema)
        .output(z.array(selectEventSchema))
        .query(async ({ input }) => {
          return this.eventsService.getEventsByStatus(
            input.status,
            input.limit,
            input.offset,
            input.priority
          );
        }),

      // 根据优先级获取事件列表
      getByPriority: this.trpc.protectedProcedure
        .input(getByPrioritySchema)
        .output(z.array(selectEventSchema))
        .query(async ({ input }) => {
          return this.eventsService.getEventsByPriority(
            input.priority,
            input.limit,
            input.offset,
            input.status
          );
        }),

      // 根据时间范围获取事件列表
      getByDateRange: this.trpc.protectedProcedure
        .input(getByDateRangeSchema)
        .output(z.array(selectEventSchema))
        .query(async ({ input }) => {
          return this.eventsService.getEventsByDateRange(
            input.startDate,
            input.endDate,
            input.limit,
            input.offset,
            input.organizationId,
            input.projectId,
            input.status
          );
        }),

      // 根据traceId获取相关事件
      getByTraceId: this.trpc.protectedProcedure
        .input(getByTraceIdSchema)
        .output(z.array(selectEventSchema))
        .query(async ({ input }) => {
          return this.eventsService.getEventsByTraceId(input.traceId);
        }),

      // 更新事件
      update: this.trpc.protectedProcedure
        .input(updateSchema)
        .output(selectEventSchema)
        .mutation(async ({ input }) => {
          return this.eventsService.updateEvent(input.id, input.data);
        }),

      // 删除事件
      delete: this.trpc.protectedProcedure
        .input(deleteSchema)
        .output(z.void())
        .mutation(async ({ input }) => {
          await this.eventsService.deleteEvent(input.id);
        }),

      // 批量删除事件
      batchDelete: this.trpc.protectedProcedure
        .input(batchDeleteSchema)
        .output(z.void())
        .mutation(async ({ input }) => {
          await this.eventsService.deleteEvents(input.ids);
        }),

      // 将事件标记为已入队
      markAsQueued: this.trpc.protectedProcedure
        .input(markAsQueuedSchema)
        .output(selectEventSchema)
        .mutation(async ({ input }) => {
          return this.eventsService.markEventAsQueued(input.id);
        }),

      // 将事件标记为已处理
      markAsProcessed: this.trpc.protectedProcedure
        .input(markAsProcessedSchema)
        .output(selectEventSchema)
        .mutation(async ({ input }) => {
          return this.eventsService.markEventAsProcessed(input.id, input.result);
        }),

      // 将事件标记为失败
      markAsFailed: this.trpc.protectedProcedure
        .input(markAsFailedSchema)
        .output(selectEventSchema)
        .mutation(async ({ input }) => {
          return this.eventsService.markEventAsFailed(input.id, input.result);
        }),

      // 获取待处理的事件队列
      getQueue: this.trpc.protectedProcedure
        .input(getQueueSchema)
        .output(z.array(selectEventSchema))
        .query(async ({ input }) => {
          return this.eventsService.getEventQueue(input.limit, input.priority);
        }),

      // 获取事件统计信息
      getStats: this.trpc.protectedProcedure
        .input(getStatsSchema)
        .output(eventStatsSchema)
        .query(async ({ input }) => {
          return this.eventsService.getEventStats(
            input.organizationId,
            input.projectId,
            input.startDate,
            input.endDate
          );
        }),

      // 搜索事件
      search: this.trpc.protectedProcedure
        .input(searchSchema)
        .output(z.array(selectEventSchema))
        .query(async ({ input }) => {
          return this.eventsService.searchEvents(
            input.query,
            input.limit,
            input.offset,
            input.organizationId,
            input.projectId,
            input.status
          );
        }),

      // 清理旧事件
      cleanup: this.trpc.protectedProcedure
        .input(cleanupSchema)
        .output(z.number())
        .mutation(async ({ input }) => {
          return this.eventsService.cleanupOldEvents(input.daysToKeep);
        }),
    });
  }
}