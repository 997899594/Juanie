import * as schema from '@juanie/core/database'
import { Logger } from '@juanie/core/logger'
import { DATABASE } from '@juanie/core/tokens'
import { EncryptionService, GitConnectionsService } from '@juanie/service-foundation'
import type { CreateCredentialOptions, GitAuthHealthStatus } from '@juanie/types'
import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { K3sService } from '../k3s/k3s.service'
import { CredentialFactory } from './credential-factory'
import type { GitCredential, GitCredentialExtended } from './git-credential.interface'

/**
 * 凭证管理器
 * 负责凭证的创建、验证、刷新、同步
 */
@Injectable()
export class CredentialManagerService {
  constructor(
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly k3s: K3sService,
    private readonly gitConnectionsService: GitConnectionsService,
    private readonly credentialFactory: CredentialFactory,
    private readonly encryption: EncryptionService,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(CredentialManagerService.name)
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
  ): Promise<GitCredential> {
    this.logger.info(`Creating PAT credential for project ${projectId}`)

    // 加密 token
    const encryptedToken = this.encryption.encrypt(token)

    // 创建数据库记录
    const [authRecord] = await this.db
      .insert(schema.projectGitAuth)
      .values({
        projectId,
        authType: 'project_token',
        projectToken: encryptedToken,
        patProvider: provider,
        tokenScopes: scopes || [],
        tokenExpiresAt: expiresAt,
        createdBy: userId,
      })
      .returning()

    if (!authRecord) {
      throw new Error('Failed to create auth record')
    }

    // 创建凭证实例
    const credential = await this.credentialFactory.create(authRecord)

    // 同步到 K8s
    await this.syncToK8s(projectId, credential)

    this.logger.info(`Created PAT credential for project ${projectId}`)

    return credential
  }

  /**
   * 为项目创建凭证
   * 默认使用 OAuth Token
   */
  async createProjectCredential(options: CreateCredentialOptions): Promise<GitCredential> {
    this.logger.info(`Creating credential for project ${options.projectId}`)

    const authType = options.preferredType || 'oauth'

    if (authType === 'oauth') {
      return await this.createOAuthCredential(options.projectId, options.userId)
    }

    if (authType === 'pat' && options.customToken) {
      const provider = options.provider || 'github'
      return await this.createPATCredential(
        options.projectId,
        options.userId,
        options.customToken,
        provider,
      )
    }

    throw new Error(`Auth type ${authType} not implemented yet`)
  }

  /**
   * 创建 OAuth 凭证
   */
  private async createOAuthCredential(projectId: string, userId: string): Promise<GitCredential> {
    // 获取用户的 Git 连接（优先 GitHub）
    let gitConnection = await this.gitConnectionsService.getConnectionByProvider(userId, 'github')

    if (!gitConnection) {
      // 尝试 GitLab
      gitConnection = await this.gitConnectionsService.getConnectionByProvider(userId, 'gitlab')
    }

    if (!gitConnection) {
      throw new Error('User has no connected Git account')
    }

    // 创建数据库记录
    const [authRecord] = await this.db
      .insert(schema.projectGitAuth)
      .values({
        projectId,
        authType: 'oauth',
        oauthAccountId: gitConnection.id,
        createdBy: userId,
      })
      .returning()

    if (!authRecord) {
      throw new Error('Failed to create auth record')
    }

    // 创建凭证实例
    const credential = await this.credentialFactory.create(authRecord)

    // 同步到 K8s
    await this.syncToK8s(projectId, credential)

    this.logger.info(`Created OAuth credential for project ${projectId}`)

    return credential
  }

  /**
   * 获取项目凭证
   */
  async getProjectCredential(projectId: string): Promise<GitCredential> {
    const [authRecord] = await this.db
      .select()
      .from(schema.projectGitAuth)
      .where(eq(schema.projectGitAuth.projectId, projectId))
      .limit(1)

    if (!authRecord) {
      throw new Error(`No credential found for project ${projectId}`)
    }

    return await this.credentialFactory.create(authRecord)
  }

  /**
   * 健康检查
   */
  async healthCheck(projectId: string): Promise<GitAuthHealthStatus> {
    try {
      const credential = await this.getProjectCredential(projectId)
      const isValid = await credential.validate()

      if (!isValid) {
        // 尝试自动修复
        const fixed = await this.autoFix(projectId, credential)

        if (fixed) {
          return {
            status: 'healthy',
            message: 'Auto-fixed',
            lastCheckedAt: new Date(),
          }
        }

        return {
          status: 'unhealthy',
          message: 'Credential invalid',
          lastCheckedAt: new Date(),
        }
      }

      // 更新验证时间
      await this.db
        .update(schema.projectGitAuth)
        .set({
          lastValidatedAt: new Date(),
          validationStatus: 'valid',
        })
        .where(eq(schema.projectGitAuth.projectId, projectId))

      return {
        status: 'healthy',
        lastCheckedAt: new Date(),
      }
    } catch (error: any) {
      this.logger.error(`Health check failed for project ${projectId}:`, error)

      return {
        status: 'unhealthy',
        message: error.message,
        lastCheckedAt: new Date(),
      }
    }
  }

  /**
   * 自动修复
   */
  private async autoFix(projectId: string, credential: GitCredential): Promise<boolean> {
    this.logger.info(`Attempting auto-fix for project ${projectId}`)

    // 1. 尝试刷新 token
    if (credential.refresh) {
      try {
        await credential.refresh()
        const isValid = await credential.validate()

        if (isValid) {
          // 刷新成功，同步到 K8s
          await this.syncToK8s(projectId, credential)
          this.logger.info(`Auto-fix successful: refreshed token`)
          return true
        }
      } catch (error: any) {
        this.logger.warn(`Token refresh failed:`, error)
      }
    }

    // 2. 未来：尝试切换到备用凭证

    return false
  }

  /**
   * 同步到 K8s
   * 更新所有环境的 Secret
   */
  async syncToK8s(projectId: string, credential: GitCredential): Promise<void> {
    if (!this.k3s.isK3sConnected()) {
      this.logger.warn('K3s not connected, skipping sync')
      return
    }

    const environments = await this.db
      .select()
      .from(schema.environments)
      .where(eq(schema.environments.projectId, projectId))

    const token = await credential.getAccessToken()
    // 使用类型断言获取 username
    const _username = (credential as unknown as GitCredentialExtended).getUsername()

    for (const env of environments) {
      const namespace = `project-${projectId}-${env.type}`
      const secretName = `${projectId}-git-auth`

      try {
        // 确保 namespace 存在
        const namespaceExists = await this.k3s.namespaceExists(namespace)
        if (!namespaceExists) {
          this.logger.debug(`Namespace ${namespace} does not exist yet, skipping secret sync`)
          continue
        }

        try {
          await this.k3s.createSecret(
            namespace,
            secretName,
            {
              username: _username,
              password: token,
            },
            'kubernetes.io/basic-auth',
          )
          this.logger.debug(`Created credential secret ${namespace}/${secretName}`)
        } catch (createError: any) {
          // 如果 Secret 已存在，尝试更新
          if (createError.statusCode === 409) {
            this.logger.debug(`Secret ${namespace}/${secretName} already exists, updating...`)
            // TODO: 实现 updateSecret 方法
            // 暂时先删除再创建
            try {
              await this.k3s.deleteSecret(namespace, secretName)
              await this.k3s.createSecret(
                namespace,
                secretName,
                {
                  username: _username,
                  password: token,
                },
                'kubernetes.io/basic-auth',
              )
              this.logger.debug(`Updated credential secret ${namespace}/${secretName}`)
            } catch (updateError: any) {
              throw new Error(`Failed to update secret: ${updateError.message}`)
            }
          } else {
            throw createError
          }
        }
      } catch (error: any) {
        this.logger.error(`Failed to sync to ${namespace}: ${error.message || error}`, {
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
