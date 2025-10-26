import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import { Database } from '../../database/database.module';
import { eq, and, desc, asc, count, sql, ilike, inArray, gte, lte, or, isNull } from 'drizzle-orm';
import { 
  webhookEvents, 
  WebhookEvent, 
  NewWebhookEvent,
  UpdateWebhookEvent,
  insertWebhookEventSchema,
  updateWebhookEventSchema 
} from '../../database/schemas/webhook-events.schema';
import { webhookEndpoints } from '../../database/schemas/webhook-endpoints.schema';
import * as crypto from 'crypto';

@Injectable()
export class WebhookEventsService {
  private readonly logger = new Logger(WebhookEventsService.name);

  constructor(
    @InjectDatabase() private readonly db: Database,
  ) {}

  /**
   * 创建新的Webhook事件
   */
  async createWebhookEvent(eventData: NewWebhookEvent): Promise<WebhookEvent> {
    try {
      // 验证输入数据
      insertWebhookEventSchema.parse(eventData);

      const [newEvent] = await this.db
        .insert(webhookEvents)
        .values(eventData)
        .returning();

      this.logger.log(`Webhook event created: ${newEvent.id}`);
      return newEvent;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create webhook event: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据ID获取Webhook事件
   */
  async getWebhookEventById(id: string): Promise<WebhookEvent> {
    try {
      const [event] = await this.db
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.id, id));

      if (!event) {
        throw new NotFoundException(`Webhook event with ID ${id} not found`);
      }

      return event;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get webhook event by ID ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据端点ID获取Webhook事件列表
   */
  async getWebhookEventsByEndpoint(
    endpointId: string, 
    limit = 20, 
    offset = 0,
    status?: 'pending' | 'delivered' | 'failed'
  ): Promise<WebhookEvent[]> {
    try {
      const conditions = [eq(webhookEvents.endpointId, endpointId)];
      
      if (status) {
        conditions.push(eq(webhookEvents.status, status));
      }

      return await this.db
        .select()
        .from(webhookEvents)
        .where(and(...conditions))
        .orderBy(desc(webhookEvents.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get webhook events by endpoint ${endpointId}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据事件类型获取Webhook事件列表
   */
  async getWebhookEventsByType(
    eventType: string, 
    limit = 20, 
    offset = 0,
    status?: 'pending' | 'delivered' | 'failed'
  ): Promise<WebhookEvent[]> {
    try {
      const conditions = [eq(webhookEvents.eventType, eventType)];
      
      if (status) {
        conditions.push(eq(webhookEvents.status, status));
      }

      return await this.db
        .select()
        .from(webhookEvents)
        .where(and(...conditions))
        .orderBy(desc(webhookEvents.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get webhook events by type ${eventType}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据状态获取Webhook事件列表
   */
  async getWebhookEventsByStatus(
    status: 'pending' | 'delivered' | 'failed',
    limit = 20, 
    offset = 0
  ): Promise<WebhookEvent[]> {
    try {
      return await this.db
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.status, status))
        .orderBy(desc(webhookEvents.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get webhook events by status ${status}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据时间范围获取Webhook事件列表
   */
  async getWebhookEventsByDateRange(
    startDate: Date,
    endDate: Date,
    limit = 20,
    offset = 0,
    endpointId?: string,
    status?: 'pending' | 'delivered' | 'failed'
  ): Promise<WebhookEvent[]> {
    try {
      const conditions = [
        gte(webhookEvents.createdAt, startDate),
        lte(webhookEvents.createdAt, endDate)
      ];

      if (endpointId) {
        conditions.push(eq(webhookEvents.endpointId, endpointId));
      }

      if (status) {
        conditions.push(eq(webhookEvents.status, status));
      }

      return await this.db
        .select()
        .from(webhookEvents)
        .where(and(...conditions))
        .orderBy(desc(webhookEvents.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get webhook events by date range: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 更新Webhook事件
   */
  async updateWebhookEvent(id: string, updateData: UpdateWebhookEvent): Promise<WebhookEvent> {
    try {
      // 验证输入数据
      updateWebhookEventSchema.parse(updateData);

      // 检查事件是否存在
      await this.getWebhookEventById(id);

      const [updatedEvent] = await this.db
        .update(webhookEvents)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(webhookEvents.id, id))
        .returning();

      this.logger.log(`Webhook event updated: ${id}`);
      return updatedEvent;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update webhook event ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 删除Webhook事件
   */
  async deleteWebhookEvent(id: string): Promise<void> {
    try {
      // 检查事件是否存在
      await this.getWebhookEventById(id);

      await this.db
        .delete(webhookEvents)
        .where(eq(webhookEvents.id, id));

      this.logger.log(`Webhook event deleted: ${id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete webhook event ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 批量删除Webhook事件
   */
  async deleteWebhookEvents(ids: string[]): Promise<void> {
    try {
      if (ids.length === 0) {
        throw new BadRequestException('No webhook event IDs provided');
      }

      await this.db
        .delete(webhookEvents)
        .where(inArray(webhookEvents.id, ids));

      this.logger.log(`Webhook events deleted: ${ids.join(', ')}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete webhook events: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 重试失败的Webhook事件
   */
  async retryWebhookEvent(id: string): Promise<WebhookEvent> {
    try {
      const event = await this.getWebhookEventById(id);

      if (event.status !== 'failed') {
        throw new BadRequestException('Only failed webhook events can be retried');
      }

      // 获取端点信息
      const [endpoint] = await this.db
        .select()
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.id, event.endpointId));

      if (!endpoint) {
        throw new NotFoundException('Webhook endpoint not found');
      }

      if (!endpoint.enabled) {
        throw new BadRequestException('Webhook endpoint is disabled');
      }

      // 发送Webhook
      const result = await this.sendWebhook(endpoint.url, event.payload, endpoint.secret || '');

      // 更新事件状态
      const updateData: UpdateWebhookEvent = {
        status: result.success ? 'delivered' : 'failed',
        retryCount: event.retryCount + 1,
        responseCode: result.responseCode,
        responseBody: result.responseBody?.substring(0, 1000),
        errorMessage: result.errorMessage,
        deliveredAt: result.success ? new Date() : undefined,
      };

      return await this.updateWebhookEvent(id, updateData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to retry webhook event ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 批量重试失败的Webhook事件
   */
  async retryFailedWebhookEvents(endpointId?: string, maxRetries = 3): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    try {
      const conditions = [
        eq(webhookEvents.status, 'failed'),
        sql`${webhookEvents.retryCount} < ${maxRetries}`
      ];

      if (endpointId) {
        conditions.push(eq(webhookEvents.endpointId, endpointId));
      }

      const failedEvents = await this.db
        .select()
        .from(webhookEvents)
        .where(and(...conditions))
        .limit(100); // 限制批量处理数量

      let succeeded = 0;
      let failed = 0;

      for (const event of failedEvents) {
        try {
          await this.retryWebhookEvent(event.id);
          succeeded++;
        } catch (error) {
          failed++;
          this.logger.error(`Failed to retry webhook event ${event.id}: ${error}`);
        }
      }

      this.logger.log(`Batch retry completed: ${succeeded} succeeded, ${failed} failed`);

      return {
        processed: failedEvents.length,
        succeeded,
        failed,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to batch retry webhook events: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 获取Webhook事件统计信息
   */
  async getWebhookEventStats(
    endpointId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    total: number;
    pending: number;
    delivered: number;
    failed: number;
    successRate: number;
    avgRetryCount: number;
    recentEvents: WebhookEvent[];
  }> {
    try {
      const conditions = [];

      if (endpointId) {
        conditions.push(eq(webhookEvents.endpointId, endpointId));
      }

      if (startDate) {
        conditions.push(gte(webhookEvents.createdAt, startDate));
      }

      if (endDate) {
        conditions.push(lte(webhookEvents.createdAt, endDate));
      }

      const baseCondition = conditions.length > 0 ? and(...conditions) : undefined;

      // 获取总数统计
      const [totalResult] = await this.db
        .select({ count: count() })
        .from(webhookEvents)
        .where(baseCondition);

      const [pendingResult] = await this.db
        .select({ count: count() })
        .from(webhookEvents)
        .where(and(
          baseCondition || sql`1=1`,
          eq(webhookEvents.status, 'pending')
        ));

      const [deliveredResult] = await this.db
        .select({ count: count() })
        .from(webhookEvents)
        .where(and(
          baseCondition || sql`1=1`,
          eq(webhookEvents.status, 'delivered')
        ));

      const [failedResult] = await this.db
        .select({ count: count() })
        .from(webhookEvents)
        .where(and(
          baseCondition || sql`1=1`,
          eq(webhookEvents.status, 'failed')
        ));

      // 获取平均重试次数
      const [avgRetryResult] = await this.db
        .select({ avg: sql<number>`AVG(${webhookEvents.retryCount})` })
        .from(webhookEvents)
        .where(baseCondition);

      // 获取最近的事件
      const recentEvents = await this.db
        .select()
        .from(webhookEvents)
        .where(baseCondition)
        .orderBy(desc(webhookEvents.createdAt))
        .limit(10);

      const total = totalResult.count;
      const pending = pendingResult.count;
      const delivered = deliveredResult.count;
      const failed = failedResult.count;
      const successRate = total > 0 ? (delivered / total) * 100 : 0;
      const avgRetryCount = avgRetryResult.avg || 0;

      return {
        total,
        pending,
        delivered,
        failed,
        successRate,
        avgRetryCount,
        recentEvents,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get webhook event stats: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 搜索Webhook事件
   */
  async searchWebhookEvents(
    query: string,
    limit = 20,
    offset = 0,
    endpointId?: string,
    status?: 'pending' | 'delivered' | 'failed'
  ): Promise<WebhookEvent[]> {
    try {
      const searchPattern = `%${query}%`;
      const conditions = [
        or(
          ilike(webhookEvents.eventType, searchPattern),
          ilike(webhookEvents.errorMessage, searchPattern),
          ilike(webhookEvents.description, searchPattern)
        )
      ];

      if (endpointId) {
        conditions.push(eq(webhookEvents.endpointId, endpointId));
      }

      if (status) {
        conditions.push(eq(webhookEvents.status, status));
      }

      return await this.db
        .select()
        .from(webhookEvents)
        .where(and(...conditions))
        .orderBy(desc(webhookEvents.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to search webhook events: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 清理旧的Webhook事件
   */
  async cleanupOldWebhookEvents(daysToKeep = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const deletedEvents = await this.db
        .delete(webhookEvents)
        .where(lte(webhookEvents.createdAt, cutoffDate))
        .returning({ id: webhookEvents.id });

      const deletedCount = deletedEvents.length;
      this.logger.log(`Cleaned up ${deletedCount} old webhook events`);

      return deletedCount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to cleanup old webhook events: ${errorMessage}`);
      throw error;
    }
  }

  // 私有辅助方法

  /**
   * 发送Webhook请求
   */
  private async sendWebhook(
    url: string, 
    payload: any, 
    secret: string
  ): Promise<{
    success: boolean;
    responseCode?: number;
    responseBody?: string;
    errorMessage?: string;
  }> {
    try {
      const payloadString = JSON.stringify(payload);
      const signature = this.generateSignature(payloadString, secret);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'User-Agent': 'Juanie-Webhook/1.0',
        },
        body: payloadString,
      });

      const responseBody = await response.text();

      return {
        success: response.ok,
        responseCode: response.status,
        responseBody: responseBody.substring(0, 1000),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        errorMessage,
      };
    }
  }

  /**
   * 生成Webhook签名
   */
  private generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }
}