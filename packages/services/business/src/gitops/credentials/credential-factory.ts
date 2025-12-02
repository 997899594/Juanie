import type { ProjectGitAuth } from '@juanie/core/database'
import * as schema from '@juanie/core/database'
import { DATABASE } from '@juanie/core/tokens'
import { EncryptionService, OAuthAccountsService } from '@juanie/service-foundation'
import type { GitProvider } from '@juanie/types'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { GitCredential, GitCredentialFactory } from './git-credential.interface'
import { GitHubAppCredential } from './github-app-credential'
import { GitLabGroupTokenCredential } from './gitlab-group-token-credential'
import { OAuthCredential } from './oauth-credential'
import { PATCredential } from './pat-credential'

/**
 * 凭证工厂
 * 根据类型创建对应的凭证实例
 */
@Injectable()
export class CredentialFactory implements GitCredentialFactory {
  private readonly logger = new Logger(CredentialFactory.name)

  constructor(
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly oauthService: OAuthAccountsService,
    private readonly encryption: EncryptionService,
  ) {}

  async create(authRecord: ProjectGitAuth): Promise<GitCredential> {
    switch (authRecord.authType) {
      case 'oauth':
        return await this.createOAuthCredential(authRecord)

      case 'pat':
      case 'project_token':
        return await this.createPATCredential(authRecord)

      case 'github_app':
        return (await this.createGitHubAppCredential(authRecord)) as GitCredential

      case 'gitlab_group':
      case 'gitlab_group_token':
        return (await this.createGitLabGroupTokenCredential(authRecord)) as GitCredential

      default:
        throw new Error(`Unsupported auth type: ${authRecord.authType}`)
    }
  }

  supports(type: string): boolean {
    return ['oauth', 'pat', 'github_app', 'gitlab_group_token'].includes(type)
  }

  private async createOAuthCredential(authRecord: ProjectGitAuth): Promise<OAuthCredential> {
    if (!authRecord.oauthAccountId) {
      throw new Error('OAuth account ID is required for OAuth credential')
    }

    // 直接通过 oauthAccountId 获取账户（更高效）
    const [oauthAccount] = await this.db
      .select()
      .from(schema.oauthAccounts)
      .where(eq(schema.oauthAccounts.id, authRecord.oauthAccountId))
      .limit(1)

    if (!oauthAccount) {
      throw new Error('OAuth account not found')
    }

    return new OAuthCredential(authRecord.id, oauthAccount, this.oauthService)
  }

  private async createPATCredential(authRecord: ProjectGitAuth): Promise<PATCredential> {
    if (!authRecord.projectToken) {
      throw new Error('Project token is required for PAT credential')
    }

    // 解密 token
    const token = this.encryption.decryptData(authRecord.projectToken)

    // 推断 provider（从 token 或其他字段）
    const provider: GitProvider = 'github' // TODO: 从数据库或配置中获取

    const scopes = (authRecord.tokenScopes as string[]) || []
    const expiresAt = authRecord.tokenExpiresAt || undefined

    return new PATCredential(authRecord.id, provider, token, scopes, expiresAt)
  }

  private async createGitHubAppCredential(
    authRecord: ProjectGitAuth,
  ): Promise<GitHubAppCredential> {
    if (
      !authRecord.githubAppId ||
      !authRecord.githubInstallationId ||
      !authRecord.githubPrivateKey
    ) {
      throw new Error('GitHub App credentials are incomplete')
    }

    // 解密私钥
    const privateKey = this.encryption.decryptData(authRecord.githubPrivateKey)

    return new GitHubAppCredential(
      authRecord.id,
      authRecord.githubAppId,
      authRecord.githubInstallationId,
      privateKey,
      ['repo', 'admin:org'],
      authRecord.tokenExpiresAt || undefined,
    )
  }

  private async createGitLabGroupTokenCredential(
    authRecord: ProjectGitAuth,
  ): Promise<GitLabGroupTokenCredential> {
    if (!authRecord.gitlabGroupId || !authRecord.gitlabGroupToken) {
      throw new Error('GitLab Group Token credentials are incomplete')
    }

    // 解密 token
    const token = this.encryption.decryptData(authRecord.gitlabGroupToken)
    const scopes = (authRecord.gitlabGroupScopes as string[]) || []

    return new GitLabGroupTokenCredential(
      authRecord.id,
      authRecord.gitlabGroupId,
      token,
      scopes,
      authRecord.tokenExpiresAt || undefined,
    )
  }
}
