import * as schema from '@juanie/core/database'
import { Logger } from '@juanie/core/logger'
import { DATABASE } from '@juanie/core/tokens'
import type { GitProvider } from '@juanie/types'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { EncryptionService } from '../encryption/encryption.service'

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
    private readonly encryptionService: EncryptionService,
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
   * 注意：返回的 Token 是加密的，需要使用 getConnectionWithDecryptedTokens 获取明文
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
   * 获取 Git 连接（解密 Token）
   */
  async getConnectionWithDecryptedTokens(
    userId: string,
    provider: GitProvider,
    serverUrl?: string,
  ): Promise<schema.GitConnection | null> {
    const connection = await this.getConnectionByProvider(userId, provider, serverUrl)

    if (!connection) {
      return null
    }

    try {
      // 解密 Token
      const decryptedAccessToken = this.encryptionService.decrypt(connection.accessToken)
      const decryptedRefreshToken = connection.refreshToken
        ? this.encryptionService.decrypt(connection.refreshToken)
        : null

      return {
        ...connection,
        accessToken: decryptedAccessToken,
        refreshToken: decryptedRefreshToken,
      }
    } catch (error) {
      this.logger.error(`Failed to decrypt tokens for user ${userId}`, error)
      // 标记连接为过期
      await this.updateConnectionStatus(userId, provider, 'expired')
      throw new Error('Failed to decrypt tokens')
    }
  }

  /**
   * 检查用户是否已连接指定的 Git 平台
   */
  async hasProvider(userId: string, provider: GitProvider): Promise<boolean> {
    const connection = await this.getConnectionByProvider(userId, provider)
    return !!connection
  }

  /**
   * 创建或更新 Git 连接（加密 Token）
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
    // 加密 Token
    const encryptedAccessToken = this.encryptionService.encrypt(input.accessToken)
    const encryptedRefreshToken = input.refreshToken
      ? this.encryptionService.encrypt(input.refreshToken)
      : null

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
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
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
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
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
   * 刷新访问令牌（加密 Token）
   */
  async refreshAccessToken(
    userId: string,
    provider: GitProvider,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date,
  ): Promise<void> {
    // 加密新 Token
    const encryptedAccessToken = this.encryptionService.encrypt(accessToken)
    const encryptedRefreshToken = refreshToken ? this.encryptionService.encrypt(refreshToken) : null

    await this.db
      .update(schema.gitConnections)
      .set({
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
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

  /**
   * 刷新 GitLab Token（自动刷新过期的 Token）
   */
  async refreshGitLabToken(userId: string, provider: 'gitlab', serverUrl?: string): Promise<void> {
    const connection = await this.getConnectionWithDecryptedTokens(userId, provider, serverUrl)

    if (!connection || !connection.refreshToken) {
      this.logger.error(`No refresh token available for user ${userId}`)
      throw new Error('No refresh token available')
    }

    // 调用 GitLab API 刷新 Token
    const gitlabBase = (serverUrl || process.env.GITLAB_BASE_URL || 'https://gitlab.com').replace(
      /\/+$/,
      '',
    )

    try {
      const response = await fetch(`${gitlabBase}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.GITLAB_CLIENT_ID,
          client_secret: process.env.GITLAB_CLIENT_SECRET,
          refresh_token: connection.refreshToken,
          grant_type: 'refresh_token',
        }),
      })

      if (!response.ok) {
        // 刷新失败，标记为过期
        await this.updateConnectionStatus(userId, provider, 'expired')
        this.logger.error(`Failed to refresh GitLab token for user ${userId}: ${response.status}`)
        throw new Error('Failed to refresh GitLab token')
      }

      const tokens = (await response.json()) as {
        access_token: string
        refresh_token: string
        expires_in: number
      }

      // 更新 Token（自动加密）
      await this.refreshAccessToken(
        userId,
        provider,
        tokens.access_token,
        tokens.refresh_token,
        new Date(Date.now() + tokens.expires_in * 1000),
      )

      this.logger.info(`Successfully refreshed GitLab token for user ${userId}`)
    } catch (error) {
      // 刷新失败，标记为过期
      await this.updateConnectionStatus(userId, provider, 'expired')
      this.logger.error(`Failed to refresh GitLab token for user ${userId}`, error)
      throw error
    }
  }

  /**
   * 检查 Token 是否过期，如果过期则自动刷新
   */
  async ensureValidToken(userId: string, provider: 'gitlab', serverUrl?: string): Promise<string> {
    const connection = await this.getConnectionByProvider(userId, provider, serverUrl)

    if (!connection) {
      throw new Error('Git connection not found')
    }

    // 检查是否过期（提前 5 分钟刷新）
    const isExpired =
      connection.expiresAt && new Date(connection.expiresAt).getTime() < Date.now() + 5 * 60 * 1000

    if (isExpired && provider === 'gitlab') {
      this.logger.info(`Token expired for user ${userId}, refreshing...`)
      await this.refreshGitLabToken(userId, provider, serverUrl)
      // 重新获取连接
      const refreshedConnection = await this.getConnectionWithDecryptedTokens(
        userId,
        provider,
        serverUrl,
      )
      if (!refreshedConnection) {
        throw new Error('Failed to get refreshed connection')
      }
      return refreshedConnection.accessToken
    }

    // Token 未过期，解密并返回
    const decryptedConnection = await this.getConnectionWithDecryptedTokens(
      userId,
      provider,
      serverUrl,
    )
    if (!decryptedConnection) {
      throw new Error('Failed to decrypt connection')
    }
    return decryptedConnection.accessToken
  }
}
