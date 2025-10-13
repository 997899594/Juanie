import { Injectable } from '@nestjs/common'
import { Octokit } from '@octokit/rest'
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
export class GitHubProvider implements GitProvider {
  private octokit: Octokit

  constructor(accessToken: string) {
    this.octokit = new Octokit({ auth: accessToken })
  }

  async createBranch(
    repoId: string,
    branchName: string,
    sourceBranch: string,
  ): Promise<GitBranchInfo> {
    const [owner, repo] = repoId.split('/')

    try {
      // 获取源分支的 SHA
      const { data: sourceBranchData } = await this.octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${sourceBranch}`,
      })

      // 创建新分支
      await this.octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: sourceBranchData.object.sha,
      })

      // 获取分支信息
      const { data: branchData } = await this.octokit.rest.repos.getBranch({
        owner,
        repo,
        branch: branchName,
      })

      return {
        name: branchData.name,
        sha: branchData.commit.sha,
        protected: branchData.protected,
        default: false,
        lastCommit: {
          sha: branchData.commit.sha,
          message: branchData.commit.commit.message,
          author: branchData.commit.commit.author?.name || 'Unknown',
          date: new Date(branchData.commit.commit.author?.date || Date.now()),
        },
      }
    } catch (error) {
      throw new Error(`GitHub API error: ${error.message}`)
    }
  }

  async deleteBranch(repoId: string, branchName: string): Promise<void> {
    const [owner, repo] = repoId.split('/')

    try {
      await this.octokit.rest.git.deleteRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
      })
    } catch (error) {
      throw new Error(`GitHub API error: ${error.message}`)
    }
  }

  async getBranches(repoId: string): Promise<GitBranchInfo[]> {
    const [owner, repo] = repoId.split('/')

    try {
      const { data: branches } = await this.octokit.rest.repos.listBranches({
        owner,
        repo,
        per_page: 100,
      })

      return branches.map((branch) => ({
        name: branch.name,
        sha: branch.commit.sha,
        protected: branch.protected,
        default: false, // GitHub API doesn't provide this in list
        lastCommit: {
          sha: branch.commit.sha,
          message: 'N/A', // Not available in list API
          author: 'N/A',
          date: new Date(),
        },
      }))
    } catch (error) {
      throw new Error(`GitHub API error: ${error.message}`)
    }
  }

  async createMergeRequest(
    repoId: string,
    input: CreateMergeRequestInput,
  ): Promise<GitMergeRequestInfo> {
    const [owner, repo] = repoId.split('/')

    try {
      const { data: pr } = await this.octokit.rest.pulls.create({
        owner,
        repo,
        title: input.title,
        body: input.description,
        head: input.sourceBranch,
        base: input.targetBranch,
        draft: false,
      })

      return {
        id: pr.number.toString(),
        title: pr.title,
        description: pr.body || '',
        sourceBranch: pr.head.ref,
        targetBranch: pr.base.ref,
        status: pr.state === 'open' ? 'OPEN' : 'CLOSED',
        url: pr.html_url,
        assigneeId: pr.assignee?.login,
        reviewerIds: pr.requested_reviewers?.map((r) => r.login) || [],
        labels: pr.labels?.map((l) => l.name) || [],
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : undefined,
        mergedBy: pr.merged_by?.login,
      }
    } catch (error) {
      throw new Error(`GitHub API error: ${error.message}`)
    }
  }

  async getMergeRequests(repoId: string): Promise<GitMergeRequestInfo[]> {
    const [owner, repo] = repoId.split('/')

    try {
      const { data: prs } = await this.octokit.rest.pulls.list({
        owner,
        repo,
        state: 'all',
        per_page: 100,
      })

      return prs.map((pr) => ({
        id: pr.number.toString(),
        title: pr.title,
        description: pr.body || '',
        sourceBranch: pr.head.ref,
        targetBranch: pr.base.ref,
        status: pr.state === 'open' ? 'OPEN' : pr.merged_at ? 'MERGED' : 'CLOSED',
        url: pr.html_url,
        assigneeId: pr.assignee?.login,
        reviewerIds: pr.requested_reviewers?.map((r) => r.login) || [],
        labels: pr.labels?.map((l) => l.name) || [],
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : undefined,
        mergedBy: pr.merged_by?.login,
      }))
    } catch (error) {
      throw new Error(`GitHub API error: ${error.message}`)
    }
  }

  async mergeMergeRequest(repoId: string, mrId: string): Promise<void> {
    const [owner, repo] = repoId.split('/')

    try {
      await this.octokit.rest.pulls.merge({
        owner,
        repo,
        pull_number: parseInt(mrId),
        merge_method: 'merge',
      })
    } catch (error) {
      throw new Error(`GitHub API error: ${error.message}`)
    }
  }

  async closeMergeRequest(repoId: string, mrId: string): Promise<void> {
    const [owner, repo] = repoId.split('/')

    try {
      await this.octokit.rest.pulls.update({
        owner,
        repo,
        pull_number: parseInt(mrId),
        state: 'closed',
      })
    } catch (error) {
      throw new Error(`GitHub API error: ${error.message}`)
    }
  }

  async getCommits(repoId: string, branch?: string): Promise<GitCommitInfo[]> {
    const [owner, repo] = repoId.split('/')

    try {
      const { data: commits } = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        sha: branch,
        per_page: 50,
      })

      return commits.map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author?.name || 'Unknown',
        date: new Date(commit.commit.author?.date || Date.now()),
        url: commit.html_url,
      }))
    } catch (error) {
      throw new Error(`GitHub API error: ${error.message}`)
    }
  }

  async getRepository(repoId: string): Promise<GitRepositoryInfo> {
    const [owner, repo] = repoId.split('/')

    try {
      const { data: repository } = await this.octokit.rest.repos.get({
        owner,
        repo,
      })

      return {
        id: repository.id.toString(),
        name: repository.name,
        fullName: repository.full_name,
        description: repository.description || '',
        url: repository.html_url,
        defaultBranch: repository.default_branch,
        private: repository.private,
      }
    } catch (error) {
      throw new Error(`GitHub API error: ${error.message}`)
    }
  }

  async createWebhook(repoId: string, input: CreateWebhookInput): Promise<string> {
    const [owner, repo] = repoId.split('/')

    try {
      const { data: webhook } = await this.octokit.rest.repos.createWebhook({
        owner,
        repo,
        config: {
          url: input.url,
          content_type: 'json',
          secret: input.secret,
        },
        events: input.events,
      })

      return webhook.id.toString()
    } catch (error) {
      throw new Error(`GitHub API error: ${error.message}`)
    }
  }

  async deleteWebhook(repoId: string, webhookId: string): Promise<void> {
    const [owner, repo] = repoId.split('/')

    try {
      await this.octokit.rest.repos.deleteWebhook({
        owner,
        repo,
        hook_id: parseInt(webhookId),
      })
    } catch (error) {
      throw new Error(`GitHub API error: ${error.message}`)
    }
  }
}
