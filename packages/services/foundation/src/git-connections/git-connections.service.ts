import { decrypt, encrypt, getEncryptionKey } from '@juanie/core/encryption'
import { K8sClientService } from '@juanie/core/k8s'
import { DATABASE } from '@juanie/core/tokens'
import * as schema from '@juanie/database'
import type { GitProvider } from '@juanie/types'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { and, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { PinoLogger } from 'nestjs-pino'
import {
  GitConnectionInvalidError,
  GitConnectionNotFoundError,
  OperationFailedError,
  TokenDecryptionError,
  TokenRefreshError,
} from '../errors'

/**
 * Git 连接服务
 *
 * 统一管理用户的 Git 平台连接（OAuth 认证）和项目凭证
 * 替代原来的 OAuthAccountsService、GitAccountLinkingService 和 CredentialManagerService
 */
@Injectable()
export class GitConnectionsService {
  private readonly logger: PinoLogger
  private readonly encryptionKey: string

  constructor(
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly k8s: K8sClientService,
    config: ConfigService,
    logger: PinoLogger,
  ) {
    this.logger = logger
    this.logger.setContext(GitConnectionsService.name)
    this.encryptionKey = getEncryptionKey(config)
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
      const decryptedAccessToken = decrypt(connection.accessToken, this.encryptionKey)
      const decryptedRefreshToken = connection.refreshToken
        ? decrypt(connection.refreshToken, this.encryptionKey)
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
      throw new TokenDecryptionError(provider)
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
    const encryptedAccessToken = encrypt(input.accessToken, this.encryptionKey)
    const encryptedRefreshToken = input.refreshToken
      ? encrypt(input.refreshToken, this.encryptionKey)
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
        throw new OperationFailedError('updateGitConnection', 'Database update returned no result')
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
      throw new OperationFailedError('createGitConnection', 'Database insert returned no result')
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
    const encryptedAccessToken = encrypt(accessToken, this.encryptionKey)
    const encryptedRefreshToken = refreshToken ? encrypt(refreshToken, this.encryptionKey) : null

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
   * 获取项目的 Git 认证配置
   * 用于 GitSync 等服务查询项目的 Git 凭证
   */
  async getProjectAuth(
    projectId: string,
  ): Promise<typeof schema.projectGitAuth.$inferSelect | null> {
    const [auth] = await this.db
      .select()
      .from(schema.projectGitAuth)
      .where(eq(schema.projectGitAuth.projectId, projectId))
      .limit(1)

    return auth || null
  }

  /**
   * 刷新 GitLab Token（自动刷新过期的 Token）
   */
  async refreshGitLabToken(userId: string, provider: 'gitlab', serverUrl?: string): Promise<void> {
    const connection = await this.getConnectionWithDecryptedTokens(userId, provider, serverUrl)

    if (!connection || !connection.refreshToken) {
      this.logger.error(`No refresh token available for user ${userId}`)
      throw new GitConnectionInvalidError(provider, 'No refresh token available')
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
        throw new TokenRefreshError(provider, `HTTP ${response.status}`)
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
      throw new GitConnectionNotFoundError(provider, userId)
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
        throw new OperationFailedError(
          'getRefreshedConnection',
          'Failed to retrieve connection after refresh',
        )
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
      throw new TokenDecryptionError(provider)
    }
    return decryptedConnection.accessToken
  }

  /**
   * 解析 Git 凭证（统一入口）
   *
   * 用于项目初始化、仓库操作、GitOps 资源创建等场景
   *
   * @param userId - 用户 ID
   * @param provider - Git 提供商 (github | gitlab)
   * @returns 包含 accessToken 和 username 的凭证对象
   */
  async resolveCredentials(
    userId: string,
    provider: 'github' | 'gitlab',
  ): Promise<{
    accessToken: string
    username: string
    email?: string
  }> {
    this.logger.info(`Resolving Git credentials for user ${userId}, provider: ${provider}`)

    const gitConnection = await this.getConnectionWithDecryptedTokens(userId, provider)

    if (!gitConnection) {
      throw new GitConnectionNotFoundError(provider, userId)
    }

    if (!gitConnection.accessToken || gitConnection.status !== 'active') {
      throw new GitConnectionInvalidError(provider, 'Token is invalid or connection is not active')
    }

    if (!gitConnection.username) {
      throw new GitConnectionInvalidError(provider, 'Username is missing from connection')
    }

    this.logger.info(`✅ Resolved credentials for ${provider}, username: ${gitConnection.username}`)

    return {
      accessToken: gitConnection.accessToken,
      username: gitConnection.username,
      email: gitConnection.email || undefined,
    }
  }

  /**
   * 解析仓库配置（兼容 __USE_OAUTH__ 标记）
   *
   * 用于项目初始化时解析仓库配置，自动处理 OAuth 凭证
   *
   * @param userId - 用户 ID
   * @param repository - 仓库配置对象
   * @returns 解析后的仓库配置（包含 accessToken 和 username）
   */
  async resolveRepositoryConfig(userId: string, repository: any): Promise<any> {
    // 如果不是使用 OAuth，直接返回
    if (repository.accessToken !== '__USE_OAUTH__') {
      return repository
    }

    const credentials = await this.resolveCredentials(userId, repository.provider)

    return {
      ...repository,
      accessToken: credentials.accessToken,
      username: credentials.username,
      email: credentials.email,
    }
  }

  // ==================== 项目凭证管理 ====================

  /**
   * 获取项目的访问令牌（解密）
   * 直接返回 token 和 username，不需要复杂的 Credential 对象
   */
  async getProjectAccessToken(projectId: string): Promise<{
    token: string
    username: string
    provider: 'github' | 'gitlab'
  }> {
    const [authRecord] = await this.db
      .select()
      .from(schema.projectGitAuth)
      .where(eq(schema.projectGitAuth.projectId, projectId))
      .limit(1)

    if (!authRecord) {
      throw new Error(`No credential found for project ${projectId}`)
    }

    // OAuth 类型：从 Git 连接获取
    if (authRecord.authType === 'oauth') {
      if (!authRecord.oauthAccountId) {
        throw new Error('OAuth account ID is missing')
      }

      const gitConnection = await this.getConnectionById(authRecord.oauthAccountId)
      if (!gitConnection) {
        throw new Error('Git connection not found')
      }

      // 解密 token
      const token = decrypt(gitConnection.accessToken, this.encryptionKey)
      const provider = gitConnection.provider as 'github' | 'gitlab'

      return {
        token,
        username: gitConnection.username,
        provider,
      }
    }

    // PAT 类型：直接解密
    if (authRecord.authType === 'project_token' || authRecord.authType === 'pat') {
      if (!authRecord.projectToken) {
        throw new Error('Project token is missing')
      }

      const token = decrypt(authRecord.projectToken, this.encryptionKey)
      const provider = (authRecord.patProvider as 'github' | 'gitlab') || 'github'

      return {
        token,
        username: 'oauth2', // PAT 使用 oauth2 作为 username
        provider,
      }
    }

    throw new Error(`Unsupported auth type: ${authRecord.authType}`)
  }

  /**
   * 创建项目凭证（OAuth）
   */
  async createProjectCredential(projectId: string, userId: string): Promise<void> {
    this.logger.info(`Creating credential for project ${projectId}`)

    // 获取用户的 Git 连接（优先 GitHub）
    let gitConnection = await this.getConnectionByProvider(userId, 'github')

    if (!gitConnection) {
      // 尝试 GitLab
      gitConnection = await this.getConnectionByProvider(userId, 'gitlab')
    }

    if (!gitConnection) {
      throw new Error('User has no connected Git account')
    }

    // 创建数据库记录
    await this.db.insert(schema.projectGitAuth).values({
      projectId,
      authType: 'oauth',
      oauthAccountId: gitConnection.id,
      createdBy: userId,
    })

    // 同步到 K8s
    await this.syncProjectCredentialToK8s(projectId)

    this.logger.info(`Created OAuth credential for project ${projectId}`)
  }

  /**
   * 创建 PAT 凭证
   */
  async createPATCredential(
    projectId: string,
    userId: string,
    token: string,
    provider: 'github' | 'gitlab',
    scopes?: string[],
    expiresAt?: Date,
  ): Promise<void> {
    this.logger.info(`Creating PAT credential for project ${projectId}`)

    // 加密 token
    const encryptedToken = encrypt(token, this.encryptionKey)

    // 创建数据库记录
    await this.db.insert(schema.projectGitAuth).values({
      projectId,
      authType: 'project_token',
      projectToken: encryptedToken,
      patProvider: provider,
      tokenScopes: scopes || [],
      tokenExpiresAt: expiresAt,
      createdBy: userId,
    })

    // 同步到 K8s
    await this.syncProjectCredentialToK8s(projectId)

    this.logger.info(`Created PAT credential for project ${projectId}`)
  }

  /**
   * 验证项目凭证（简单检查 token 是否存在）
   */
  async validateProjectCredential(projectId: string): Promise<boolean> {
    try {
      await this.getProjectAccessToken(projectId)

      // 更新验证时间
      await this.db
        .update(schema.projectGitAuth)
        .set({
          lastValidatedAt: new Date(),
          validationStatus: 'valid',
        })
        .where(eq(schema.projectGitAuth.projectId, projectId))

      return true
    } catch (error: any) {
      this.logger.error(`Failed to validate credential for project ${projectId}:`, error)

      // 更新验证状态
      await this.db
        .update(schema.projectGitAuth)
        .set({
          lastValidatedAt: new Date(),
          validationStatus: 'invalid',
        })
        .where(eq(schema.projectGitAuth.projectId, projectId))

      return false
    }
  }

  /**
   * 同步项目凭证到 K8s
   */
  async syncProjectCredentialToK8s(projectId: string): Promise<void> {
    if (!this.k8s.isK8sConnected()) {
      this.logger.warn('K8s not connected, skipping credential sync')
      return
    }

    const { token, username } = await this.getProjectAccessToken(projectId)

    const environments = await this.db
      .select()
      .from(schema.environments)
      .where(eq(schema.environments.projectId, projectId))

    for (const env of environments) {
      const namespace = `project-${projectId}-${env.type}`
      const secretName = `${projectId}-git-auth`

      try {
        // 确保 namespace 存在
        const namespaceExists = await this.k8s.namespaceExists(namespace)
        if (!namespaceExists) {
          this.logger.debug(`Namespace ${namespace} does not exist yet, skipping secret sync`)
          continue
        }

        try {
          await this.k8s.createSecret(
            namespace,
            secretName,
            {
              username,
              password: token,
            },
            'kubernetes.io/basic-auth',
          )
          this.logger.debug(`Created credential secret ${namespace}/${secretName}`)
        } catch (createError: any) {
          // 如果 Secret 已存在，更新它
          if (createError.statusCode === 409) {
            this.logger.debug(`Secret ${namespace}/${secretName} already exists, updating...`)
            await this.k8s.deleteSecret(namespace, secretName)
            await this.k8s.createSecret(
              namespace,
              secretName,
              {
                username,
                password: token,
              },
              'kubernetes.io/basic-auth',
            )
            this.logger.debug(`Updated credential secret ${namespace}/${secretName}`)
          } else {
            throw createError
          }
        }
      } catch (error: any) {
        this.logger.error(`Failed to sync credential to ${namespace}: ${error.message}`, {
          namespace,
          secretName,
          error: error.stack || error.toString(),
        })
      }
    }
  }

  /**
   * 删除项目凭证
   */
  async deleteProjectCredential(projectId: string): Promise<void> {
    await this.db
      .delete(schema.projectGitAuth)
      .where(eq(schema.projectGitAuth.projectId, projectId))

    this.logger.info(`Deleted credential for project ${projectId}`)
  }
}
