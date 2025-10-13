import { Gitlab } from '@gitbeaker/rest'
import { Injectable } from '@nestjs/common'
import type {
  CreateMergeRequestInput,
  CreateWebhookInput,
  GitBranchInfo,
  GitCommitInfo,
  GitMergeRequestInfo,
  GitProvider,
  GitRepositoryInfo,
} from '../interfaces/git-provider.interface'

@Injectable()
export class GitLabProvider implements GitProvider {
  private gitlab: InstanceType<typeof Gitlab>

  constructor(accessToken: string, baseUrl: string = 'https://gitlab.com') {
    this.gitlab = new Gitlab({
      token: accessToken,
      host: baseUrl,
    })
  }

  async createBranch(
    repoId: string,
    branchName: string,
    sourceBranch: string,
  ): Promise<GitBranchInfo> {
    try {
      const branch = await this.gitlab.Branches.create(repoId, branchName, sourceBranch)

      return {
        name: branch.name,
        sha: branch.commit.id,
        protected: branch.protected,
        default: branch.default,
        lastCommit: {
          sha: branch.commit.id,
          message: branch.commit.message,
          author: branch.commit.author_name,
          date: new Date(branch.commit.authored_date),
        },
      }
    } catch (error) {
      throw new Error(`GitLab API error: ${error.message}`)
    }
  }

  async deleteBranch(repoId: string, branchName: string): Promise<void> {
    try {
      await this.gitlab.Branches.remove(repoId, branchName)
    } catch (error) {
      throw new Error(`GitLab API error: ${error.message}`)
    }
  }

  async getBranches(repoId: string): Promise<GitBranchInfo[]> {
    try {
      const branches = await this.gitlab.Branches.all(repoId)

      return branches.map((branch) => ({
        name: branch.name,
        sha: branch.commit.id,
        protected: branch.protected,
        default: branch.default,
        lastCommit: {
          sha: branch.commit.id,
          message: branch.commit.message,
          author: branch.commit.author_name,
          date: new Date(branch.commit.authored_date),
        },
      }))
    } catch (error) {
      throw new Error(`GitLab API error: ${error.message}`)
    }
  }

  async createMergeRequest(
    repoId: string,
    input: CreateMergeRequestInput,
  ): Promise<GitMergeRequestInfo> {
    try {
      const mr = await this.gitlab.MergeRequests.create(
        repoId,
        input.sourceBranch,
        input.targetBranch,
        input.title,
        {
          description: input.description,
          assignee_id: input.assigneeId ? parseInt(input.assigneeId) : undefined,
          reviewer_ids: input.reviewerIds?.map((id) => parseInt(id)),
          labels: input.labels?.join(','),
        },
      )

      return {
        id: mr.iid.toString(),
        title: mr.title,
        description: mr.description || '',
        sourceBranch: mr.source_branch,
        targetBranch: mr.target_branch,
        status: mr.state.toUpperCase() as 'OPEN' | 'MERGED' | 'CLOSED' | 'DRAFT',
        url: mr.web_url,
        assigneeId: mr.assignee?.id.toString(),
        reviewerIds: mr.reviewers?.map((r) => r.id.toString()) || [],
        labels: mr.labels || [],
        mergedAt: mr.merged_at ? new Date(mr.merged_at) : undefined,
        mergedBy: mr.merged_by?.username,
      }
    } catch (error) {
      throw new Error(`GitLab API error: ${error.message}`)
    }
  }

  async getMergeRequests(repoId: string): Promise<GitMergeRequestInfo[]> {
    try {
      const mrs = await this.gitlab.MergeRequests.all({ projectId: repoId })

      return mrs.map((mr) => ({
        id: mr.iid.toString(),
        title: mr.title,
        description: mr.description || '',
        sourceBranch: mr.source_branch,
        targetBranch: mr.target_branch,
        status: mr.state.toUpperCase() as 'OPEN' | 'MERGED' | 'CLOSED' | 'DRAFT',
        url: mr.web_url,
        assigneeId: mr.assignee?.id.toString(),
        reviewerIds: mr.reviewers?.map((r) => r.id.toString()) || [],
        labels: mr.labels || [],
        mergedAt: mr.merged_at ? new Date(mr.merged_at) : undefined,
        mergedBy: mr.merged_by?.username,
      }))
    } catch (error) {
      throw new Error(`GitLab API error: ${error.message}`)
    }
  }

  async mergeMergeRequest(repoId: string, mrId: string): Promise<void> {
    try {
      await this.gitlab.MergeRequests.accept(repoId, parseInt(mrId))
    } catch (error) {
      throw new Error(`GitLab API error: ${error.message}`)
    }
  }

  async closeMergeRequest(repoId: string, mrId: string): Promise<void> {
    try {
      await this.gitlab.MergeRequests.edit(repoId, parseInt(mrId), {
        state_event: 'close',
      })
    } catch (error) {
      throw new Error(`GitLab API error: ${error.message}`)
    }
  }

  async getCommits(repoId: string, branch?: string): Promise<GitCommitInfo[]> {
    try {
      const commits = await this.gitlab.Commits.all(repoId, {
        ref_name: branch,
        per_page: 50,
      })

      return commits.map((commit) => ({
        sha: commit.id,
        message: commit.message,
        author: commit.author_name,
        date: new Date(commit.authored_date),
        url: commit.web_url,
      }))
    } catch (error) {
      throw new Error(`GitLab API error: ${error.message}`)
    }
  }

  async getRepository(repoId: string): Promise<GitRepositoryInfo> {
    try {
      const project = await this.gitlab.Projects.show(repoId)

      return {
        id: project.id.toString(),
        name: project.name,
        fullName: project.path_with_namespace,
        description: project.description || '',
        url: project.web_url,
        defaultBranch: project.default_branch,
        private: project.visibility === 'private',
      }
    } catch (error) {
      throw new Error(`GitLab API error: ${error.message}`)
    }
  }

  async createWebhook(repoId: string, input: CreateWebhookInput): Promise<string> {
    try {
      const webhook = await this.gitlab.ProjectHooks.add(repoId, input.url, {
        push_events: input.events.includes('push'),
        merge_requests_events:
          input.events.includes('merge_request') || input.events.includes('pull_request'),
        token: input.secret,
      })

      return webhook.id.toString()
    } catch (error) {
      throw new Error(`GitLab API error: ${error.message}`)
    }
  }

  async deleteWebhook(repoId: string, webhookId: string): Promise<void> {
    try {
      await this.gitlab.ProjectHooks.remove(repoId, parseInt(webhookId))
    } catch (error) {
      throw new Error(`GitLab API error: ${error.message}`)
    }
  }
}
