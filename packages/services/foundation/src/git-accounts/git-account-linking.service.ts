import type { Database } from '@juanie/core/database'
import * as schema from '@juanie/core/database'
import { Logger } from '@juanie/core/logger'
import { DATABASE } from '@juanie/core/tokens'
import type { GitProvider } from '@juanie/types'
import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { EncryptionService } from '../encryption/encryption.service'

export interface LinkGitAccountInput {
  userId: string
  provider: GitProvider
  providerAccountId: string // Git 平台的用户 ID（原 gitUserId）
  username: string // Git 用户名（原 gitUsername）
  email?: string // Git 邮箱（原 gitEmail）
  avatarUrl?: string // Git 头像（原 gitAvatarUrl）
  accessToken: string
  refreshToken?: string
  expiresAt?: Date // Token 过期时间（原 tokenExpiresAt）
  // Git 服务器配置（必传，支持私有部署）
  serverUrl: string // 例如: https://github.com, https://gitlab.com, https://gitlab.company.com
  serverType?: 'cloud' | 'self-hosted' // 可选: 根据 serverUrl 自动判断
}

export interface GitAccountStatus {
  isLinked: boolean
  provider?: GitProvider
  username?: string // Git 用户名（原 gitUsername）
  status?: 'active' | 'expired' | 'revoked' // 连接状态（原 syncStatus）
  lastSyncAt?: Date
  connectedAt?: Date
}

@Injectable()
export class GitAccountLinkingService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly encryptionService: EncryptionService,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(GitAccountLinkingService.name)
  }

  /**
   * 关联用户的 Git 账号
   */
  async linkGitAccount(input: LinkGitAccountInput): Promise<schema.GitConnection> {
    this.logger.info(
      `Linking ${input.provider} account for user ${input.userId}: ${input.username}`,
    )

    // 加密 Token
    const encryptedAccessToken = await this.encryptionService.encrypt(input.accessToken)
    const encryptedRefreshToken = input.refreshToken
      ? await this.encryptionService.encrypt(input.refreshToken)
      : null

    // 检查是否已存在
    const existing = await this.db.query.gitConnections.findFirst({
      where: eq(schema.gitConnections.userId, input.userId),
    })

    if (existing) {
      // 更新现有记录
      const updated = await this.db
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
          connectedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.gitConnections.id, existing.id))
        .returning()

      this.logger.info(`Updated Git connection for user ${input.userId}`)
      const result = updated[0]
      if (!result) throw new Error('Failed to update Git connection')
      return result
    }

    // 创建新记录
    // 自动判断 serverType（如果未提供）
    const isCloudServer =
      input.serverUrl === 'https://github.com' ||
      input.serverUrl === 'https://gitlab.com' ||
      input.serverUrl === 'https://www.github.com' ||
      input.serverUrl === 'https://www.gitlab.com'
    const serverType = input.serverType ?? (isCloudServer ? 'cloud' : 'self-hosted')

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
        purpose: 'both',
        serverUrl: input.serverUrl,
        serverType,
      })
      .returning()

    this.logger.info(`Created Git connection for user ${input.userId}`)
    if (!created) throw new Error('Failed to create Git connection')
    return created
  }

  /**
   * 取消关联 Git 账号
   */
  async unlinkGitAccount(userId: string, provider: GitProvider): Promise<void> {
    this.logger.info(`Unlinking ${provider} account for user ${userId}`)

    await this.db.delete(schema.gitConnections).where(eq(schema.gitConnections.userId, userId))

    this.logger.info(`Unlinked Git account for user ${userId}`)
  }

  /**
   * 获取用户的 Git 账号状态
   */
  async getGitAccountStatus(userId: string, _provider: GitProvider): Promise<GitAccountStatus> {
    const connection = await this.db.query.gitConnections.findFirst({
      where: eq(schema.gitConnections.userId, userId),
    })

    if (!connection) {
      return { isLinked: false }
    }

    return {
      isLinked: true,
      provider: connection.provider as GitProvider,
      username: connection.username,
      status: connection.status as 'active' | 'expired' | 'revoked',
      lastSyncAt: connection.lastSyncAt || undefined,
      connectedAt: connection.connectedAt,
    }
  }

  /**
   * 获取用户的 Git 账号（包含解密的 Token）
   */
  async getGitAccount(
    userId: string,
    _provider: GitProvider,
  ): Promise<schema.GitConnection | null> {
    const connection = await this.db.query.gitConnections.findFirst({
      where: eq(schema.gitConnections.userId, userId),
    })

    if (!connection) {
      return null
    }

    // 解密 Token
    const decryptedAccessToken = await this.encryptionService.decrypt(connection.accessToken)
    const decryptedRefreshToken = connection.refreshToken
      ? await this.encryptionService.decrypt(connection.refreshToken)
      : null

    return {
      ...connection,
      accessToken: decryptedAccessToken,
      refreshToken: decryptedRefreshToken,
    }
  }

  /**
   * 更新同步状态
   */
  async updateSyncStatus(
    userId: string,
    _provider: GitProvider,
    status: 'active' | 'expired' | 'revoked',
  ): Promise<void> {
    await this.db
      .update(schema.gitConnections)
      .set({
        status: status,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.gitConnections.userId, userId))

    this.logger.info(`Updated sync status for user ${userId} to ${status}`)
  }

  /**
   * 刷新 Access Token
   */
  async refreshAccessToken(
    userId: string,
    _provider: GitProvider,
    newAccessToken: string,
    newRefreshToken?: string,
    expiresAt?: Date,
  ): Promise<void> {
    const encryptedAccessToken = await this.encryptionService.encrypt(newAccessToken)
    const encryptedRefreshToken = newRefreshToken
      ? await this.encryptionService.encrypt(newRefreshToken)
      : null

    await this.db
      .update(schema.gitConnections)
      .set({
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: expiresAt,
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(schema.gitConnections.userId, userId))

    this.logger.info(`Refreshed access token for user ${userId}`)
  }
}
