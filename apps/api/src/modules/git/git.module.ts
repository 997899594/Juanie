import { Module } from '@nestjs/common'
import { GitProviderFactory } from './providers/git-provider.factory'
import { GitService } from './services/git.service'
import { GitBranchService } from './services/git-branch.service'
import { GitMergeRequestService } from './services/git-merge-request.service'
import { GitRepositoryService } from './services/git-repository.service'
import { GitWebhookService } from './services/git-webhook.service'

@Module({
  providers: [
    // 主服务
    GitService,

    // 子服务
    GitBranchService,
    GitMergeRequestService,
    GitRepositoryService,
    GitWebhookService,

    // 工厂
    GitProviderFactory,
  ],
  exports: [
    GitService,
    GitBranchService,
    GitMergeRequestService,
    GitRepositoryService,
    GitWebhookService,
    GitProviderFactory,
  ],
})
export class GitModule {}
