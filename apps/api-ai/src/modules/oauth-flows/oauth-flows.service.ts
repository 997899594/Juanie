import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import { Database } from '../../database/database.module';
import { eq, and, or, desc, lt, isNull, gte, count, inArray, ne, isNotNull } from 'drizzle-orm';
import { generateRandomString, alphabet } from 'oslo/crypto';
import {
  oauthFlows,
  OAuthFlow,
  NewOAuthFlow,
  insertOAuthFlowSchema,
  selectOAuthFlowSchema,
  OAuthProvider
} from '../../database/schemas/oauth-flows.schema';

export interface OAuthFlowInfo {
  id: string;
  provider: OAuthProvider;
  state: string;
  redirectUri?: string;
  isExpired: boolean;
  isUsed: boolean;
  createdAt: Date;
  expiresAt: Date;
}

export interface OAuthFlowStats {
  totalFlows: number;
  activeFlows: number;
  expiredFlows: number;
  usedFlows: number;
  errorFlows: number;
}

@Injectable()
export class OAuthFlowsService {
  private readonly logger = new Logger(OAuthFlowsService.name);

  constructor(@InjectDatabase() private readonly db: Database) {}

  /**
   * Hello method for testing
   */
  hello(): string {
    return 'Hello from OAuth Flows Service';
  }

  /**
   * 创建新的OAuth流程
   */
  async createOAuthFlow(
    provider: OAuthProvider,
    redirectUri?: string,
    expiresInMinutes: number = 10,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ flow: OAuthFlow; state: string; codeVerifier?: string }> {
    try {
      const state = generateRandomString(32, alphabet("a-z", "A-Z", "0-9"));
      const nonce = generateRandomString(16, alphabet("a-z", "A-Z", "0-9"));
      
      // 为PKCE生成code verifier
      const codeVerifier = generateRandomString(128, alphabet("a-z", "A-Z", "0-9") + "-._~");

      const flowData: NewOAuthFlow = {
        provider,
        state,
        nonce,
        codeVerifier,
        redirectUri: redirectUri || '',
        expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000),
        ipAddress,
        userAgent,
      };

      const [flow] = await this.db
        .insert(oauthFlows)
        .values(flowData)
        .returning();

      this.logger.log(`OAuth flow created: ${provider}, state: ${state}`);
      
      return {
        flow,
        state,
        codeVerifier,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create OAuth flow: ${errorMessage}`);
      throw new BadRequestException('Failed to create OAuth flow');
    }
  }

  /**
   * 根据state验证OAuth流程
   */
  async validateOAuthFlow(state: string, provider?: OAuthProvider): Promise<OAuthFlow | null> {
    try {
      const conditions = [
        eq(oauthFlows.state, state),
        isNull(oauthFlows.usedAt),
        isNull(oauthFlows.errorCode),
        lt(oauthFlows.expiresAt, new Date())
      ];

      if (provider) {
        conditions.push(eq(oauthFlows.provider, provider));
      }

      const [flow] = await this.db
        .select()
        .from(oauthFlows)
        .where(and(...conditions))
        .limit(1);

      if (!flow) {
        this.logger.warn(`Invalid or expired OAuth flow: ${state}`);
        return null;
      }

      return flow;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to validate OAuth flow: ${errorMessage}`);
      return null;
    }
  }

  /**
   * 标记OAuth流程为已使用
   */
  async markFlowAsUsed(flowId: string): Promise<boolean> {
    try {
      const [updatedFlow] = await this.db
        .update(oauthFlows)
        .set({
          usedAt: new Date(),
        })
        .where(and(
          eq(oauthFlows.id, flowId),
          isNull(oauthFlows.usedAt)
        ))
        .returning();

      if (!updatedFlow) {
        this.logger.warn(`OAuth flow not found or already used: ${flowId}`);
        return false;
      }

      this.logger.log(`OAuth flow marked as used: ${flowId}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to mark OAuth flow as used: ${errorMessage}`);
      return false;
    }
  }

  /**
   * 记录OAuth流程错误
   */
  async recordFlowError(
    flowId: string,
    errorCode: string,
    errorDescription?: string
  ): Promise<boolean> {
    try {
      const [updatedFlow] = await this.db
        .update(oauthFlows)
        .set({
          errorCode,
          errorDescription,
        })
        .where(eq(oauthFlows.id, flowId))
        .returning();

      if (!updatedFlow) {
        this.logger.warn(`OAuth flow not found: ${flowId}`);
        return false;
      }

      this.logger.log(`OAuth flow error recorded: ${flowId}, error: ${errorCode}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to record OAuth flow error: ${errorMessage}`);
      return false;
    }
  }

  /**
   * 根据state记录OAuth流程错误
   */
  async recordFlowErrorByState(
    state: string,
    errorCode: string,
    errorDescription?: string
  ): Promise<boolean> {
    try {
      const [updatedFlow] = await this.db
        .update(oauthFlows)
        .set({
          errorCode,
          errorDescription,
        })
        .where(eq(oauthFlows.state, state))
        .returning();

      if (!updatedFlow) {
        this.logger.warn(`OAuth flow not found for state: ${state}`);
        return false;
      }

      this.logger.log(`OAuth flow error recorded by state: ${state}, error: ${errorCode}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to record OAuth flow error by state: ${errorMessage}`);
      return false;
    }
  }

  /**
   * 获取OAuth流程详情
   */
  async getFlowById(flowId: string): Promise<OAuthFlow | null> {
    try {
      const [flow] = await this.db
        .select()
        .from(oauthFlows)
        .where(eq(oauthFlows.id, flowId))
        .limit(1);

      return flow || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get OAuth flow by ID: ${errorMessage}`);
      return null;
    }
  }

  /**
   * 根据state获取OAuth流程详情
   */
  async getFlowByState(state: string): Promise<OAuthFlow | null> {
    try {
      const [flow] = await this.db
        .select()
        .from(oauthFlows)
        .where(eq(oauthFlows.state, state))
        .limit(1);

      return flow || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get OAuth flow by state: ${errorMessage}`);
      return null;
    }
  }

  /**
   * 获取OAuth流程列表
   */
  async getFlows(
    provider?: OAuthProvider,
    limit: number = 50,
    offset: number = 0
  ): Promise<OAuthFlowInfo[]> {
    try {
      const whereCondition = provider ? eq(oauthFlows.provider, provider) : undefined;

      const flows = await this.db
        .select()
        .from(oauthFlows)
        .where(whereCondition)
        .orderBy(desc(oauthFlows.createdAt))
        .limit(limit)
        .offset(offset);

      return flows.map(flow => this.mapToFlowInfo(flow));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get OAuth flows: ${errorMessage}`);
      return [];
    }
  }

  /**
   * 获取OAuth流程统计信息
   */
  async getFlowStats(provider?: OAuthProvider): Promise<OAuthFlowStats> {
    try {
      const baseCondition = provider ? eq(oauthFlows.provider, provider) : undefined;

      const [totalResult] = await this.db
        .select({ count: count() })
        .from(oauthFlows)
        .where(baseCondition);

      const [activeResult] = await this.db
        .select({ count: count() })
        .from(oauthFlows)
        .where(and(
          baseCondition,
          isNull(oauthFlows.usedAt),
          isNull(oauthFlows.errorCode),
          gte(oauthFlows.expiresAt, new Date())
        ));

      const [expiredResult] = await this.db
        .select({ count: count() })
        .from(oauthFlows)
        .where(and(
          baseCondition,
          lt(oauthFlows.expiresAt, new Date())
        ));

      const [usedResult] = await this.db
        .select({ count: count() })
        .from(oauthFlows)
        .where(and(
          baseCondition,
          isNotNull(oauthFlows.usedAt)
        ));

      const [errorResult] = await this.db
        .select({ count: count() })
        .from(oauthFlows)
        .where(and(
          baseCondition,
          isNotNull(oauthFlows.errorCode)
        ));

      return {
        totalFlows: totalResult.count,
        activeFlows: activeResult.count,
        expiredFlows: expiredResult.count,
        usedFlows: usedResult.count,
        errorFlows: errorResult.count,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get OAuth flow stats: ${errorMessage}`);
      return {
        totalFlows: 0,
        activeFlows: 0,
        expiredFlows: 0,
        usedFlows: 0,
        errorFlows: 0,
      };
    }
  }

  /**
   * 清理过期的OAuth流程
   */
  async cleanupExpiredFlows(): Promise<number> {
    try {
      await this.db
        .delete(oauthFlows)
        .where(lt(oauthFlows.expiresAt, new Date()));

      this.logger.log(`Cleaned up expired OAuth flows`);
      return 1; // 简化返回值
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to cleanup expired OAuth flows: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * 清理旧的已使用或错误的OAuth流程
   */
  async cleanupOldFlows(olderThanHours: number = 24): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

      await this.db
        .delete(oauthFlows)
        .where(and(
          lt(oauthFlows.createdAt, cutoffDate),
          or(
            isNull(oauthFlows.usedAt),
            isNull(oauthFlows.errorCode)
          )
        ));

      this.logger.log(`Cleaned up old OAuth flows`);
      return 1; // 简化返回值
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to cleanup old OAuth flows: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * 删除特定的OAuth流程
   */
  async deleteFlow(flowId: string): Promise<boolean> {
    try {
      await this.db
        .delete(oauthFlows)
        .where(eq(oauthFlows.id, flowId));

      this.logger.log(`OAuth flow deleted: ${flowId}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to delete OAuth flow: ${errorMessage}`);
      return false;
    }
  }

  /**
   * 批量删除OAuth流程
   */
  async batchDeleteFlows(flowIds: string[]): Promise<number> {
    try {
      if (flowIds.length === 0) return 0;

      await this.db
        .delete(oauthFlows)
        .where(inArray(oauthFlows.id, flowIds));

      this.logger.log(`Batch deleted ${flowIds.length} OAuth flows`);
      return flowIds.length;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to batch delete OAuth flows: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * 检查OAuth流程是否有效
   */
  async isFlowValid(state: string, provider?: OAuthProvider): Promise<boolean> {
    try {
      const flow = await this.validateOAuthFlow(state, provider);
      return !!flow;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to check OAuth flow validity: ${errorMessage}`);
      return false;
    }
  }

  /**
   * 获取活跃的OAuth流程数量
   */
  async getActiveFlowCount(provider?: OAuthProvider): Promise<number> {
    try {
      const baseCondition = provider ? eq(oauthFlows.provider, provider) : undefined;

      const [result] = await this.db
        .select({ count: count() })
        .from(oauthFlows)
        .where(and(
          baseCondition,
          isNull(oauthFlows.usedAt),
          isNull(oauthFlows.errorCode),
          gte(oauthFlows.expiresAt, new Date())
        ));

      return result.count;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get active OAuth flow count: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * 将OAuth流程映射为流程信息
   */
  private mapToFlowInfo(flow: OAuthFlow): OAuthFlowInfo {
    const now = new Date();
    
    return {
      id: flow.id,
      provider: flow.provider,
      state: flow.state,
      redirectUri: flow.redirectUri || undefined,
      isExpired: flow.expiresAt ? flow.expiresAt < now : false,
      isUsed: !!flow.usedAt,
      createdAt: flow.createdAt,
      expiresAt: flow.expiresAt || now,
    };
  }
}