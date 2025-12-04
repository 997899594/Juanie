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
  gitUserId: string
  gitUsername: string
  gitEmail?: string
  gitAvatarUrl?: string
  accessToken: string
  refreshToken?: string
  tokenExpiresAt?: Date
}

export interface GitAccountStatus {
  isLinked: boolean
  provider?: GitProvider
  gitUsername?: string
  syncStatus?: 'active' | 'expired' | 'revoked'
  lastSyncAt?: Date
  connectedAt?: Date
}

@Injectable()
export class GitAccountLinkingService {
  private readonly logger = new Logger(GitAccountLinkingService.name)

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * 关联用户的 Git 账号
   */
  async linkGitAccount(input: LinkGitAccountInput): Promise<schema.UserGitAccount> {
    this.logger.log(
      `Linking ${input.provider} account for user ${input.userId}: ${input.gitUsername}`,
    )

    // 加密 Token
    const encryptedAccessToken = await this.encryptionService.encrypt(input.accessToken)
    const encryptedRefreshToken = input.refreshToken
      ? await this.encryptionService.encrypt(input.refreshToken)
      : null

    // 检查是否已存在
    const existing = await this.db.query.userGitAccounts.findFirst({
      where: eq(schema.userGitAccounts.userId, input.userId),
    })

    if (existing) {
      // 更新现有记录
      const updated = await this.db
        .update(schema.userGitAccounts)
        .set({
          gitUserId: input.gitUserId,
          gitUsername: input.gitUsername,
          gitEmail: input.gitEmail,
          gitAvatarUrl: input.gitAvatarUrl,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt: input.tokenExpiresAt,
          syncStatus: 'active',
          connectedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.userGitAccounts.id, existing.id))
        .returning()

      this.logger.log(`Updated Git account link for user ${input.userId}`)
      const result = updated[0]
      if (!result) throw new Error('Failed to update Git account')
      return result
    }

    // 创建新记录
    const [created] = await this.db
      .insert(schema.userGitAccounts)
      .values({
        userId: input.userId,
        provider: input.provider,
        gitUserId: input.gitUserId,
        gitUsername: input.gitUsername,
        gitEmail: input.gitEmail,
        gitAvatarUrl: input.gitAvatarUrl,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: input.tokenExpiresAt,
        syncStatus: 'active',
      })
      .returning()

    this.logger.log(`Created Git account link for user ${input.userId}`)
    if (!created) throw new Error('Failed to create Git account')
    return created
  }

  /**
   * 取消关联 Git 账号
   */
  async unlinkGitAccount(userId: string, provider: GitProvider): Promise<void> {
    this.logger.log(`Unlinking ${provider} account for user ${userId}`)

    await this.db.delete(schema.userGitAccounts).where(eq(schema.userGitAccounts.userId, userId))

    this.logger.log(`Unlinked Git account for user ${userId}`)
  }

  /**
   * 获取用户的 Git 账号状态
   */
  async getGitAccountStatus(userId: string, _provider: GitProvider): Promise<GitAccountStatus> {
    const account = await this.db.query.userGitAccounts.findFirst({
      where: eq(schema.userGitAccounts.userId, userId),
    })

    if (!account) {
      return { isLinked: false }
    }

    return {
      isLinked: true,
      provider: account.provider as GitProvider,
      gitUsername: account.gitUsername,
      syncStatus: account.syncStatus as 'active' | 'expired' | 'revoked',
      lastSyncAt: account.lastSyncAt || undefined,
      connectedAt: account.connectedAt,
    }
  }

  /**
   * 获取用户的 Git 账号（包含解密的 Token）
   */
  async getGitAccount(
    userId: string,
    _provider: GitProvider,
  ): Promise<schema.UserGitAccount | null> {
    const account = await this.db.query.userGitAccounts.findFirst({
      where: eq(schema.userGitAccounts.userId, userId),
    })

    if (!account) {
      return null
    }

    // 解密 Token
    const decryptedAccessToken = await this.encryptionService.decrypt(account.accessToken)
    const decryptedRefreshToken = account.refreshToken
      ? await this.encryptionService.decrypt(account.refreshToken)
      : null

    return {
      ...account,
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
      .update(schema.userGitAccounts)
      .set({
        syncStatus: status,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.userGitAccounts.userId, userId))

    this.logger.log(`Updated sync status for user ${userId} to ${status}`)
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
      .update(schema.userGitAccounts)
      .set({
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: expiresAt,
        syncStatus: 'active',
        updatedAt: new Date(),
      })
      .where(eq(schema.userGitAccounts.userId, userId))

    this.logger.log(`Refreshed access token for user ${userId}`)
  }
}
