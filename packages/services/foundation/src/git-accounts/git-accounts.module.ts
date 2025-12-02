import { Module } from '@nestjs/common'
import { EncryptionService } from '../encryption/encryption.service'
import { GitAccountLinkingService } from './git-account-linking.service'
import { GitHubOAuthService } from './github-oauth.service'
import { GitLabOAuthService } from './gitlab-oauth.service'

@Module({
  providers: [GitAccountLinkingService, GitHubOAuthService, GitLabOAuthService, EncryptionService],
  exports: [GitAccountLinkingService, GitHubOAuthService, GitLabOAuthService],
})
export class GitAccountsModule {}
