import { Injectable } from '@nestjs/common'
import { Octokit } from '@octokit/rest'
import { ConfigService } from '../../../core/config/nestjs'
import type { GitCommitInfo } from '../../../lib/types/index'
import type {
  GitBranchInfo,
  GitMergeRequestInfo,
  GitRepositoryInfo,
} from '../interfaces/git-provider.interface'
import { BaseGitProvider } from './base-git.provider'

@Injectable()
export class GitHubProvider extends BaseGitProvider {
  readonly providerName = 'GitHub'
  private octokit: Octokit

  constructor(
    private configService: ConfigService,
    accessToken: string,
  ) {
    super()
    this.octokit = new Octokit({
      auth: accessToken,
    })
  }

  async getRepositories(): Promise<GitRepositoryInfo[]> {
    return this.withRetry(
      async () => {
        const { data: repos } = await this.octokit.rest.repos.listForAuthenticatedUser({
          per_page: 100,
          sort: 'updated',
        })

        return repos.map((repo) => ({
          id: repo.full_name,
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description || '',
          webUrl: repo.html_url,
          defaultBranch: repo.default_branch,
          isPrivate: !!repo.private,
        }))
      },
      3,
      'getRepositories',
    )
  }

  async getBranches(repoId: string): Promise<GitBranchInfo[]> {
    const [owner, repo] = repoId.split('/')
    if (!owner || !repo) {
      throw new Error(`Invalid repository ID: ${repoId}`)
    }

    return this.withRetry(
      async () => {
        const { data: branches } = await this.octokit.rest.repos.listBranches({
          owner,
          repo,
          per_page: 100,
        })

        return branches.map((branch) => ({
          id: branch.name,
          name: branch.name,
          commit: branch.commit.sha,
          protected: branch.protected,
        }))
      },
      3,
      'getBranches',
    )
  }

  async getMergeRequests(repoId: string): Promise<GitMergeRequestInfo[]> {
    const [owner, repo] = repoId.split('/')
    if (!owner || !repo) {
      throw new Error(`Invalid repository ID: ${repoId}`)
    }

    return this.withRetry(
      async () => {
        const { data: prs } = await this.octokit.rest.pulls.list({
          owner,
          repo,
          state: 'all',
          per_page: 100,
        })

        return prs.map((pr) => ({
          id: pr.number,
          title: pr.title,
          description: pr.body || '',
          status: pr.state === 'open' ? 'OPEN' : pr.merged_at ? 'MERGED' : 'CLOSED',
          sourceBranch: pr.head.ref,
          targetBranch: pr.base.ref,
          author: pr.user?.login || '',
          assignee: pr.assignee?.login,
          reviewerIds: pr.requested_reviewers?.map((r) => r.login) || [],
          labels: pr.labels.map((l: any) => (typeof l === 'string' ? l : l.name)),
          webUrl: pr.html_url,
          createdAt: new Date(pr.created_at),
          updatedAt: new Date(pr.updated_at),
          mergedAt: pr.merged_at ? new Date(pr.merged_at) : undefined,
          mergedBy: pr.merged_at ? 'unknown' : undefined,
        }))
      },
      3,
      'getMergeRequests',
    )
  }

  async createMergeRequest(
    repoId: string,
    data: import('../../../lib/types/index').CreateMergeRequestData,
  ): Promise<GitMergeRequestInfo> {
    const [owner, repo] = repoId.split('/')
    if (!owner || !repo) {
      throw new Error(`Invalid repository ID: ${repoId}`)
    }

    return this.withRetry(
      async () => {
        const { data: pr } = await this.octokit.rest.pulls.create({
          owner,
          repo,
          title: data.title,
          body: data.description,
          head: data.sourceBranch,
          base: data.targetBranch,
        })

        return {
          id: pr.number,
          title: pr.title,
          description: pr.body || '',
          status: 'OPEN' as const,
          sourceBranch: pr.head.ref,
          targetBranch: pr.base.ref,
          author: pr.user?.login || '',
          assignee: pr.assignee?.login,
          reviewerIds: [],
          labels: [],
          webUrl: pr.html_url,
          createdAt: new Date(pr.created_at),
          updatedAt: new Date(pr.updated_at),
        }
      },
      3,
      'createMergeRequest',
    )
  }

  async mergeMergeRequest(repoId: string, mrId: number): Promise<void> {
    const [owner, repo] = repoId.split('/')
    if (!owner || !repo) {
      throw new Error(`Invalid repository ID: ${repoId}`)
    }

    await this.withRetry(
      async () => {
        await this.octokit.rest.pulls.merge({
          owner,
          repo,
          pull_number: mrId,
        })
      },
      3,
      'mergeMergeRequest',
    )
  }

  async getMergeRequest(repoId: string, mrId: number): Promise<GitMergeRequestInfo> {
    const [owner, repo] = repoId.split('/')
    if (!owner || !repo) {
      throw new Error(`Invalid repository ID: ${repoId}`)
    }

    return this.withRetry(
      async () => {
        const { data: pr } = await this.octokit.rest.pulls.get({
          owner,
          repo,
          pull_number: mrId,
        })

        return {
          id: pr.number,
          title: pr.title,
          description: pr.body || '',
          status: pr.state === 'open' ? 'OPEN' : pr.merged_at ? 'MERGED' : 'CLOSED',
          sourceBranch: pr.head.ref,
          targetBranch: pr.base.ref,
          author: pr.user?.login || '',
          assignee: pr.assignee?.login,
          reviewerIds: pr.requested_reviewers?.map((r: any) => r.login) || [],
          labels: pr.labels.map((l: any) => (typeof l === 'string' ? l : l.name)),
          webUrl: pr.html_url,
          createdAt: new Date(pr.created_at),
          updatedAt: new Date(pr.updated_at),
          mergedAt: pr.merged_at ? new Date(pr.merged_at) : undefined,
          mergedBy: pr.merged_at ? 'unknown' : undefined,
        }
      },
      3,
      'getMergeRequest',
    )
  }

  async closeMergeRequest(repoId: string, mrId: number): Promise<void> {
    const [owner, repo] = repoId.split('/')
    if (!owner || !repo) {
      throw new Error(`Invalid repository ID: ${repoId}`)
    }

    await this.withRetry(
      async () => {
        await this.octokit.rest.pulls.update({
          owner,
          repo,
          pull_number: mrId,
          state: 'closed',
        })
      },
      3,
      'closeMergeRequest',
    )
  }

  async createBranch(
    repoId: string,
    branchName: string,
    sourceBranch: string,
  ): Promise<GitBranchInfo> {
    const [owner, repo] = repoId.split('/')
    if (!owner || !repo) {
      throw new Error(`Invalid repository ID: ${repoId}`)
    }

    return this.withRetry(
      async () => {
        const { data: src } = await this.octokit.rest.repos.getBranch({
          owner,
          repo,
          branch: sourceBranch,
        })

        await this.octokit.rest.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${branchName}`,
          sha: src.commit.sha,
        })

        return {
          id: branchName,
          name: branchName,
          commit: src.commit.sha,
          protected: false,
        }
      },
      3,
      'createBranch',
    )
  }

  async deleteBranch(repoId: string, branchName: string): Promise<void> {
    const [owner, repo] = repoId.split('/')
    if (!owner || !repo) {
      throw new Error(`Invalid repository ID: ${repoId}`)
    }

    await this.withRetry(
      async () => {
        await this.octokit.rest.git.deleteRef({
          owner,
          repo,
          ref: `heads/${branchName}`,
        })
      },
      3,
      'deleteBranch',
    )
  }

  async getBranch(repoId: string, branchName: string): Promise<GitBranchInfo> {
    const [owner, repo] = repoId.split('/')
    if (!owner || !repo) {
      throw new Error(`Invalid repository ID: ${repoId}`)
    }

    return this.withRetry(
      async () => {
        const { data: branch } = await this.octokit.rest.repos.getBranch({
          owner,
          repo,
          branch: branchName,
        })

        return {
          id: branch.name,
          name: branch.name,
          commit: branch.commit.sha,
          protected: branch.protected,
        }
      },
      3,
      'getBranch',
    )
  }

  async getRepository(repoId: string): Promise<GitRepositoryInfo> {
    const [owner, repo] = repoId.split('/')
    if (!owner || !repo) {
      throw new Error(`Invalid repository ID: ${repoId}`)
    }

    return this.withRetry(
      async () => {
        const { data: r } = await this.octokit.rest.repos.get({ owner, repo })
        return {
          id: r.full_name,
          name: r.name,
          fullName: r.full_name,
          description: r.description || '',
          webUrl: r.html_url,
          defaultBranch: r.default_branch,
          isPrivate: !!r.private,
        }
      },
      3,
      'getRepository',
    )
  }

  async getCommits(repoId: string): Promise<GitCommitInfo[]> {
    const [owner, repo] = repoId.split('/')
    if (!owner || !repo) {
      throw new Error(`Invalid repository ID: ${repoId}`)
    }

    return this.withRetry(
      async () => {
        const { data: commits } = await this.octokit.rest.repos.listCommits({
          owner,
          repo,
          per_page: 100,
        })
        return commits.map((c) => ({
          sha: c.sha,
          message: c.commit.message,
          author: {
            name: c.commit.author?.name || c.author?.login || '',
            email: c.commit.author?.email,
            username: c.author?.login,
          },
          date: new Date(c.commit.author?.date || Date.now()),
          url: c.html_url,
        }))
      },
      3,
      'getCommits',
    )
  }

  async getCommit(repoId: string, sha: string): Promise<GitCommitInfo> {
    const [owner, repo] = repoId.split('/')
    if (!owner || !repo) {
      throw new Error(`Invalid repository ID: ${repoId}`)
    }

    return this.withRetry(
      async () => {
        const { data: c } = await this.octokit.rest.repos.getCommit({
          owner,
          repo,
          ref: sha,
        })
        return {
          sha: c.sha,
          message: c.commit.message,
          author: {
            name: c.commit.author?.name || c.author?.login || '',
            email: c.commit.author?.email,
            username: c.author?.login,
          },
          date: new Date(c.commit.author?.date || Date.now()),
          url: c.html_url,
        }
      },
      3,
      'getCommit',
    )
  }

  async createWebhook(
    repoId: string,
    webhookUrl: string,
    events: string[],
  ): Promise<{ id: string; url: string; events: string[]; secret?: string; createdAt: Date }> {
    const [owner, repo] = repoId.split('/')
    if (!owner || !repo) {
      throw new Error(`Invalid repository ID: ${repoId}`)
    }

    return this.withRetry(
      async () => {
        const { data: hook } = await this.octokit.rest.repos.createWebhook({
          owner,
          repo,
          config: {
            url: webhookUrl,
            content_type: 'json',
          },
          events,
          active: true,
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
    const [owner, repo] = repoId.split('/')
    if (!owner || !repo) {
      throw new Error(`Invalid repository ID: ${repoId}`)
    }

    await this.withRetry(
      async () => {
        await this.octokit.rest.repos.deleteWebhook({
          owner,
          repo,
          hook_id: parseInt(webhookId, 10),
        })
      },
      3,
      'deleteWebhook',
    )
  }
}
