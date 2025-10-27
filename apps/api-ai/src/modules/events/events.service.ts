import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import type { Database } from '../../database/database.module';
import { eq, and, desc, asc, count, sql, ilike, inArray, gte, lte, or, isNull } from 'drizzle-orm';
import { 
  events, 
  Event, 
  NewEvent,
  UpdateEvent,
  EventPriority,
  insertEventSchema,
  updateEventSchema 
} from '../../database/schemas/events.schema';
import * as crypto from 'crypto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectDatabase() private readonly db: Database,
  ) {}

  /**
   * 创建新事件
   */
  async createEvent(eventData: NewEvent): Promise<Event> {
    try {
      // 验证输入数据
      insertEventSchema.parse(eventData);

      // 如果没有提供traceId，自动生成一个
      if (!eventData.traceId) {
        eventData.traceId = this.generateTraceId();
      }

      // 如果没有提供spanId，自动生成一个
      if (!eventData.spanId) {
        eventData.spanId = this.generateSpanId();
      }

      const [newEvent] = await this.db
        .insert(events)
        .values(eventData)
        .returning();

      this.logger.log(`Event created: ${newEvent.id} (${newEvent.eventType})`);
      return newEvent;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create event: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据ID获取事件
   */
  async getEventById(id: string): Promise<Event> {
    try {
      const [event] = await this.db
        .select()
        .from(events)
        .where(eq(events.id, id));

      if (!event) {
        throw new NotFoundException(`Event with ID ${id} not found`);
      }

      return event;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get event by ID ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据组织ID获取事件列表
   */
  async getEventsByOrganization(
    organizationId: string, 
    limit = 20, 
    offset = 0,
    status?: 'created' | 'queued' | 'processed' | 'failed',
    eventType?: string
  ): Promise<Event[]> {
    try {
      const conditions = [eq(events.organizationId, organizationId)];
      
      if (status) {
        conditions.push(eq(events.status, status));
      }

      if (eventType) {
        conditions.push(eq(events.eventType, eventType));
      }

      return await this.db
        .select()
        .from(events)
        .where(and(...conditions))
        .orderBy(desc(events.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get events by organization ${organizationId}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据项目ID获取事件列表
   */
  async getEventsByProject(
    projectId: string, 
    limit = 20, 
    offset = 0,
    status?: 'created' | 'queued' | 'processed' | 'failed',
    eventType?: string
  ): Promise<Event[]> {
    try {
      const conditions = [eq(events.projectId, projectId)];
      
      if (status) {
        conditions.push(eq(events.status, status));
      }

      if (eventType) {
        conditions.push(eq(events.eventType, eventType));
      }

      return await this.db
        .select()
        .from(events)
        .where(and(...conditions))
        .orderBy(desc(events.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get events by project ${projectId}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据事件类型获取事件列表
   */
  async getEventsByType(
    eventType: string, 
    limit = 20, 
    offset = 0,
    status?: 'created' | 'queued' | 'processed' | 'failed',
    organizationId?: string,
    projectId?: string
  ): Promise<Event[]> {
    try {
      const conditions = [eq(events.eventType, eventType)];
      
      if (status) {
        conditions.push(eq(events.status, status));
      }

      if (organizationId) {
        conditions.push(eq(events.organizationId, organizationId));
      }

      if (projectId) {
        conditions.push(eq(events.projectId, projectId));
      }

      return await this.db
        .select()
        .from(events)
        .where(and(...conditions))
        .orderBy(desc(events.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get events by type ${eventType}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据状态获取事件列表
   */
  async getEventsByStatus(
    status: 'created' | 'queued' | 'processed' | 'failed',
    limit = 20, 
    offset = 0,
    priority?: EventPriority
  ): Promise<Event[]> {
    try {
      const conditions = [eq(events.status, status)];
      
      if (priority) {
        conditions.push(eq(events.priority, priority));
      }

      return await this.db
        .select()
        .from(events)
        .where(and(...conditions))
        .orderBy(desc(events.priority), desc(events.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get events by status ${status}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据优先级获取事件列表
   */
  async getEventsByPriority(
    priority: EventPriority,
    limit = 20, 
    offset = 0,
    status?: 'created' | 'queued' | 'processed' | 'failed'
  ): Promise<Event[]> {
    try {
      const conditions = [eq(events.priority, priority)];
      
      if (status) {
        conditions.push(eq(events.status, status));
      }

      return await this.db
        .select()
        .from(events)
        .where(and(...conditions))
        .orderBy(desc(events.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get events by priority ${priority}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据时间范围获取事件列表
   */
  async getEventsByDateRange(
    startDate: Date,
    endDate: Date,
    limit = 20,
    offset = 0,
    organizationId?: string,
    projectId?: string,
    status?: 'created' | 'queued' | 'processed' | 'failed'
  ): Promise<Event[]> {
    try {
      const conditions = [
        gte(events.createdAt, startDate),
        lte(events.createdAt, endDate)
      ];

      if (organizationId) {
        conditions.push(eq(events.organizationId, organizationId));
      }

      if (projectId) {
        conditions.push(eq(events.projectId, projectId));
      }

      if (status) {
        conditions.push(eq(events.status, status));
      }

      return await this.db
        .select()
        .from(events)
        .where(and(...conditions))
        .orderBy(desc(events.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get events by date range: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据traceId获取相关事件
   */
  async getEventsByTraceId(traceId: string): Promise<Event[]> {
    try {
      return await this.db
        .select()
        .from(events)
        .where(eq(events.traceId, traceId))
        .orderBy(asc(events.createdAt));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get events by trace ID ${traceId}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 更新事件
   */
  async updateEvent(id: string, updateData: UpdateEvent): Promise<Event> {
    try {
      // 验证输入数据
      updateEventSchema.parse(updateData);

      // 检查事件是否存在
      await this.getEventById(id);

      const [updatedEvent] = await this.db
        .update(events)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(events.id, id))
        .returning();

      this.logger.log(`Event updated: ${id}`);
      return updatedEvent;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update event ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 删除事件
   */
  async deleteEvent(id: string): Promise<void> {
    try {
      // 检查事件是否存在
      await this.getEventById(id);

      await this.db
        .delete(events)
        .where(eq(events.id, id));

      this.logger.log(`Event deleted: ${id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete event ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 批量删除事件
   */
  async deleteEvents(ids: string[]): Promise<void> {
    try {
      if (ids.length === 0) {
        throw new BadRequestException('No event IDs provided');
      }

      await this.db
        .delete(events)
        .where(inArray(events.id, ids));

      this.logger.log(`Events deleted: ${ids.join(', ')}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete events: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 将事件标记为已入队
   */
  async markEventAsQueued(id: string): Promise<Event> {
    try {
      return await this.updateEvent(id, {
        status: 'queued',
        queuedAt: new Date(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to mark event as queued ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 将事件标记为已处理
   */
  async markEventAsProcessed(id: string, result?: Record<string, unknown>): Promise<Event> {
    try {
      return await this.updateEvent(id, {
        status: 'processed',
        processedAt: new Date(),
        result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to mark event as processed ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 将事件标记为失败
   */
  async markEventAsFailed(id: string, result?: Record<string, unknown>): Promise<Event> {
    try {
      return await this.updateEvent(id, {
        status: 'failed',
        failedAt: new Date(),
        result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to mark event as failed ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 获取待处理的事件队列
   */
  async getEventQueue(
    limit = 50,
    priority?: EventPriority
  ): Promise<Event[]> {
    try {
      const conditions = [eq(events.status, 'created')];
      
      if (priority) {
        conditions.push(eq(events.priority, priority));
      }

      return await this.db
        .select()
        .from(events)
        .where(and(...conditions))
        .orderBy(desc(events.priority), asc(events.createdAt))
        .limit(limit);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get event queue: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 获取事件统计信息
   */
  async getEventStats(
    organizationId?: string,
    projectId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    total: number;
    created: number;
    queued: number;
    processed: number;
    failed: number;
    byPriority: Record<EventPriority, number>;
    byType: Record<string, number>;
    processingRate: number;
    failureRate: number;
    avgProcessingTime: number;
  }> {
    try {
      const conditions = [];

      if (organizationId) {
        conditions.push(eq(events.organizationId, organizationId));
      }

      if (projectId) {
        conditions.push(eq(events.projectId, projectId));
      }

      if (startDate) {
        conditions.push(gte(events.createdAt, startDate));
      }

      if (endDate) {
        conditions.push(lte(events.createdAt, endDate));
      }

      const baseCondition = conditions.length > 0 ? and(...conditions) : undefined;

      // 获取总数统计
      const [totalResult] = await this.db
        .select({ count: count() })
        .from(events)
        .where(baseCondition);

      const [createdResult] = await this.db
        .select({ count: count() })
        .from(events)
        .where(and(
          baseCondition || sql`1=1`,
          eq(events.status, 'created')
        ));

      const [queuedResult] = await this.db
        .select({ count: count() })
        .from(events)
        .where(and(
          baseCondition || sql`1=1`,
          eq(events.status, 'queued')
        ));

      const [processedResult] = await this.db
        .select({ count: count() })
        .from(events)
        .where(and(
          baseCondition || sql`1=1`,
          eq(events.status, 'processed')
        ));

      const [failedResult] = await this.db
        .select({ count: count() })
        .from(events)
        .where(and(
          baseCondition || sql`1=1`,
          eq(events.status, 'failed')
        ));

      // 按优先级统计
      const priorityStats = await this.db
        .select({
          priority: events.priority,
          count: count(),
        })
        .from(events)
        .where(baseCondition)
        .groupBy(events.priority);

      // 按类型统计
      const typeStats = await this.db
        .select({
          eventType: events.eventType,
          count: count(),
        })
        .from(events)
        .where(baseCondition)
        .groupBy(events.eventType)
        .limit(20);

      // 计算平均处理时间
      const [avgProcessingTimeResult] = await this.db
        .select({
          avg: sql<number>`AVG(EXTRACT(EPOCH FROM (${events.processedAt} - ${events.createdAt})))`
        })
        .from(events)
        .where(and(
          baseCondition || sql`1=1`,
          eq(events.status, 'processed'),
          sql`${events.processedAt} IS NOT NULL`
        ));

      const total = totalResult.count;
      const created = createdResult.count;
      const queued = queuedResult.count;
      const processed = processedResult.count;
      const failed = failedResult.count;

      const processingRate = total > 0 ? (processed / total) * 100 : 0;
      const failureRate = total > 0 ? (failed / total) * 100 : 0;
      const avgProcessingTime = avgProcessingTimeResult.avg || 0;

      const byPriority: Record<EventPriority, number> = {
        low: 0,
        medium: 0,
        high: 0,
        urgent: 0,
      };

      priorityStats.forEach(stat => {
        byPriority[stat.priority as EventPriority] = stat.count;
      });

      const byType: Record<string, number> = {};
      typeStats.forEach(stat => {
        byType[stat.eventType] = stat.count;
      });

      return {
        total,
        created,
        queued,
        processed,
        failed,
        byPriority,
        byType,
        processingRate,
        failureRate,
        avgProcessingTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get event stats: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 搜索事件
   */
  async searchEvents(
    query: string,
    limit = 20,
    offset = 0,
    organizationId?: string,
    projectId?: string,
    status?: 'created' | 'queued' | 'processed' | 'failed'
  ): Promise<Event[]> {
    try {
      const searchPattern = `%${query}%`;
      const conditions = [
        or(
          ilike(events.eventType, searchPattern),
          ilike(events.source, searchPattern),
          ilike(events.traceId, searchPattern)
        )
      ];

      if (organizationId) {
        conditions.push(eq(events.organizationId, organizationId));
      }

      if (projectId) {
        conditions.push(eq(events.projectId, projectId));
      }

      if (status) {
        conditions.push(eq(events.status, status));
      }

      return await this.db
        .select()
        .from(events)
        .where(and(...conditions))
        .orderBy(desc(events.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to search events: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 清理旧事件
   */
  async cleanupOldEvents(daysToKeep = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const deletedEvents = await this.db
        .delete(events)
        .where(lte(events.createdAt, cutoffDate))
        .returning({ id: events.id });

      const deletedCount = deletedEvents.length;
      this.logger.log(`Cleaned up ${deletedCount} old events`);

      return deletedCount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to cleanup old events: ${errorMessage}`);
      throw error;
    }
  }

  // 私有辅助方法

  /**
   * 生成traceId
   */
  private generateTraceId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * 生成spanId
   */
  private generateSpanId(): string {
    return crypto.randomBytes(8).toString('hex');
  }
}