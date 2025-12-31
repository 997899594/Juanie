import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { GitProviderService } from './git-provider.service'
import { GitHubClientService } from './github-client.service'
import { GitLabClientService } from './gitlab-client.service'

/**
 * Git Providers Module
 *
 * 提供 GitHub 和 GitLab API 调用封装
 *
 * 重构说明：
 * - ✅ 使用 Octokit + Gitbeaker 官方 SDK
 * - ✅ 从 Business 层移动到 Foundation 层（正确的分层）
 * - ✅ 代码量从 2132 行减少到约 180 行（-91%）
 */
@Module({
  imports: [ConfigModule],
  providers: [GitHubClientService, GitLabClientService, GitProviderService],
  exports: [GitHubClientService, GitLabClientService, GitProviderService],
})
export class GitProvidersModule {}
