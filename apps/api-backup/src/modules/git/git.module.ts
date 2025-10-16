import { Module } from '@nestjs/common'
import { DrizzleModule } from '../../drizzle/drizzle.module'
import { GitProviderFactory } from './providers/git-provider.factory'
import { GitHubProvider } from './providers/github.provider'
import { GitLabProvider } from './providers/gitlab.provider'
import { GitService } from './services/git.service'
import { GitBranchService } from './services/git-branch.service'
import { GitMergeRequestService } from './services/git-merge-request.service'
import { GitRepositoryService } from './services/git-repository.service'
import { GitWebhookService } from './services/git-webhook.service'

@Module({
  imports: [DrizzleModule],
  providers: [
    GitService,
    GitBranchService,
    GitMergeRequestService,
    GitRepositoryService,
    GitWebhookService,
    GitProviderFactory,
    GitHubProvider,
    GitLabProvider,
  ],
  exports: [GitService],
})
export class GitModule {}
