import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../../lib/trpc';
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
  result: z.record(z.unknown()).optional(),
});

const markAsFailedSchema = z.object({
  id: z.string().uuid(),
  result: z.record(z.unknown()).optional(),
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
  byPriority: z.record(EventPriorityEnum, z.number()),
  byType: z.record(z.string(), z.number()),
  processingRate: z.number(),
  failureRate: z.number(),
  avgProcessingTime: z.number(),
});

export const eventsRouter = router({
  // 创建事件
  create: protectedProcedure
    .input(insertEventSchema)
    .output(selectEventSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new EventsService(ctx.db);
      return await service.createEvent(input);
    }),

  // 根据ID获取事件
  getById: protectedProcedure
    .input(getByIdSchema)
    .output(selectEventSchema)
    .query(async ({ input, ctx }) => {
      const service = new EventsService(ctx.db);
      return await service.getEventById(input.id);
    }),

  // 根据组织ID获取事件列表
  getByOrganization: protectedProcedure
    .input(getByOrganizationSchema)
    .output(z.array(selectEventSchema))
    .query(async ({ input, ctx }) => {
      const service = new EventsService(ctx.db);
      return await service.getEventsByOrganization(
        input.organizationId,
        input.limit,
        input.offset,
        input.status,
        input.eventType
      );
    }),

  // 根据项目ID获取事件列表
  getByProject: protectedProcedure
    .input(getByProjectSchema)
    .output(z.array(selectEventSchema))
    .query(async ({ input, ctx }) => {
      const service = new EventsService(ctx.db);
      return await service.getEventsByProject(
        input.projectId,
        input.limit,
        input.offset,
        input.status,
        input.eventType
      );
    }),

  // 根据事件类型获取事件列表
  getByType: protectedProcedure
    .input(getByTypeSchema)
    .output(z.array(selectEventSchema))
    .query(async ({ input, ctx }) => {
      const service = new EventsService(ctx.db);
      return await service.getEventsByType(
        input.eventType,
        input.limit,
        input.offset,
        input.status,
        input.organizationId,
        input.projectId
      );
    }),

  // 根据状态获取事件列表
  getByStatus: protectedProcedure
    .input(getByStatusSchema)
    .output(z.array(selectEventSchema))
    .query(async ({ input, ctx }) => {
      const service = new EventsService(ctx.db);
      return await service.getEventsByStatus(
        input.status,
        input.limit,
        input.offset,
        input.priority
      );
    }),

  // 根据优先级获取事件列表
  getByPriority: protectedProcedure
    .input(getByPrioritySchema)
    .output(z.array(selectEventSchema))
    .query(async ({ input, ctx }) => {
      const service = new EventsService(ctx.db);
      return await service.getEventsByPriority(
        input.priority,
        input.limit,
        input.offset,
        input.status
      );
    }),

  // 根据时间范围获取事件列表
  getByDateRange: protectedProcedure
    .input(getByDateRangeSchema)
    .output(z.array(selectEventSchema))
    .query(async ({ input, ctx }) => {
      const service = new EventsService(ctx.db);
      return await service.getEventsByDateRange(
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
  getByTraceId: protectedProcedure
    .input(getByTraceIdSchema)
    .output(z.array(selectEventSchema))
    .query(async ({ input, ctx }) => {
      const service = new EventsService(ctx.db);
      return await service.getEventsByTraceId(input.traceId);
    }),

  // 更新事件
  update: protectedProcedure
    .input(updateSchema)
    .output(selectEventSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new EventsService(ctx.db);
      return await service.updateEvent(input.id, input.data);
    }),

  // 删除事件
  delete: protectedProcedure
    .input(deleteSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const service = new EventsService(ctx.db);
      await service.deleteEvent(input.id);
    }),

  // 批量删除事件
  batchDelete: protectedProcedure
    .input(batchDeleteSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const service = new EventsService(ctx.db);
      await service.deleteEvents(input.ids);
    }),

  // 将事件标记为已入队
  markAsQueued: protectedProcedure
    .input(markAsQueuedSchema)
    .output(selectEventSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new EventsService(ctx.db);
      return await service.markEventAsQueued(input.id);
    }),

  // 将事件标记为已处理
  markAsProcessed: protectedProcedure
    .input(markAsProcessedSchema)
    .output(selectEventSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new EventsService(ctx.db);
      return await service.markEventAsProcessed(input.id, input.result);
    }),

  // 将事件标记为失败
  markAsFailed: protectedProcedure
    .input(markAsFailedSchema)
    .output(selectEventSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new EventsService(ctx.db);
      return await service.markEventAsFailed(input.id, input.result);
    }),

  // 获取待处理的事件队列
  getQueue: protectedProcedure
    .input(getQueueSchema)
    .output(z.array(selectEventSchema))
    .query(async ({ input, ctx }) => {
      const service = new EventsService(ctx.db);
      return await service.getEventQueue(input.limit, input.priority);
    }),

  // 获取事件统计信息
  getStats: protectedProcedure
    .input(getStatsSchema)
    .output(eventStatsSchema)
    .query(async ({ input, ctx }) => {
      const service = new EventsService(ctx.db);
      return await service.getEventStats(
        input.organizationId,
        input.projectId,
        input.startDate,
        input.endDate
      );
    }),

  // 搜索事件
  search: protectedProcedure
    .input(searchSchema)
    .output(z.array(selectEventSchema))
    .query(async ({ input, ctx }) => {
      const service = new EventsService(ctx.db);
      return await service.searchEvents(
        input.query,
        input.limit,
        input.offset,
        input.organizationId,
        input.projectId,
        input.status
      );
    }),

  // 清理旧事件
  cleanup: protectedProcedure
    .input(cleanupSchema)
    .output(z.number())
    .mutation(async ({ input, ctx }) => {
      const service = new EventsService(ctx.db);
      return await service.cleanupOldEvents(input.daysToKeep);
    }),
});