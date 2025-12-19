import { Module } from '@nestjs/common'
import { EncryptionService } from '../encryption/encryption.service'
import { GitAccountLinkingService } from './git-account-linking.service'
import { GitHubOAuthService } from './github-oauth.service'
import { GitLabOAuthService } from './gitlab-oauth.service'

/**
 * Git OAuth Module
 * 提供 GitHub 和 GitLab 的 OAuth 认证服务
 */
@Module({
  providers: [GitAccountLinkingService, GitHubOAuthService, GitLabOAuthService, EncryptionService],
  exports: [GitAccountLinkingService, GitHubOAuthService, GitLabOAuthService],
})
export class GitOAuthModule {}
