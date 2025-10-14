import type {
  CreateMergeRequestData,
  GetCommitsOptions,
  GetMergeRequestsOptions,
  GitCommitInfo,
  GitWebhookInfo,
  MergeOptions,
} from "../../../lib/types";

export interface GitBranchInfo {
  id: string;
  name: string;
  commit: string;
  protected: boolean;
}

export interface GitMergeRequestInfo {
  id: number;
  title: string;
  description?: string;
  status: "OPEN" | "MERGED" | "CLOSED" | "DRAFT";
  sourceBranch: string;
  targetBranch: string;
  author: string;
  assignee?: string;
  reviewerIds: string[];
  labels: string[];
  webUrl: string;
  createdAt: Date;
  updatedAt: Date;
  mergedAt?: Date;
  mergedBy?: string;
}

export interface GitRepositoryInfo {
  id: string;
  name: string;
  fullName: string;
  description?: string;
  isPrivate: boolean;
  defaultBranch: string;
  webUrl: string;
}

export interface GitProvider {
  readonly name: string;

  // 分支操作
  createBranch(
    repoId: string,
    branchName: string,
    sourceBranch: string
  ): Promise<GitBranchInfo>;
  deleteBranch(repoId: string, branchName: string): Promise<void>;
  getBranches(repoId: string): Promise<GitBranchInfo[]>;
  getBranch(repoId: string, branchName: string): Promise<GitBranchInfo>;

  // 合并请求操作
  createMergeRequest(
    repoId: string,
    data: CreateMergeRequestData
  ): Promise<GitMergeRequestInfo>;
  getMergeRequests(
    repoId: string,
    options?: GetMergeRequestsOptions
  ): Promise<GitMergeRequestInfo[]>;
  getMergeRequest(repoId: string, mrId: number): Promise<GitMergeRequestInfo>;
  mergeMergeRequest(
    repoId: string,
    mrId: number,
    options?: MergeOptions
  ): Promise<void>;

  // 提交操作
  getCommits(
    repoId: string,
    options?: GetCommitsOptions
  ): Promise<GitCommitInfo[]>;
  getCommit(repoId: string, sha: string): Promise<GitCommitInfo>;

  // 仓库操作
  getRepository(repoId: string): Promise<GitRepositoryInfo>;

  // Webhook操作
  createWebhook(
    repoId: string,
    webhookUrl: string,
    events: string[]
  ): Promise<GitWebhookInfo>;
  deleteWebhook(repoId: string, webhookId: string): Promise<void>;
}
