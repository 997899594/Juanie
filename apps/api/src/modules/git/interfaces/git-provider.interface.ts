export interface GitProvider {
  readonly name: string

  // 分支操作
  createBranch(repoId: string, branchName: string, sourceBranch: string): Promise<GitBranchInfo>
  deleteBranch(repoId: string, branchName: string): Promise<void>
  getBranches(repoId: string): Promise<GitBranchInfo[]>
  getBranch(repoId: string, branchName: string): Promise<GitBranchInfo>

  // 合并请求操作
  createMergeRequest(repoId: string, data: CreateMergeRequestData): Promise<GitMergeRequestInfo>
  getMergeRequests(
    repoId: string,
    options?: GetMergeRequestsOptions,
  ): Promise<GitMergeRequestInfo[]>
  getMergeRequest(repoId: string, mrId: number): Promise<GitMergeRequestInfo>
  mergeMergeRequest(repoId: string, mrId: number, options?: MergeOptions): Promise<void>

  // 提交操作
  getCommits(repoId: string, options?: GetCommitsOptions): Promise<GitCommitInfo[]>
  getCommit(repoId: string, sha: string): Promise<GitCommitInfo>

  // 仓库操作
  getRepository(repoId: string): Promise<GitRepositoryInfo>

  // Webhook操作
  createWebhook(repoId: string, webhookUrl: string, events: string[]): Promise<GitWebhookInfo>
  deleteWebhook(repoId: string, webhookId: string): Promise<void>
}

export interface GitBranchInfo {
  name: string
  sha: string
  protected: boolean
  default: boolean
  lastCommit?: GitCommitInfo
}

export interface GitMergeRequestInfo {
  id: number
  title: string
  description?: string
  sourceBranch: string
  targetBranch: string
  status: 'open' | 'merged' | 'closed' | 'draft'
  author: GitAuthorInfo
  assignee?: GitAuthorInfo
  reviewers: GitAuthorInfo[]
  labels: string[]
  createdAt: Date
  updatedAt: Date
  mergedAt?: Date
  closedAt?: Date
}

export interface GitCommitInfo {
  sha: string
  message: string
  author: GitAuthorInfo
  committer: GitAuthorInfo
  date: Date
  url?: string
  stats?: {
    additions: number
    deletions: number
    total: number
  }
}

export interface GitAuthorInfo {
  name: string
  email: string
  username?: string
  avatarUrl?: string
}

export interface GitRepositoryInfo {
  id: string
  name: string
  fullName: string
  description?: string
  url: string
  defaultBranch: string
  private: boolean
  language?: string
}

export interface GitWebhookInfo {
  id: string
  url: string
  events: string[]
  active: boolean
}

export interface CreateMergeRequestData {
  title: string
  description?: string
  sourceBranch: string
  targetBranch: string
  assigneeId?: string
  reviewerIds?: string[]
  labels?: string[]
}

export interface GetMergeRequestsOptions {
  state?: 'open' | 'merged' | 'closed' | 'all'
  page?: number
  perPage?: number
}

export interface GetCommitsOptions {
  branch?: string
  since?: Date
  until?: Date
  page?: number
  perPage?: number
}

export interface MergeOptions {
  mergeMethod?: 'merge' | 'squash' | 'rebase'
  commitMessage?: string
  deleteSourceBranch?: boolean
}
