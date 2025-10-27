import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import type { Database } from '../../database/database.module';
import { eq, and, or, desc, lt, isNull, gte, count, inArray, ne, isNotNull } from 'drizzle-orm';
import { generateRandomString, alphabet, sha256 } from 'oslo/crypto';
import { encodeBase64url } from 'oslo/encoding';
import {
  authSessions,
  AuthSession,
  NewAuthSession,
  insertAuthSessionSchema,
  selectAuthSessionSchema
} from '../../database/schemas/auth-sessions.schema';
import { users, User } from '../../database/schemas/users.schema';

export interface SessionInfo {
  id: string;
  userId: string;
  lastUsedAt: Date | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  isCurrentSession?: boolean;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  revokedSessions: number;
}

@Injectable()
export class AuthSessionsService {
  private readonly logger = new Logger(AuthSessionsService.name);

  constructor(@InjectDatabase() private readonly db: Database) {}

  /**
   * 创建新的认证会话
   */
  async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    expiresInHours: number = 24
  ): Promise<{ session: AuthSession; sessionToken: string; refreshToken: string }> {
    try {
      const sessionToken = generateRandomString(32, alphabet("a-z", "A-Z", "0-9"));
      const refreshToken = generateRandomString(32, alphabet("a-z", "A-Z", "0-9"));
      
      const sessionTokenHash = encodeBase64url(await sha256(new TextEncoder().encode(sessionToken)));
      const refreshTokenHash = encodeBase64url(await sha256(new TextEncoder().encode(refreshToken)));

      const sessionData: NewAuthSession = {
        userId,
        sessionTokenHash,
        refreshTokenHash,
        accessExpiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
        refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天
        lastUsedAt: new Date(),
        ipAddress,
        userAgent,
      };

      const [session] = await this.db
        .insert(authSessions)
        .values(sessionData)
        .returning();

      this.logger.log(`Session created for user: ${userId}, session: ${session.id}`);
      
      return {
        session,
        sessionToken,
        refreshToken,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create session: ${errorMessage}`);
      throw new BadRequestException('Failed to create session');
    }
  }

  /**
   * 通过会话令牌验证会话
   */
  async validateSessionByToken(sessionToken: string): Promise<{ user: User; session: AuthSession } | null> {
    try {
      const sessionTokenHash = encodeBase64url(await sha256(new TextEncoder().encode(sessionToken)));

      const result = await this.db
        .select({
          session: authSessions,
          user: users,
        })
        .from(authSessions)
        .innerJoin(users, eq(authSessions.userId, users.id))
        .where(
          and(
            eq(authSessions.sessionTokenHash, sessionTokenHash),
            gte(authSessions.accessExpiresAt, new Date()),
            isNull(authSessions.revokedAt)
          )
        )
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      // 更新最后使用时间
      await this.updateSessionLastUsed(result[0].session.id);

      return {
        user: result[0].user,
        session: result[0].session,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to validate session by token: ${errorMessage}`);
      return null;
    }
  }

  /**
   * 通过会话ID验证会话
   */
  async validateSessionById(sessionId: string): Promise<{ user: User; session: AuthSession } | null> {
    try {
      const result = await this.db
        .select({
          session: authSessions,
          user: users,
        })
        .from(authSessions)
        .innerJoin(users, eq(authSessions.userId, users.id))
        .where(
          and(
            eq(authSessions.id, sessionId),
            gte(authSessions.accessExpiresAt, new Date()),
            isNull(authSessions.revokedAt)
          )
        )
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return {
        user: result[0].user,
        session: result[0].session,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to validate session by ID: ${errorMessage}`);
      return null;
    }
  }

  /**
   * 刷新会话
   */
  async refreshSession(refreshToken: string): Promise<{ session: AuthSession; sessionToken: string } | null> {
    try {
      const refreshTokenHash = encodeBase64url(await sha256(new TextEncoder().encode(refreshToken)));

      const [existingSession] = await this.db
        .select()
        .from(authSessions)
        .where(
          and(
            eq(authSessions.refreshTokenHash, refreshTokenHash),
            gte(authSessions.refreshExpiresAt, new Date()),
            isNull(authSessions.revokedAt)
          )
        )
        .limit(1);

      if (!existingSession) {
        return null;
      }

      // 生成新的会话令牌
      const newSessionToken = generateRandomString(32, alphabet("a-z", "A-Z", "0-9"));
      const newSessionTokenHash = encodeBase64url(await sha256(new TextEncoder().encode(newSessionToken)));

      const [updatedSession] = await this.db
        .update(authSessions)
        .set({
          sessionTokenHash: newSessionTokenHash,
          accessExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时
          lastUsedAt: new Date(),
        })
        .where(eq(authSessions.id, existingSession.id))
        .returning();

      this.logger.log(`Session refreshed: ${existingSession.id}`);

      return {
        session: updatedSession,
        sessionToken: newSessionToken,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to refresh session: ${errorMessage}`);
      return null;
    }
  }

  /**
   * 撤销会话（通过令牌）
   */
  async revokeSession(sessionToken: string): Promise<boolean> {
    try {
      const sessionTokenHash = encodeBase64url(await sha256(new TextEncoder().encode(sessionToken)));

      const result = await this.db
        .update(authSessions)
        .set({
          revokedAt: new Date(),
        })
        .where(
          and(
            eq(authSessions.sessionTokenHash, sessionTokenHash),
            isNull(authSessions.revokedAt)
          )
        )
        .returning();

      if (result.length === 0) {
        return false;
      }

      this.logger.log(`Session revoked: ${result[0].id}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to revoke session: ${errorMessage}`);
      return false;
    }
  }

  /**
   * 撤销会话（通过ID）
   */
  async revokeSessionById(sessionId: string): Promise<boolean> {
    try {
      const result = await this.db
        .update(authSessions)
        .set({
          revokedAt: new Date(),
        })
        .where(
          and(
            eq(authSessions.id, sessionId),
            isNull(authSessions.revokedAt)
          )
        )
        .returning();

      if (result.length === 0) {
        return false;
      }

      this.logger.log(`Session revoked by ID: ${sessionId}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to revoke session by ID: ${errorMessage}`);
      return false;
    }
  }

  /**
   * 撤销用户的所有会话
   */
  async revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
    try {
      let whereCondition = and(
        eq(authSessions.userId, userId),
        isNull(authSessions.revokedAt)
      );

      if (exceptSessionId) {
        whereCondition = and(
          whereCondition,
          ne(authSessions.id, exceptSessionId)
        );
      }

      const result = await this.db
        .update(authSessions)
        .set({
          revokedAt: new Date(),
        })
        .where(whereCondition)
        .returning();

      this.logger.log(`Revoked ${result.length} sessions for user: ${userId}`);
      return result.length;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to revoke all user sessions: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * 获取用户的活跃会话列表
   */
  async getUserActiveSessions(userId: string, currentSessionId?: string): Promise<SessionInfo[]> {
    try {
      const sessions = await this.db
        .select()
        .from(authSessions)
        .where(
          and(
            eq(authSessions.userId, userId),
            gte(authSessions.accessExpiresAt, new Date()),
            isNull(authSessions.revokedAt)
          )
        )
        .orderBy(desc(authSessions.lastUsedAt));

      return sessions.map(session => ({
        id: session.id,
        userId: session.userId,
        lastUsedAt: session.lastUsedAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        isCurrentSession: session.id === currentSessionId,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get user active sessions: ${errorMessage}`);
      return [];
    }
  }

  /**
   * 获取会话统计信息
   */
  async getSessionStats(userId?: string): Promise<SessionStats> {
    try {
      const baseCondition = userId ? eq(authSessions.userId, userId) : undefined;

      // 总会话数
      const [totalResult] = await this.db
        .select({ count: count() })
        .from(authSessions)
        .where(baseCondition);

      // 活跃会话数
      const [activeResult] = await this.db
        .select({ count: count() })
        .from(authSessions)
        .where(
          baseCondition
            ? and(
                baseCondition,
                gte(authSessions.accessExpiresAt, new Date()),
                isNull(authSessions.revokedAt)
              )
            : and(
                gte(authSessions.accessExpiresAt, new Date()),
                isNull(authSessions.revokedAt)
              )
        );

      // 过期会话数
      const [expiredResult] = await this.db
        .select({ count: count() })
        .from(authSessions)
        .where(
          baseCondition
            ? and(
                baseCondition,
                lt(authSessions.accessExpiresAt, new Date()),
                isNull(authSessions.revokedAt)
              )
            : and(
                lt(authSessions.accessExpiresAt, new Date()),
                isNull(authSessions.revokedAt)
              )
        );

      // 撤销会话数
      const [revokedResult] = await this.db
        .select({ count: count() })
        .from(authSessions)
        .where(
          baseCondition
            ? and(baseCondition, isNotNull(authSessions.revokedAt))
            : isNotNull(authSessions.revokedAt)
        );

      return {
        totalSessions: totalResult.count,
        activeSessions: activeResult.count,
        expiredSessions: expiredResult.count,
        revokedSessions: revokedResult.count,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get session stats: ${errorMessage}`);
      return {
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0,
        revokedSessions: 0,
      };
    }
  }

  /**
   * 更新会话最后使用时间
   */
  async updateSessionLastUsed(sessionId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    try {
      const updateData: any = {
        lastUsedAt: new Date(),
      };

      if (ipAddress) {
        updateData.ipAddress = ipAddress;
      }

      if (userAgent) {
        updateData.userAgent = userAgent;
      }

      await this.db
        .update(authSessions)
        .set(updateData)
        .where(eq(authSessions.id, sessionId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update session last used: ${errorMessage}`);
    }
  }

  /**
   * 清理过期的会话
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await this.db
        .delete(authSessions)
        .where(
          or(
            lt(authSessions.refreshExpiresAt, new Date()),
            and(
              isNotNull(authSessions.revokedAt),
              lt(authSessions.revokedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // 7天前撤销的
            )
          )
        )
        .returning();

      this.logger.log(`Cleaned up ${result.length} expired sessions`);
      return result.length;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to cleanup expired sessions: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * 删除旧的已撤销会话
   */
  async deleteOldRevokedSessions(olderThanDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

      const result = await this.db
        .delete(authSessions)
        .where(
          and(
            isNotNull(authSessions.revokedAt),
            lt(authSessions.revokedAt, cutoffDate)
          )
        )
        .returning();

      this.logger.log(`Deleted ${result.length} old revoked sessions`);
      return result.length;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete old revoked sessions: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * 检查会话是否有效
   */
  async isSessionValid(sessionToken: string): Promise<boolean> {
    try {
      const sessionTokenHash = encodeBase64url(await sha256(new TextEncoder().encode(sessionToken)));

      const [session] = await this.db
        .select()
        .from(authSessions)
        .where(
          and(
            eq(authSessions.sessionTokenHash, sessionTokenHash),
            gte(authSessions.accessExpiresAt, new Date()),
            isNull(authSessions.revokedAt)
          )
        )
        .limit(1);

      return !!session;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to check session validity: ${errorMessage}`);
      return false;
    }
  }

  /**
   * 获取会话详情
   */
  async getSessionDetails(sessionId: string): Promise<AuthSession | null> {
    try {
      const [session] = await this.db
        .select()
        .from(authSessions)
        .where(eq(authSessions.id, sessionId))
        .limit(1);

      return session || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get session details: ${errorMessage}`);
      return null;
    }
  }

  /**
   * 批量撤销会话
   */
  async batchRevokeSessions(sessionIds: string[]): Promise<number> {
    try {
      if (sessionIds.length === 0) {
        return 0;
      }

      const result = await this.db
        .update(authSessions)
        .set({
          revokedAt: new Date(),
        })
        .where(
          and(
            inArray(authSessions.id, sessionIds),
            isNull(authSessions.revokedAt)
          )
        )
        .returning();

      this.logger.log(`Batch revoked ${result.length} sessions`);
      return result.length;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to batch revoke sessions: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * 获取活跃会话数量
   */
  async getActiveSessionCount(userId: string): Promise<number> {
    try {
      const [result] = await this.db
        .select({ count: count() })
        .from(authSessions)
        .where(
          and(
            eq(authSessions.userId, userId),
            gte(authSessions.accessExpiresAt, new Date()),
            isNull(authSessions.revokedAt)
          )
        );

      return result.count;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get active session count: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * 清理不活跃的会话
   */
  async cleanupInactiveSessions(userId: string): Promise<number> {
    try {
      const inactiveDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30天前

      const result = await this.db
        .update(authSessions)
        .set({
          revokedAt: new Date(),
        })
        .where(
          and(
            eq(authSessions.userId, userId),
            lt(authSessions.lastUsedAt, inactiveDate),
            isNull(authSessions.revokedAt)
          )
        )
        .returning();

      this.logger.log(`Cleaned up ${result.length} inactive sessions for user: ${userId}`);
      return result.length;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to cleanup inactive sessions: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * 批量删除会话
   */
  async batchDeleteSessions(sessionIds: string[]): Promise<number> {
    try {
      if (sessionIds.length === 0) {
        return 0;
      }

      const result = await this.db
        .delete(authSessions)
        .where(inArray(authSessions.id, sessionIds))
        .returning();

      this.logger.log(`Batch deleted ${result.length} sessions`);
      return result.length;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to batch delete sessions: ${errorMessage}`);
      return 0;
    }
  }

  hello(): string {
    return 'Hello from AuthSessionsService!';
  }
}