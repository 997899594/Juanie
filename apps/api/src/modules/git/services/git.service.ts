import { Injectable } from '@nestjs/common'
import { GitBranchService } from './git-branch.service'
import { GitMergeRequestService } from './git-merge-request.service'
import { GitRepositoryService } from './git-repository.service'
import { GitWebhookService } from './git-webhook.service'

@Injectable()
export class GitService {
  constructor(
    public readonly branches: GitBranchService,
    public readonly mergeRequests: GitMergeRequestService,
    public readonly repositories: GitRepositoryService,
    public readonly webhooks: GitWebhookService,
  ) {}
}
