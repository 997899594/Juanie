import type { GitProviderType } from '@/lib/db/schema';

export interface GitUser {
  id: string;
  username: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface GitRepository {
  id: string;
  name: string;
  fullName: string;
  owner: string;
  cloneUrl: string;
  sshUrl: string | null;
  webUrl: string;
  defaultBranch: string;
  isPrivate: boolean;
}

export interface GitReviewRequest {
  number: number;
  kind: 'pull_request' | 'merge_request';
  label: string;
  title: string;
  state: 'open' | 'closed' | 'merged' | 'draft' | 'unknown';
  stateLabel: string;
  authorName: string | null;
  webUrl: string | null;
}

export interface CreateRepoOptions {
  name: string;
  description?: string;
  isPrivate: boolean;
  autoInit?: boolean;
}

export interface PushOptions {
  repoFullName: string;
  branch: string;
  files: Record<string, string>;
  message: string;
}

export interface GitProviderConfig {
  type: GitProviderType;
  serverUrl?: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GitProvider {
  type: GitProviderType;

  getAuthUrl(state: string): string;
  getAccessToken(code: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }>;
  getUser(accessToken: string): Promise<GitUser>;

  getRepositories(
    accessToken: string,
    options?: {
      page?: number;
      perPage?: number;
      search?: string;
    }
  ): Promise<GitRepository[]>;

  getRepository(accessToken: string, fullName: string): Promise<GitRepository | null>;
  getReviewRequest(
    accessToken: string,
    repoFullName: string,
    number: number
  ): Promise<GitReviewRequest | null>;

  createRepository(accessToken: string, options: CreateRepoOptions): Promise<GitRepository>;

  pushFiles(accessToken: string, options: PushOptions): Promise<void>;

  /**
   * List files in the root directory of a repository.
   * Used for monorepo type detection.
   */
  listRootFiles(accessToken: string, repoFullName: string, branch?: string): Promise<string[]>;

  /**
   * Check if a file exists in the repository.
   */
  fileExists(
    accessToken: string,
    repoFullName: string,
    path: string,
    branch?: string
  ): Promise<boolean>;

  /**
   * Get content of a file in the repository.
   */
  getFileContent(
    accessToken: string,
    repoFullName: string,
    path: string,
    branch?: string
  ): Promise<string | null>;

  /**
   * List contents of a directory in the repository.
   */
  listDirectory(
    accessToken: string,
    repoFullName: string,
    path: string,
    branch?: string
  ): Promise<Array<{ name: string; path: string; type: 'file' | 'dir' }>>;
}

export function createGitProvider(config: GitProviderConfig): GitProvider {
  switch (config.type) {
    case 'github':
      return new GitHubProvider(config);
    case 'gitlab':
    case 'gitlab-self-hosted':
      return new GitLabProvider(config);
    default:
      throw new Error(`Unsupported git provider: ${config.type}`);
  }
}

import { GitHubProvider } from './github';
import { GitLabProvider } from './gitlab';
