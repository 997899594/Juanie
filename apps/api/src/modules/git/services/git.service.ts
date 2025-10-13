import { Injectable } from '@nestjs/common'
import type { GitBranchService } from './git-branch.service'
import type { GitMergeRequestService } from './git-merge-request.service'
import type { GitRepositoryService } from './git-repository.service'
import type { GitWebhookService } from './git-webhook.service'

@Injectable()
export class GitService {
  constructor(
    public readonly branches: GitBranchService,
    public readonly mergeRequests: GitMergeRequestService,
    public readonly repositories: GitRepositoryService,
    public readonly webhooks: GitWebhookService,
  ) {}

  // 提供统一的服务访问点
  getBranchService(): GitBranchService {
    return this.branches
  }

  getMergeRequestService(): GitMergeRequestService {
    return this.mergeRequests
  }

  getRepositoryService(): GitRepositoryService {
    return this.repositories
  }

  getWebhookService(): GitWebhookService {
    return this.webhooks
  }
}
