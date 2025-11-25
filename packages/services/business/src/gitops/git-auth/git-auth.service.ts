import * as schema from '@juanie/core/database'
import { DATABASE } from '@juanie/core/tokens'
import { OAuthAccountsService } from '@juanie/service-foundation'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { K3sService } from '../k3s/k3s.service'

/**
 * Git 认证服务
 *
 * 职责：
 * - 创建长期有效的 Git 访问凭证
 * - GitLab: Project Access Token（永不过期）
 * - GitHub: Deploy Key（永不过期）
 * - 管理凭证生命周期
 */
@Injectable()
export class GitAuthService {
  private readonly logger = new Logger(GitAuthService.name)

  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private config: ConfigService,
    private k3s: K3sService,
    private oauthAccounts: OAuthAccountsService,
  ) {}

  /**
   * 为项目设置 Git 认证
   * 根据 provider 自动选择合适的方案
   */
  async setupProjectAuth(data: {
    projectId: string
    repositoryId: string
    provider: 'github' | 'gitlab'
    repositoryUrl: string
    repositoryFullName: string
    userId: string
    skipK8sSecrets?: boolean // 是否跳过 K8s Secret 创建
  }): Promise<{ success: boolean; credentialId: string }> {
    this.logger.log(`Setting up Git auth for project ${data.projectId}`)

    try {
      // 获取用户的 OAuth token（只用一次）
      const oauthAccount = await this.oauthAccounts.getAccountByProvider(data.userId, data.provider)

      if (!oauthAccount?.accessToken) {
        throw new Error(`User not connected to ${data.provider}`)
      }

      let credential: schema.GitCredential

      if (data.provider === 'gitlab') {
        credential = await this.setupGitLabAuth(
          data.projectId,
          data.repositoryFullName,
          oauthAccount.accessToken,
        )
      } else {
        credential = await this.setupGitHubAuth(
          data.projectId,
          data.repositoryFullName,
          oauthAccount.accessToken,
        )
      }

      // 创建 K8s Secret（如果需要）
      if (!data.skipK8sSecrets) {
        await this.createK8sSecrets(data.projectId, credential)
      }

      this.logger.log(`Git auth setup completed for project ${data.projectId}`)

      return {
        success: true,
        credentialId: credential.id,
      }
    } catch (error: any) {
      this.logger.error(`Failed to setup Git auth:`, error)
      throw error
    }
  }

  /**
   * 设置 GitLab Project Access Token
   */
  private async setupGitLabAuth(
    projectId: string,
    gitlabProjectId: string,
    userToken: string,
  ): Promise<schema.GitCredential> {
    const gitlabUrl = this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'

    this.logger.log(`Creating GitLab Project Access Token for project ${gitlabProjectId}`)

    // 创建 Project Access Token
    const response = await fetch(
      `${gitlabUrl}/api/v4/projects/${encodeURIComponent(gitlabProjectId)}/access_tokens`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'PRIVATE-TOKEN': userToken,
        },
        body: JSON.stringify({
          name: `juanie-platform-${projectId}`,
          scopes: ['read_repository'],
          access_level: 10, // Guest (只读)
          expires_at: null, // 永不过期
        }),
      },
    )

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as any
      throw new Error(`Failed to create GitLab token: ${error.message || response.statusText}`)
    }

    const tokenData = (await response.json()) as any

    // 存储到数据库
    const [credential] = await this.db
      .insert(schema.gitCredentials)
      .values({
        projectId,
        type: 'gitlab_project_token',
        gitlabTokenId: String(tokenData.id),
        gitlabProjectId,
        token: tokenData.token, // TODO: 加密存储
        scopes: tokenData.scopes,
        expiresAt: tokenData.expires_at ? new Date(tokenData.expires_at) : null,
      })
      .returning()

    this.logger.log(`GitLab token created: ${tokenData.id}`)

    return credential!
  }

  /**
   * 设置 GitHub Deploy Key
   */
  private async setupGitHubAuth(
    projectId: string,
    repoFullName: string,
    userToken: string,
  ): Promise<schema.GitCredential> {
    this.logger.log(`Creating GitHub Deploy Key for ${repoFullName}`)

    // 生成 SSH 密钥对
    const keyPair = await this.generateSSHKeyPair(projectId)

    // 添加 Deploy Key 到 GitHub
    const payload = {
      title: `Juanie Platform - ${projectId}`,
      key: keyPair.publicKey,
      read_only: true,
    }

    this.logger.debug(
      `GitHub Deploy Key payload: ${JSON.stringify({ ...payload, key: payload.key.substring(0, 50) + '...' })}`,
    )

    const response = await fetch(`https://api.github.com/repos/${repoFullName}/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as any
      this.logger.error(`GitHub API error: ${JSON.stringify(error)}`)
      throw new Error(`Failed to create GitHub Deploy Key: ${error.message || response.statusText}`)
    }

    const keyData = (await response.json()) as any

    // 存储到数据库
    const [credential] = await this.db
      .insert(schema.gitCredentials)
      .values({
        projectId,
        type: 'github_deploy_key',
        githubKeyId: String(keyData.id),
        githubRepoFullName: repoFullName,
        token: keyPair.privateKey, // TODO: 加密存储
        scopes: ['read'],
        expiresAt: null, // 永不过期
      })
      .returning()

    this.logger.log(`GitHub Deploy Key created: ${keyData.id}`)

    return credential!
  }

  /**
   * 生成 SSH 密钥对（使用 sshpk）
   */
  private async generateSSHKeyPair(projectId: string): Promise<{
    publicKey: string
    privateKey: string
    fingerprint: string
  }> {
    const sshpk = await import('sshpk')

    // 生成 Ed25519 密钥对
    const key = sshpk.generatePrivateKey('ed25519')

    // 设置注释
    const comment = `juanie-${projectId}`
    key.comment = comment

    // 导出为 OpenSSH 格式
    const publicKey = key.toPublic().toString('ssh') // ssh-ed25519 AAAA... comment
    const privateKey = key.toString('openssh') // OpenSSH 私钥格式

    // 计算指纹
    const fingerprint = key.fingerprint('sha256').toString('base64')

    return {
      publicKey,
      privateKey,
      fingerprint: `SHA256:${fingerprint}`,
    }
  }

  /**
   * 创建 K8s Secret
   */
  private async createK8sSecrets(
    projectId: string,
    credential: schema.GitCredential,
  ): Promise<void> {
    if (!this.k3s.isK3sConnected()) {
      this.logger.warn('K3s not connected, skipping secret creation')
      return
    }

    // 获取项目的所有环境
    const environments = await this.db
      .select()
      .from(schema.environments)
      .where(eq(schema.environments.projectId, projectId))

    for (const environment of environments) {
      const namespace = `project-${projectId}-${environment.type}`
      const secretName = `${projectId}-git-auth`

      try {
        // 根据凭证类型创建不同格式的 Secret
        if (credential.type === 'github_deploy_key') {
          // GitHub Deploy Key 使用 SSH 认证
          await this.k3s.createSecret(
            namespace,
            secretName,
            {
              identity: credential.token, // SSH 私钥
              known_hosts: '', // 可选，GitHub 的 known_hosts
            },
            'kubernetes.io/ssh-auth',
          )
          this.logger.debug(`Created SSH secret ${secretName} in ${namespace}`)
        } else {
          // GitLab Project Access Token 使用 HTTP Basic Auth
          await this.k3s.createSecret(
            namespace,
            secretName,
            {
              username: 'git',
              password: credential.token,
            },
            'kubernetes.io/basic-auth',
          )
          this.logger.debug(`Created basic-auth secret ${secretName} in ${namespace}`)
        }
      } catch (error: any) {
        this.logger.error(`Failed to create secret in ${namespace}:`, error.message)
      }
    }
  }

  /**
   * 撤销 Git 凭证
   */
  async revokeCredential(projectId: string): Promise<{ success: boolean }> {
    const [credential] = await this.db
      .select()
      .from(schema.gitCredentials)
      .where(eq(schema.gitCredentials.projectId, projectId))
      .limit(1)

    if (!credential) {
      return { success: false }
    }

    try {
      // 从 Git provider 撤销
      if (credential.type === 'gitlab_project_token') {
        await this.revokeGitLabToken(credential)
      } else if (credential.type === 'github_deploy_key') {
        await this.revokeGitHubKey(credential)
      }

      // 删除 K8s Secrets
      await this.deleteK8sSecrets(projectId)

      // 更新数据库
      await this.db
        .update(schema.gitCredentials)
        .set({ revokedAt: new Date() })
        .where(eq(schema.gitCredentials.id, credential.id))

      this.logger.log(`Revoked credential for project ${projectId}`)

      return { success: true }
    } catch (error: any) {
      this.logger.error(`Failed to revoke credential:`, error)
      throw error
    }
  }

  /**
   * 撤销 GitLab token
   */
  private async revokeGitLabToken(credential: schema.GitCredential): Promise<void> {
    const gitlabUrl = this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'

    // 需要管理员 token 或项目 owner token
    // 这里简化处理，实际应该使用服务账户
    const response = await fetch(
      `${gitlabUrl}/api/v4/projects/${credential.gitlabProjectId}/access_tokens/${credential.gitlabTokenId}`,
      {
        method: 'DELETE',
        headers: {
          'PRIVATE-TOKEN': credential.token, // 使用 token 自己撤销自己
        },
      },
    )

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to revoke GitLab token: ${response.statusText}`)
    }
  }

  /**
   * 撤销 GitHub Deploy Key
   */
  private async revokeGitHubKey(credential: schema.GitCredential): Promise<void> {
    // 需要用户 token 或 GitHub App token
    // 这里简化处理
    this.logger.warn('GitHub Deploy Key revocation not implemented')
  }

  /**
   * 删除 K8s Secrets
   */
  private async deleteK8sSecrets(projectId: string): Promise<void> {
    if (!this.k3s.isK3sConnected()) {
      return
    }

    const environments = await this.db
      .select()
      .from(schema.environments)
      .where(eq(schema.environments.projectId, projectId))

    for (const environment of environments) {
      const namespace = `project-${projectId}-${environment.type}`
      const secretName = `${projectId}-git-auth`

      try {
        // 使用 K3sService 的方法删除 secret（简化）
        // 实际应该添加 deleteSecret 方法到 K3sService
        this.logger.debug(`Deleting secret ${secretName} in ${namespace}`)
        // TODO: 实现 K3sService.deleteSecret()
      } catch (error: any) {
        this.logger.error(`Failed to delete secret ${secretName}:`, error.message)
      }
    }
  }

  /**
   * 获取项目的 Git 凭证
   */
  async getProjectCredential(projectId: string): Promise<schema.GitCredential | null> {
    const [credential] = await this.db
      .select()
      .from(schema.gitCredentials)
      .where(eq(schema.gitCredentials.projectId, projectId))
      .limit(1)

    return credential || null
  }
}
