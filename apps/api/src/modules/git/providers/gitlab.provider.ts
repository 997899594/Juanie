import { Gitlab } from '@gitbeaker/rest'
import { Injectable } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import type { CreateMergeRequestData, GitCommitInfo } from '../../../lib/types/index'
import type {
  GitBranchInfo,
  GitMergeRequestInfo,
  GitRepositoryInfo,
} from '../interfaces/git-provider.interface'
import { BaseGitProvider } from './base-git.provider'

@Injectable()
export class GitLabProvider extends BaseGitProvider {
  readonly providerName = 'GitLab'
  private gitlab: InstanceType<typeof Gitlab>

  constructor(
    private configService: ConfigService,
    accessToken: string,
    baseUrl?: string,
  ) {
    super()
    this.gitlab = new Gitlab({
      token: accessToken,
      host: baseUrl || this.configService.get('GITLAB_BASE_URL'),
    })
  }

  async getRepositories(): Promise<GitRepositoryInfo[]> {
    return this.withRetry(
      async () => {
        const projects = await this.gitlab.Projects.all({
          membership: true,
          perPage: 100,
        })

        return projects.map((project: any) => ({
          id: project.id.toString(),
          name: project.name,
          fullName: project.path_with_namespace,
          description: project.description || '',
          webUrl: project.web_url,
          defaultBranch: project.default_branch,
          isPrivate: project.visibility === 'private',
        }))
      },
      3,
      'getRepositories',
    )
  }

  async getBranches(repoId: string): Promise<GitBranchInfo[]> {
    if (!repoId) {
      throw new Error('Repository ID is required')
    }

    return this.withRetry(
      async () => {
        const branches = await this.gitlab.Branches.all(repoId)

        return branches.map((branch: any) => ({
          id: branch.name,
          name: branch.name,
          commit: branch?.commit?.id ?? '',
          protected: !!branch.protected,
        }))
      },
      3,
      'getBranches',
    )
  }

  async createBranch(
    repoId: string,
    branchName: string,
    sourceBranch: string,
  ): Promise<GitBranchInfo> {
    if (!repoId || !branchName) {
      throw new Error('Repository ID and branch name are required')
    }

    return this.withRetry(
      async () => {
        const b: any = await this.gitlab.Branches.create(repoId, branchName, sourceBranch)
        return {
          id: b.name,
          name: b.name,
          commit: b?.commit?.id ?? '',
          protected: !!b.protected,
        }
      },
      3,
      'createBranch',
    )
  }

  async deleteBranch(repoId: string, branchName: string): Promise<void> {
    if (!repoId || !branchName) {
      throw new Error('Repository ID and branch name are required')
    }

    await this.withRetry(
      async () => {
        await this.gitlab.Branches.remove(repoId, branchName)
      },
      3,
      'deleteBranch',
    )
  }

  async getBranch(repoId: string, branchName: string): Promise<GitBranchInfo> {
    if (!repoId || !branchName) {
      throw new Error('Repository ID and branch name are required')
    }

    return this.withRetry(
      async () => {
        const b: any = await this.gitlab.Branches.show(repoId, branchName)
        return {
          id: b.name,
          name: b.name,
          commit: b?.commit?.id ?? '',
          protected: !!b.protected,
        }
      },
      3,
      'getBranch',
    )
  }

  async getMergeRequests(repoId: string): Promise<GitMergeRequestInfo[]> {
    if (!repoId) {
      throw new Error('Repository ID is required')
    }

    return this.withRetry(
      async () => {
        const mrs = await this.gitlab.MergeRequests.all({ projectId: repoId })

        return mrs.map((mr: any) => ({
          id: mr.iid,
          title: mr.title,
          description: mr.description || '',
          status: mr.state.toUpperCase() as 'OPEN' | 'MERGED' | 'CLOSED',
          sourceBranch: mr.source_branch,
          targetBranch: mr.target_branch,
          author: mr.author?.username || '',
          assignee: mr.assignee?.username,
          reviewerIds: mr.reviewers?.map((r: any) => r.username) || [],
          labels: (mr.labels as any[]) || [],
          webUrl: mr.web_url,
          createdAt: new Date(mr.created_at),
          updatedAt: new Date(mr.updated_at),
          mergedAt: mr.merged_at ? new Date(mr.merged_at) : undefined,
          mergedBy: mr.merged_by?.username,
        }))
      },
      3,
      'getMergeRequests',
    )
  }

  async getMergeRequest(repoId: string, mrId: number): Promise<GitMergeRequestInfo> {
    if (!repoId || !mrId) {
      throw new Error('Repository ID and Merge Request ID are required')
    }

    return this.withRetry(
      async () => {
        const mr: any = await this.gitlab.MergeRequests.show(repoId, mrId)
        return {
          id: mr.iid,
          title: mr.title,
          description: mr.description || '',
          status: mr.state.toUpperCase() as 'OPEN' | 'MERGED' | 'CLOSED',
          sourceBranch: mr.source_branch,
          targetBranch: mr.target_branch,
          author: mr.author?.username || '',
          assignee: mr.assignee?.username,
          reviewerIds: mr.reviewers?.map((r: any) => r.username) || [],
          labels: (mr.labels as any[]) || [],
          webUrl: mr.web_url,
          createdAt: new Date(mr.created_at),
          updatedAt: new Date(mr.updated_at),
          mergedAt: mr.merged_at ? new Date(mr.merged_at) : undefined,
          mergedBy: mr.merged_by?.username,
        }
      },
      3,
      'getMergeRequest',
    )
  }

  async createMergeRequest(
    repoId: string,
    data: CreateMergeRequestData,
  ): Promise<GitMergeRequestInfo> {
    if (!repoId) {
      throw new Error('Repository ID is required')
    }

    const payload: any = {
      source_branch: data.sourceBranch,
      target_branch: data.targetBranch,
      title: data.title,
      description: data.description,
      remove_source_branch: !!data.removeSourceBranch,
      labels: data.labels,
    }

    return this.withRetry(
      async () => {
        const mr: any = await this.gitlab.MergeRequests.create(
          repoId,
          payload.source_branch,
          payload.target_branch,
          payload.title,
          {
            description: payload.description,
            removeSourceBranch: payload.remove_source_branch,
            labels: payload.labels,
          },
        )
        return {
          id: mr.iid,
          title: mr.title,
          description: mr.description || '',
          status: mr.state.toUpperCase() as 'OPEN' | 'MERGED' | 'CLOSED',
          sourceBranch: mr.source_branch,
          targetBranch: mr.target_branch,
          author: mr.author?.username || '',
          assignee: mr.assignee?.username,
          reviewerIds: mr.reviewers?.map((r: any) => r.username) || [],
          labels: (mr.labels as any[]) || [],
          webUrl: mr.web_url,
          createdAt: new Date(mr.created_at),
          updatedAt: new Date(mr.updated_at),
          mergedAt: mr.merged_at ? new Date(mr.merged_at) : undefined,
          mergedBy: mr.merged_by?.username,
        }
      },
      3,
      'createMergeRequest',
    )
  }

  async mergeMergeRequest(repoId: string, mrId: number): Promise<void> {
    if (!repoId || !mrId) {
      throw new Error('Repository ID and Merge Request ID are required')
    }

    await this.withRetry(
      async () => {
        await this.gitlab.MergeRequests.accept(repoId, mrId)
      },
      3,
      'mergeMergeRequest',
    )
  }

  async closeMergeRequest(repoId: string, mrId: number): Promise<void> {
    if (!repoId || !mrId) {
      throw new Error('Repository ID and Merge Request ID are required')
    }

    await this.withRetry(
      async () => {
        await this.gitlab.MergeRequests.edit(repoId, mrId, {
          stateEvent: 'close',
        })
      },
      3,
      'closeMergeRequest',
    )
  }

  async getCommits(repoId: string): Promise<GitCommitInfo[]> {
    if (!repoId) {
      throw new Error('Repository ID is required')
    }

    return this.withRetry(
      async () => {
        const commits = await this.gitlab.Commits.all(repoId)
        return commits.map((c: any) => ({
          sha: c.id,
          message: c.message,
          author: {
            name: c.author_name,
            email: c.author_email,
            username: c.author_name,
          },
          date: new Date(c.created_at),
          url: c.web_url,
        }))
      },
      3,
      'getCommits',
    )
  }

  async getCommit(repoId: string, sha: string): Promise<GitCommitInfo> {
    if (!repoId || !sha) {
      throw new Error('Repository ID and SHA are required')
    }

    return this.withRetry(
      async () => {
        const c: any = await this.gitlab.Commits.show(repoId, sha)
        return {
          sha: c.id,
          message: c.message,
          author: {
            name: c.author_name,
            email: c.author_email,
            username: c.author_name,
          },
          date: new Date(c.created_at),
          url: c.web_url,
        }
      },
      3,
      'getCommit',
    )
  }

  async getRepository(repoId: string): Promise<GitRepositoryInfo> {
    if (!repoId) {
      throw new Error('Repository ID is required')
    }

    return this.withRetry(
      async () => {
        const p: any = await this.gitlab.Projects.show(repoId)
        return {
          id: String(p.id),
          name: p.name,
          fullName: p.path_with_namespace,
          description: p.description || '',
          webUrl: p.web_url,
          defaultBranch: p.default_branch,
          isPrivate: p.visibility === 'private',
        }
      },
      3,
      'getRepository',
    )
  }

  async createWebhook(
    repoId: string,
    webhookUrl: string,
    events: string[],
  ): Promise<{ id: string; url: string; events: string[]; secret?: string; createdAt: Date }> {
    if (!repoId) {
      throw new Error('Repository ID is required')
    }

    return this.withRetry(
      async () => {
        const hook: any = await this.gitlab.ProjectHooks.add(repoId, webhookUrl, {
          pushEvents: events.includes('push') ? true : undefined,
          mergeRequestsEvents: events.includes('merge_request') ? true : undefined,
        })

        return {
          id: String(hook.id),
          url: webhookUrl,
          events,
          secret: undefined,
          createdAt: new Date(),
        }
      },
      3,
      'createWebhook',
    )
  }

  async deleteWebhook(repoId: string, webhookId: string): Promise<void> {
    if (!repoId || !webhookId) {
      throw new Error('Repository ID and Webhook ID are required')
    }

    await this.withRetry(
      async () => {
        await this.gitlab.ProjectHooks.remove(repoId, parseInt(webhookId, 10))
      },
      3,
      'deleteWebhook',
    )
  }
}
