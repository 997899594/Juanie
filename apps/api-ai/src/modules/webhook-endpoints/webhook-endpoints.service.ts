import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import { Database } from '../../database/database.module';
import { eq, and, desc, asc, count, sql, ilike, inArray, gte, lte, or, isNull } from 'drizzle-orm';
import { 
  webhookEndpoints, 
  WebhookEndpoint, 
  NewWebhookEndpoint,
  UpdateWebhookEndpoint,
  insertWebhookEndpointSchema,
  updateWebhookEndpointSchema 
} from '../../database/schemas/webhook-endpoints.schema';
import { webhookEvents } from '../../database/schemas/webhook-events.schema';
import * as crypto from 'crypto';

@Injectable()
export class WebhookEndpointsService {
  private readonly logger = new Logger(WebhookEndpointsService.name);

  constructor(
    @InjectDatabase() private readonly db: Database,
  ) {}

  /**
   * 创建新的Webhook端点
   */
  async createWebhookEndpoint(endpointData: NewWebhookEndpoint): Promise<WebhookEndpoint> {
    try {
      // 验证输入数据
      insertWebhookEndpointSchema.parse(endpointData);
      
      // 检查URL是否已存在（同组织或项目内）
      if (endpointData.organizationId) {
        const existingEndpoint = await this.findByUrlInOrganization(
          endpointData.organizationId, 
          endpointData.url
        );
        if (existingEndpoint) {
          throw new ConflictException('Webhook endpoint URL already exists in this organization');
        }
      }

      if (endpointData.projectId) {
        const existingEndpoint = await this.findByUrlInProject(
          endpointData.projectId, 
          endpointData.url
        );
        if (existingEndpoint) {
          throw new ConflictException('Webhook endpoint URL already exists in this project');
        }
      }

      // 如果没有提供secret，自动生成一个
      if (!endpointData.secret) {
        endpointData.secret = this.generateSecret();
      }

      const [newEndpoint] = await this.db
        .insert(webhookEndpoints)
        .values(endpointData)
        .returning();

      this.logger.log(`Webhook endpoint created: ${newEndpoint.id}`);
      return newEndpoint;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create webhook endpoint: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据ID获取Webhook端点
   */
  async getWebhookEndpointById(id: string): Promise<WebhookEndpoint> {
    try {
      const [endpoint] = await this.db
        .select()
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.id, id));

      if (!endpoint) {
        throw new NotFoundException(`Webhook endpoint with ID ${id} not found`);
      }

      return endpoint;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get webhook endpoint by ID ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据组织ID获取Webhook端点列表
   */
  async getWebhookEndpointsByOrganization(
    organizationId: string, 
    limit = 20, 
    offset = 0,
    enabled?: boolean
  ): Promise<WebhookEndpoint[]> {
    try {
      const conditions = [eq(webhookEndpoints.organizationId, organizationId)];
      
      if (enabled !== undefined) {
        conditions.push(eq(webhookEndpoints.enabled, enabled));
      }

      return await this.db
        .select()
        .from(webhookEndpoints)
        .where(and(...conditions))
        .orderBy(desc(webhookEndpoints.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get webhook endpoints by organization ${organizationId}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据项目ID获取Webhook端点列表
   */
  async getWebhookEndpointsByProject(
    projectId: string, 
    limit = 20, 
    offset = 0,
    enabled?: boolean
  ): Promise<WebhookEndpoint[]> {
    try {
      const conditions = [eq(webhookEndpoints.projectId, projectId)];
      
      if (enabled !== undefined) {
        conditions.push(eq(webhookEndpoints.enabled, enabled));
      }

      return await this.db
        .select()
        .from(webhookEndpoints)
        .where(and(...conditions))
        .orderBy(desc(webhookEndpoints.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get webhook endpoints by project ${projectId}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 更新Webhook端点
   */
  async updateWebhookEndpoint(id: string, updateData: UpdateWebhookEndpoint): Promise<WebhookEndpoint> {
    try {
      // 验证输入数据
      updateWebhookEndpointSchema.parse(updateData);

      // 检查端点是否存在
      const existingEndpoint = await this.getWebhookEndpointById(id);

      // 如果更新URL，检查是否冲突
      if (updateData.url && updateData.url !== existingEndpoint.url) {
        if (existingEndpoint.organizationId) {
          const conflictEndpoint = await this.findByUrlInOrganization(
            existingEndpoint.organizationId, 
            updateData.url
          );
          if (conflictEndpoint && conflictEndpoint.id !== id) {
            throw new ConflictException('Webhook endpoint URL already exists in this organization');
          }
        }

        if (existingEndpoint.projectId) {
          const conflictEndpoint = await this.findByUrlInProject(
            existingEndpoint.projectId, 
            updateData.url
          );
          if (conflictEndpoint && conflictEndpoint.id !== id) {
            throw new ConflictException('Webhook endpoint URL already exists in this project');
          }
        }
      }

      const [updatedEndpoint] = await this.db
        .update(webhookEndpoints)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(webhookEndpoints.id, id))
        .returning();

      this.logger.log(`Webhook endpoint updated: ${id}`);
      return updatedEndpoint;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update webhook endpoint ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 删除Webhook端点
   */
  async deleteWebhookEndpoint(id: string): Promise<void> {
    try {
      // 检查端点是否存在
      await this.getWebhookEndpointById(id);

      await this.db
        .delete(webhookEndpoints)
        .where(eq(webhookEndpoints.id, id));

      this.logger.log(`Webhook endpoint deleted: ${id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete webhook endpoint ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 批量删除Webhook端点
   */
  async deleteWebhookEndpoints(ids: string[]): Promise<void> {
    try {
      if (ids.length === 0) {
        throw new BadRequestException('No webhook endpoint IDs provided');
      }

      await this.db
        .delete(webhookEndpoints)
        .where(inArray(webhookEndpoints.id, ids));

      this.logger.log(`Webhook endpoints deleted: ${ids.join(', ')}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete webhook endpoints: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 启用/禁用Webhook端点
   */
  async toggleWebhookEndpoint(id: string, enabled: boolean): Promise<WebhookEndpoint> {
    try {
      const [updatedEndpoint] = await this.db
        .update(webhookEndpoints)
        .set({
          enabled,
          updatedAt: new Date(),
        })
        .where(eq(webhookEndpoints.id, id))
        .returning();

      if (!updatedEndpoint) {
        throw new NotFoundException(`Webhook endpoint with ID ${id} not found`);
      }

      this.logger.log(`Webhook endpoint ${enabled ? 'enabled' : 'disabled'}: ${id}`);
      return updatedEndpoint;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to toggle webhook endpoint ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 重新生成Webhook端点的secret
   */
  async regenerateSecret(id: string): Promise<WebhookEndpoint> {
    try {
      const newSecret = this.generateSecret();

      const [updatedEndpoint] = await this.db
        .update(webhookEndpoints)
        .set({
          secret: newSecret,
          updatedAt: new Date(),
        })
        .where(eq(webhookEndpoints.id, id))
        .returning();

      if (!updatedEndpoint) {
        throw new NotFoundException(`Webhook endpoint with ID ${id} not found`);
      }

      this.logger.log(`Webhook endpoint secret regenerated: ${id}`);
      return updatedEndpoint;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to regenerate secret for webhook endpoint ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 测试Webhook端点
   */
  async testWebhookEndpoint(id: string, testPayload?: any): Promise<{
    success: boolean;
    responseCode?: number;
    responseBody?: string;
    errorMessage?: string;
  }> {
    try {
      const endpoint = await this.getWebhookEndpointById(id);

      const payload = testPayload || {
        eventType: 'webhook.test',
        timestamp: new Date().toISOString(),
        data: { message: 'This is a test webhook event' }
      };

      // 生成签名
      const signature = this.generateSignature(JSON.stringify(payload), endpoint.secret || '');

      // 发送测试请求
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'User-Agent': 'Juanie-Webhook/1.0',
          ...(endpoint.settings?.headers || {})
        },
        body: JSON.stringify(payload),
      });

      const responseBody = await response.text();

      // 更新端点状态
      if (response.ok) {
        await this.updateEndpointStatus(id, true, response.status, responseBody.substring(0, 1000));
      } else {
        await this.updateEndpointStatus(id, false, response.status, responseBody.substring(0, 1000));
      }

      return {
        success: response.ok,
        responseCode: response.status,
        responseBody: responseBody.substring(0, 1000),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to test webhook endpoint ${id}: ${errorMessage}`);
      
      // 更新端点状态为失败
      await this.updateEndpointStatus(id, false, undefined, undefined, errorMessage);

      return {
        success: false,
        errorMessage,
      };
    }
  }

  /**
   * 获取Webhook端点统计信息
   */
  async getWebhookEndpointStats(id: string): Promise<{
    totalEvents: number;
    deliveredEvents: number;
    failedEvents: number;
    pendingEvents: number;
    successRate: number;
    lastSuccessAt?: Date;
    lastFailureAt?: Date;
    failureCount: number;
  }> {
    try {
      // 获取端点信息
      const endpoint = await this.getWebhookEndpointById(id);

      // 获取事件统计
      const [totalResult] = await this.db
        .select({ count: count() })
        .from(webhookEvents)
        .where(eq(webhookEvents.endpointId, id));

      const [deliveredResult] = await this.db
        .select({ count: count() })
        .from(webhookEvents)
        .where(and(
          eq(webhookEvents.endpointId, id),
          eq(webhookEvents.status, 'delivered')
        ));

      const [failedResult] = await this.db
        .select({ count: count() })
        .from(webhookEvents)
        .where(and(
          eq(webhookEvents.endpointId, id),
          eq(webhookEvents.status, 'failed')
        ));

      const [pendingResult] = await this.db
        .select({ count: count() })
        .from(webhookEvents)
        .where(and(
          eq(webhookEvents.endpointId, id),
          eq(webhookEvents.status, 'pending')
        ));

      const totalEvents = totalResult.count;
      const deliveredEvents = deliveredResult.count;
      const failedEvents = failedResult.count;
      const pendingEvents = pendingResult.count;
      const successRate = totalEvents > 0 ? (deliveredEvents / totalEvents) * 100 : 0;

      return {
        totalEvents,
        deliveredEvents,
        failedEvents,
        pendingEvents,
        successRate,
        lastSuccessAt: endpoint.lastSuccessAt || undefined,
        lastFailureAt: endpoint.lastFailureAt || undefined,
        failureCount: parseInt(endpoint.failureCount || '0'),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get webhook endpoint stats for ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 搜索Webhook端点
   */
  async searchWebhookEndpoints(
    query: string,
    organizationId?: string,
    projectId?: string,
    limit = 20,
    offset = 0
  ): Promise<WebhookEndpoint[]> {
    try {
      const searchPattern = `%${query}%`;
      const conditions = [
        or(
          ilike(webhookEndpoints.name, searchPattern),
          ilike(webhookEndpoints.url, searchPattern),
          ilike(webhookEndpoints.description, searchPattern)
        )
      ];

      if (organizationId) {
        conditions.push(eq(webhookEndpoints.organizationId, organizationId));
      }

      if (projectId) {
        conditions.push(eq(webhookEndpoints.projectId, projectId));
      }

      return await this.db
        .select()
        .from(webhookEndpoints)
        .where(and(...conditions))
        .orderBy(desc(webhookEndpoints.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to search webhook endpoints: ${errorMessage}`);
      throw error;
    }
  }

  // 私有辅助方法

  /**
   * 根据组织和URL查找端点
   */
  private async findByUrlInOrganization(organizationId: string, url: string): Promise<WebhookEndpoint | null> {
    const [endpoint] = await this.db
      .select()
      .from(webhookEndpoints)
      .where(and(
        eq(webhookEndpoints.organizationId, organizationId),
        eq(webhookEndpoints.url, url)
      ));

    return endpoint || null;
  }

  /**
   * 根据项目和URL查找端点
   */
  private async findByUrlInProject(projectId: string, url: string): Promise<WebhookEndpoint | null> {
    const [endpoint] = await this.db
      .select()
      .from(webhookEndpoints)
      .where(and(
        eq(webhookEndpoints.projectId, projectId),
        eq(webhookEndpoints.url, url)
      ));

    return endpoint || null;
  }

  /**
   * 生成随机secret
   */
  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
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

  /**
   * 更新端点状态
   */
  private async updateEndpointStatus(
    id: string,
    success: boolean,
    responseCode?: number,
    responseBody?: string,
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (success) {
      updateData.lastSuccessAt = new Date();
      updateData.failureCount = '0';
    } else {
      updateData.lastFailureAt = new Date();
      // 增加失败计数
      const endpoint = await this.getWebhookEndpointById(id);
      const currentFailureCount = parseInt(endpoint.failureCount || '0');
      updateData.failureCount = (currentFailureCount + 1).toString();
    }

    await this.db
      .update(webhookEndpoints)
      .set(updateData)
      .where(eq(webhookEndpoints.id, id));
  }
}