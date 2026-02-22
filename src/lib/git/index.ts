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

export interface WebhookOptions {
  repoFullName: string;
  webhookUrl: string;
  secret: string;
  events: string[];
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

  createRepository(accessToken: string, options: CreateRepoOptions): Promise<GitRepository>;

  pushFiles(accessToken: string, options: PushOptions): Promise<void>;

  createWebhook(accessToken: string, options: WebhookOptions): Promise<{ id: string }>;
  deleteWebhook(accessToken: string, repoFullName: string, webhookId: string): Promise<void>;
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
