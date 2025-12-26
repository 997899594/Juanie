import { DATABASE, REDIS } from '@juanie/core/tokens'
import { generateId } from '@juanie/core/utils'
import * as schema from '@juanie/database'
import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, ne } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type Redis from 'ioredis'
import { PinoLogger } from 'nestjs-pino'

/**
 * Session 管理服务
 *
 * 双存储策略：
 * - Redis: 快速访问和验证
 * - Database: 持久化和管理（查看、撤销）
 */
@Injectable()
export class SessionService {
  constructor(
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SessionService.name)
  }

  /**
   * 创建会话（Redis + Database）
   */
  async createSession(input: {
    userId: string
    ipAddress?: string
    userAgent?: string
    deviceInfo?: {
      browser?: string
      os?: string
      device?: string
    }
  }): Promise<string> {
    const sessionId = generateId()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // 存储到 Redis（7 天过期）
    await this.redis.setex(
      `session:${sessionId}`,
      7 * 24 * 60 * 60,
      JSON.stringify({ userId: input.userId, createdAt: Date.now() }),
    )

    // 存储到 Database
    await this.db.insert(schema.sessions).values({
      sessionId,
      userId: input.userId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      deviceInfo: input.deviceInfo,
      status: 'active',
      expiresAt,
    })

    this.logger.info(`Created session for user ${input.userId}`)
    return sessionId
  }

  /**
   * 验证会话
   */
  async validateSession(sessionId: string): Promise<{ userId: string } | null> {
    const data = await this.redis.get(`session:${sessionId}`)
    if (!data) {
      // 检查数据库中是否存在但已过期
      const [session] = await this.db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.sessionId, sessionId))
        .limit(1)

      if (session && session.status === 'active') {
        // Redis 中不存在但数据库中存在，标记为过期
        await this.markSessionExpired(sessionId)
      }

      return null
    }

    const session = JSON.parse(data) as { userId: string; createdAt: number }

    // 更新最后活动时间
    await this.updateLastActivity(sessionId)

    return { userId: session.userId }
  }

  /**
   * 获取用户的所有活跃会话
   */
  async listUserSessions(userId: string): Promise<schema.Session[]> {
    return await this.db
      .select()
      .from(schema.sessions)
      .where(and(eq(schema.sessions.userId, userId), eq(schema.sessions.status, 'active')))
      .orderBy(desc(schema.sessions.lastActivityAt))
  }

  /**
   * 获取指定会话信息
   */
  async getSession(sessionId: string): Promise<schema.Session | null> {
    const [session] = await this.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.sessionId, sessionId))
      .limit(1)

    return session || null
  }

  /**
   * 撤销指定会话
   */
  async revokeSession(sessionId: string): Promise<void> {
    // 从 Redis 删除
    await this.redis.del(`session:${sessionId}`)

    // 更新 Database 状态
    await this.db
      .update(schema.sessions)
      .set({ status: 'revoked', lastActivityAt: new Date() })
      .where(eq(schema.sessions.sessionId, sessionId))

    this.logger.info(`Revoked session ${sessionId}`)
  }

  /**
   * 撤销用户的所有会话（除了当前会话）
   */
  async revokeAllSessionsExceptCurrent(userId: string, currentSessionId: string): Promise<number> {
    // 获取所有活跃会话
    const sessions = await this.db
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.userId, userId),
          eq(schema.sessions.status, 'active'),
          ne(schema.sessions.sessionId, currentSessionId),
        ),
      )

    if (sessions.length === 0) {
      return 0
    }

    // 批量删除 Redis
    const pipeline = this.redis.pipeline()
    for (const session of sessions) {
      pipeline.del(`session:${session.sessionId}`)
    }
    await pipeline.exec()

    // 批量更新 Database
    await this.db
      .update(schema.sessions)
      .set({ status: 'revoked', lastActivityAt: new Date() })
      .where(
        and(
          eq(schema.sessions.userId, userId),
          eq(schema.sessions.status, 'active'),
          ne(schema.sessions.sessionId, currentSessionId),
        ),
      )

    this.logger.info(`Revoked ${sessions.length} sessions for user ${userId}`)
    return sessions.length
  }

  /**
   * 更新最后活动时间
   */
  private async updateLastActivity(sessionId: string): Promise<void> {
    await this.db
      .update(schema.sessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(schema.sessions.sessionId, sessionId))
  }

  /**
   * 标记会话为过期
   */
  private async markSessionExpired(sessionId: string): Promise<void> {
    await this.db
      .update(schema.sessions)
      .set({ status: 'expired', lastActivityAt: new Date() })
      .where(eq(schema.sessions.sessionId, sessionId))

    this.logger.info(`Marked session ${sessionId} as expired`)
  }

  /**
   * 删除会话（用于登出）
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.revokeSession(sessionId)
  }
}
