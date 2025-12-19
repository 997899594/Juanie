import * as schema from '@juanie/core/database'
import { Logger } from '@juanie/core/logger'
import { DATABASE } from '@juanie/core/tokens'
import type { GitProvider } from '@juanie/types'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

/**
 * Git 连接服务
 *
 * 统一管理用户的 Git 平台连接（OAuth 认证）
 * 替代原来的 OAuthAccountsService 和 GitAccountLinkingService
 */
@Injectable()
export class GitConnectionsService {
  private readonly logger: Logger

  constructor(
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    logger: Logger,
  ) {
    this.logger = logger
    this.logger.setContext(GitConnectionsService.name)
  }

  /**
   * 获取用户的所有 Git 连接
   */
  async listUserConnections(userId: string): Promise<schema.GitConnection[]> {
    return await this.db
      .select()
      .from(schema.gitConnections)
      .where(eq(schema.gitConnections.userId, userId))
  }

  /**
   * 根据 provider 获取用户的 Git 连接
   */
  async getConnectionByProvider(
    userId: string,
    provider: GitProvider,
    serverUrl?: string,
  ): Promise<schema.GitConnection | null> {
    const conditions = [
      eq(schema.gitConnections.userId, userId),
      eq(schema.gitConnections.provider, provider),
    ]

    // 如果指定了 serverUrl，添加到查询条件
    if (serverUrl) {
      conditions.push(eq(schema.gitConnections.serverUrl, serverUrl))
    }

    const [connection] = await this.db
      .select()
      .from(schema.gitConnections)
      .where(and(...conditions))
      .limit(1)

    return connection || null
  }

  /**
   * 检查用户是否已连接指定的 Git 平台
   */
  async hasProvider(userId: string, provider: GitProvider): Promise<boolean> {
    const connection = await this.getConnectionByProvider(userId, provider)
    return !!connection
  }

  /**
   * 创建或更新 Git 连接
   */
  async upsertConnection(input: {
    userId: string
    provider: GitProvider
    providerAccountId: string
    username: string
    email?: string
    avatarUrl?: string
    accessToken: string
    refreshToken?: string
    expiresAt?: Date
    serverUrl: string
    serverType?: 'cloud' | 'self-hosted'
    purpose?: 'auth' | 'integration' | 'both'
    metadata?: Record<string, any>
  }): Promise<schema.GitConnection> {
    // 检查是否已存在
    const existing = await this.getConnectionByProvider(
      input.userId,
      input.provider,
      input.serverUrl,
    )

    if (existing) {
      // 更新现有连接
      const [updated] = await this.db
        .update(schema.gitConnections)
        .set({
          providerAccountId: input.providerAccountId,
          username: input.username,
          email: input.email,
          avatarUrl: input.avatarUrl,
          accessToken: input.accessToken,
          refreshToken: input.refreshToken,
          expiresAt: input.expiresAt,
          status: 'active',
          purpose: input.purpose || 'both',
          metadata: input.metadata,
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.gitConnections.id, existing.id))
        .returning()

      if (!updated) {
        throw new Error('Failed to update Git connection')
      }

      this.logger.info(`Updated Git connection for user ${input.userId} (${input.provider})`)
      return updated
    }

    // 创建新连接
    const [created] = await this.db
      .insert(schema.gitConnections)
      .values({
        userId: input.userId,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        username: input.username,
        email: input.email,
        avatarUrl: input.avatarUrl,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        expiresAt: input.expiresAt,
        status: 'active',
        purpose: input.purpose || 'both',
        serverUrl: input.serverUrl,
        serverType: input.serverType || 'cloud',
        metadata: input.metadata,
        connectedAt: new Date(),
      })
      .returning()

    if (!created) {
      throw new Error('Failed to create Git connection')
    }

    this.logger.info(`Created Git connection for user ${input.userId} (${input.provider})`)
    return created
  }

  /**
   * 删除 Git 连接
   */
  async deleteConnection(userId: string, provider: GitProvider): Promise<void> {
    await this.db
      .delete(schema.gitConnections)
      .where(
        and(eq(schema.gitConnections.userId, userId), eq(schema.gitConnections.provider, provider)),
      )

    this.logger.info(`Deleted Git connection for user ${userId} (${provider})`)
  }

  /**
   * 更新连接状态
   */
  async updateConnectionStatus(
    userId: string,
    provider: GitProvider,
    status: 'active' | 'expired' | 'revoked',
  ): Promise<void> {
    await this.db
      .update(schema.gitConnections)
      .set({
        status,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(schema.gitConnections.userId, userId), eq(schema.gitConnections.provider, provider)),
      )

    this.logger.info(`Updated connection status for user ${userId} to ${status}`)
  }

  /**
   * 刷新访问令牌
   */
  async refreshAccessToken(
    userId: string,
    provider: GitProvider,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date,
  ): Promise<void> {
    await this.db
      .update(schema.gitConnections)
      .set({
        accessToken,
        refreshToken,
        expiresAt,
        status: 'active',
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(schema.gitConnections.userId, userId), eq(schema.gitConnections.provider, provider)),
      )

    this.logger.info(`Refreshed access token for user ${userId}`)
  }

  /**
   * 根据 ID 获取连接
   */
  async getConnectionById(id: string): Promise<schema.GitConnection | null> {
    const [connection] = await this.db
      .select()
      .from(schema.gitConnections)
      .where(eq(schema.gitConnections.id, id))
      .limit(1)

    return connection || null
  }
}
