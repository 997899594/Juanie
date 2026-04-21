import { Octokit } from 'octokit';
import { logger } from '@/lib/logger';
import type {
  CreateBranchOptions,
  CreateRepoOptions,
  CreateReviewRequestOptions,
  CreateTagOptions,
  DeleteFilesOptions,
  GitProvider,
  GitProviderConfig,
  GitRepository,
  GitReviewRequest,
  GitUser,
  PushOptions,
  SyncBranchRefOptions,
  TriggerReleaseBuildOptions,
} from './index';

const gitHubProviderLogger = logger.child({ component: 'git-provider-github' });

interface GitHubRepositoryPayload {
  id: number | string;
  name: string;
  full_name: string;
  owner?: {
    login?: string | null;
  } | null;
  clone_url: string;
  ssh_url: string | null;
  html_url: string;
  default_branch?: string | null;
  private: boolean;
}

interface GitHubPullRequestPayload {
  number: number;
  title: string;
  state?: string | null;
  draft?: boolean;
  merged_at?: string | null;
  merge_commit_sha?: string | null;
  html_url?: string | null;
  user?: {
    login?: string | null;
    name?: string | null;
  } | null;
  head?: {
    ref?: string | null;
    sha?: string | null;
  } | null;
}

interface GitHubContentFilePayload {
  type: 'file';
  name: string;
  path: string;
  sha: string;
  content?: string;
  encoding?: string;
}

interface GitHubContentDirectoryPayload {
  type: 'dir';
  name: string;
  path: string;
}

type GitHubContentPayload =
  | GitHubContentFilePayload
  | GitHubContentDirectoryPayload
  | Array<GitHubContentFilePayload | GitHubContentDirectoryPayload>;

function mapGitHubWorkflowDispatchError(message?: string | null): string {
  const normalizedMessage = message?.trim();

  if (normalizedMessage === "Workflow does not have 'workflow_dispatch' trigger") {
    return '当前仓库的 .github/workflows/juanie-ci.yml 还没有启用 workflow_dispatch，Juanie 暂时无法直接按远端分支最新提交启动预览环境。请在 workflow 的 on: 下加入 workflow_dispatch 后重试。';
  }

  if (
    normalizedMessage === 'Workflow does not exist or does not have a workflow_dispatch trigger'
  ) {
    return '当前仓库缺少可用于直启预览环境的 .github/workflows/juanie-ci.yml，或者它还没有启用 workflow_dispatch。请检查 workflow 文件后重试。';
  }

  if (normalizedMessage === 'Workflow was disabled manually') {
    return '当前仓库的 .github/workflows/juanie-ci.yml 已被禁用，Juanie 无法触发预览构建。请先在 GitHub Actions 中重新启用该 workflow。';
  }

  return normalizedMessage || 'Failed to trigger GitHub preview build workflow';
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = error.message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
}

export class GitHubProvider implements GitProvider {
  type = 'github' as const;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(config: GitProviderConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
  }

  private getClient(accessToken: string): Octokit {
    return new Octokit({
      auth: accessToken,
    });
  }

  private parseRepoFullName(repoFullName: string): { owner: string; repo: string } {
    const [owner, repo] = repoFullName.split('/');

    if (!owner || !repo) {
      throw new Error(`Invalid GitHub repository name: ${repoFullName}`);
    }

    return { owner, repo };
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'repo workflow user:email',
      state,
      prompt: 'consent',
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  }

  async getAccessToken(code: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }> {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri,
      }),
    });

    const data = await res.json();

    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  async getUser(accessToken: string): Promise<GitUser> {
    const client = this.getClient(accessToken);
    const userResponse = await client.rest.users.getAuthenticated();

    let email = userResponse.data.email ?? null;

    if (!email) {
      try {
        const emailsResponse = await client.rest.users.listEmailsForAuthenticatedUser();
        const primaryEmail = emailsResponse.data.find((item) => item.primary);
        email = primaryEmail?.email ?? emailsResponse.data[0]?.email ?? null;
      } catch {
        email = null;
      }
    }

    return {
      id: String(userResponse.data.id),
      username: userResponse.data.login,
      name: userResponse.data.name,
      email: email || `${userResponse.data.login}@users.noreply.github.com`,
      avatarUrl: userResponse.data.avatar_url,
    };
  }

  async getRepositories(
    accessToken: string,
    options?: { page?: number; perPage?: number; search?: string }
  ): Promise<GitRepository[]> {
    const client = this.getClient(accessToken);
    const page = options?.page || 1;
    const perPage = options?.perPage || 100;

    if (options?.search) {
      const currentUser = await client.rest.users.getAuthenticated();
      const searchResponse = await client.rest.search.repos({
        q: `${options.search} user:${currentUser.data.login}`,
        per_page: perPage,
        page,
      });

      return searchResponse.data.items.map((item) =>
        this.mapRepository(item as unknown as GitHubRepositoryPayload)
      );
    }

    const response = await client.rest.repos.listForAuthenticatedUser({
      page,
      per_page: perPage,
      sort: 'updated',
    });

    return response.data.map((item) =>
      this.mapRepository(item as unknown as GitHubRepositoryPayload)
    );
  }

  async getRepository(accessToken: string, fullName: string): Promise<GitRepository | null> {
    const client = this.getClient(accessToken);
    const { owner, repo } = this.parseRepoFullName(fullName);

    try {
      const response = await client.rest.repos.get({ owner, repo });
      return this.mapRepository(response.data as unknown as GitHubRepositoryPayload);
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  async getReviewRequest(
    accessToken: string,
    repoFullName: string,
    number: number
  ): Promise<GitReviewRequest | null> {
    const client = this.getClient(accessToken);
    const { owner, repo } = this.parseRepoFullName(repoFullName);

    try {
      const response = await client.rest.pulls.get({ owner, repo, pull_number: number });
      const data = response.data as unknown as GitHubPullRequestPayload;
      const state = this.mapReviewState({
        draft: Boolean(data.draft),
        state: typeof data.state === 'string' ? data.state : null,
        mergedAt: typeof data.merged_at === 'string' ? data.merged_at : null,
      });

      return {
        number,
        kind: 'pull_request',
        label: `PR #${number}`,
        title: data.title,
        state,
        stateLabel: this.getReviewStateLabel(state),
        authorName: data.user?.name ?? data.user?.login ?? null,
        webUrl: data.html_url ?? null,
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  async resolveRefToCommitSha(
    accessToken: string,
    repoFullName: string,
    ref: string
  ): Promise<string | null> {
    const client = this.getClient(accessToken);
    const { owner, repo } = this.parseRepoFullName(repoFullName);

    if (ref.startsWith('refs/heads/')) {
      const branch = ref.slice('refs/heads/'.length);

      try {
        const response = await client.rest.repos.getBranch({ owner, repo, branch });
        return response.data.commit.sha;
      } catch (error) {
        if (isNotFoundError(error)) {
          return null;
        }

        throw error;
      }
    }

    const prMatch = ref.match(/^refs\/pull\/(\d+)\/(head|merge)$/);
    if (!prMatch) {
      return null;
    }

    const [, prNumber, target] = prMatch;
    const response = await client.rest.pulls.get({
      owner,
      repo,
      pull_number: Number(prNumber),
    });
    const data = response.data as unknown as GitHubPullRequestPayload;

    if (target === 'merge' && typeof data.merge_commit_sha === 'string') {
      return data.merge_commit_sha;
    }

    return data.head?.sha ?? null;
  }

  async triggerReleaseBuild(
    accessToken: string,
    options: TriggerReleaseBuildOptions
  ): Promise<void> {
    const client = this.getClient(accessToken);
    const { owner, repo } = this.parseRepoFullName(options.repoFullName);
    let dispatchRef: string | null = null;

    if (options.ref.startsWith('refs/heads/')) {
      dispatchRef = options.ref.slice('refs/heads/'.length);
    } else {
      const prMatch = options.ref.match(/^refs\/pull\/(\d+)\/(head|merge)$/);
      if (prMatch) {
        const response = await client.rest.pulls.get({
          owner,
          repo,
          pull_number: Number(prMatch[1]),
        });
        const data = response.data as unknown as GitHubPullRequestPayload;
        dispatchRef = data.head?.ref ?? null;
      }
    }

    if (!dispatchRef) {
      throw new Error('当前来源无法触发 GitHub 预览构建，请改用分支启动');
    }

    try {
      await client.rest.actions.createWorkflowDispatch({
        owner,
        repo,
        workflow_id: 'juanie-ci.yml',
        ref: dispatchRef,
        inputs: {
          juanie_source_sha: options.sourceCommitSha,
          juanie_release_ref: options.releaseRef ?? options.ref,
          juanie_force_full_build: options.forceFullBuild ? 'true' : 'false',
        },
      });
    } catch (error) {
      throw new Error(mapGitHubWorkflowDispatchError(getErrorMessage(error, '')));
    }
  }

  async createRepository(accessToken: string, options: CreateRepoOptions): Promise<GitRepository> {
    const client = this.getClient(accessToken);
    const response = await client.rest.repos.createForAuthenticatedUser({
      name: options.name,
      description: options.description,
      private: options.isPrivate,
      auto_init: options.autoInit ?? true,
    });

    return this.mapRepository(response.data as unknown as GitHubRepositoryPayload);
  }

  async createBranch(accessToken: string, options: CreateBranchOptions): Promise<void> {
    const client = this.getClient(accessToken);
    const { owner, repo } = this.parseRepoFullName(options.repoFullName);
    const sourceRef = await client.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${options.fromBranch}`,
    });

    const sha = sourceRef.data.object.sha;
    if (!sha) {
      throw new Error(`Source branch ${options.fromBranch} has no resolvable commit SHA`);
    }

    try {
      await client.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${options.branch}`,
        sha,
      });
    } catch (error) {
      if (!('status' in Object(error ?? {}) && (error as { status?: number }).status === 422)) {
        throw new Error(getErrorMessage(error, `Failed to create branch ${options.branch}`));
      }
    }
  }

  async syncBranchRef(accessToken: string, options: SyncBranchRefOptions): Promise<void> {
    const client = this.getClient(accessToken);
    const { owner, repo } = this.parseRepoFullName(options.repoFullName);
    const branchRef = `heads/${options.branch}`;
    const currentSha = await this.resolveRefToCommitSha(
      accessToken,
      options.repoFullName,
      `refs/heads/${options.branch}`
    );

    if (currentSha === options.commitSha) {
      return;
    }

    if (currentSha) {
      await client.rest.git.updateRef({
        owner,
        repo,
        ref: branchRef,
        sha: options.commitSha,
        force: true,
      });
      return;
    }

    try {
      await client.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${options.branch}`,
        sha: options.commitSha,
      });
    } catch (error) {
      if (!('status' in Object(error ?? {}) && (error as { status?: number }).status === 422)) {
        throw new Error(getErrorMessage(error, `Failed to create branch ${options.branch}`));
      }

      await client.rest.git.updateRef({
        owner,
        repo,
        ref: branchRef,
        sha: options.commitSha,
        force: true,
      });
    }
  }

  async createTag(accessToken: string, options: CreateTagOptions): Promise<void> {
    const client = this.getClient(accessToken);
    const { owner, repo } = this.parseRepoFullName(options.repoFullName);

    try {
      await client.rest.git.createRef({
        owner,
        repo,
        ref: `refs/tags/${options.tag}`,
        sha: options.commitSha,
      });
    } catch (error) {
      if (!('status' in Object(error ?? {}) && (error as { status?: number }).status === 422)) {
        throw new Error(getErrorMessage(error, `Failed to create tag ${options.tag}`));
      }
    }
  }

  async createReviewRequest(
    accessToken: string,
    options: CreateReviewRequestOptions
  ): Promise<GitReviewRequest> {
    const client = this.getClient(accessToken);
    const { owner, repo } = this.parseRepoFullName(options.repoFullName);
    const response = await client.rest.pulls.create({
      owner,
      repo,
      title: options.title,
      body: options.body ?? '',
      head: options.headBranch,
      base: options.baseBranch,
      draft: options.draft ?? true,
    });

    const data = response.data as unknown as GitHubPullRequestPayload;
    const state = this.mapReviewState({
      draft: Boolean(data.draft),
      state: typeof data.state === 'string' ? data.state : null,
      mergedAt: typeof data.merged_at === 'string' ? data.merged_at : null,
    });

    return {
      number: data.number,
      kind: 'pull_request',
      label: `PR #${data.number}`,
      title: data.title,
      state,
      stateLabel: this.getReviewStateLabel(state),
      authorName: data.user?.name ?? data.user?.login ?? null,
      webUrl: data.html_url ?? null,
    };
  }

  async pushFiles(accessToken: string, options: PushOptions): Promise<void> {
    const client = this.getClient(accessToken);
    const { owner, repo } = this.parseRepoFullName(options.repoFullName);

    for (const [path, content] of Object.entries(options.files)) {
      let existingFileSha: string | undefined;

      try {
        const existing = await client.rest.repos.getContent({
          owner,
          repo,
          path,
          ref: options.branch,
        });
        const data = existing.data as unknown as GitHubContentFilePayload;
        existingFileSha = Array.isArray(existing.data) ? undefined : data.sha;
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }
      }

      try {
        await client.rest.repos.createOrUpdateFileContents({
          owner,
          repo,
          path,
          message: options.message,
          content: Buffer.from(content).toString('base64'),
          branch: options.branch,
          sha: existingFileSha,
        });
      } catch (error) {
        gitHubProviderLogger.error('Failed to push file to GitHub repository', {
          path,
          repoFullName: options.repoFullName,
          branch: options.branch,
          response: getErrorMessage(error, 'Unknown GitHub error'),
        });
        throw new Error(getErrorMessage(error, `Failed to push file: ${path}`));
      }
    }
  }

  async deleteFiles(accessToken: string, options: DeleteFilesOptions): Promise<void> {
    const client = this.getClient(accessToken);
    const { owner, repo } = this.parseRepoFullName(options.repoFullName);

    for (const path of options.paths) {
      let existingFileSha: string | null = null;

      try {
        const existing = await client.rest.repos.getContent({
          owner,
          repo,
          path,
          ref: options.branch,
        });
        if (!Array.isArray(existing.data)) {
          existingFileSha = (existing.data as unknown as GitHubContentFilePayload).sha;
        }
      } catch (error) {
        if (isNotFoundError(error)) {
          continue;
        }

        throw new Error(getErrorMessage(error, `Failed to inspect file: ${path}`));
      }

      if (!existingFileSha) {
        throw new Error(`Failed to resolve file sha for deletion: ${path}`);
      }

      try {
        await client.rest.repos.deleteFile({
          owner,
          repo,
          path,
          message: options.message,
          sha: existingFileSha,
          branch: options.branch,
        });
      } catch (error) {
        if (isNotFoundError(error)) {
          continue;
        }

        throw new Error(getErrorMessage(error, `Failed to delete file: ${path}`));
      }
    }
  }

  async listRootFiles(
    accessToken: string,
    repoFullName: string,
    branch?: string
  ): Promise<string[]> {
    const items = await this.getDirectoryContents(accessToken, repoFullName, '', branch);

    return items.filter((item) => item.type === 'file').map((item) => item.path);
  }

  async fileExists(
    accessToken: string,
    repoFullName: string,
    path: string,
    branch?: string
  ): Promise<boolean> {
    const client = this.getClient(accessToken);
    const { owner, repo } = this.parseRepoFullName(repoFullName);

    try {
      await client.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });
      return true;
    } catch (error) {
      if (isNotFoundError(error)) {
        return false;
      }

      throw error;
    }
  }

  async getFileContent(
    accessToken: string,
    repoFullName: string,
    path: string,
    branch?: string
  ): Promise<string | null> {
    const client = this.getClient(accessToken);
    const { owner, repo } = this.parseRepoFullName(repoFullName);

    try {
      const response = await client.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });

      if (Array.isArray(response.data)) {
        return null;
      }

      const data = response.data as unknown as GitHubContentFilePayload;
      if (data.type !== 'file' || !data.content) {
        return null;
      }

      return Buffer.from(data.content, 'base64').toString('utf-8');
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  async listDirectory(
    accessToken: string,
    repoFullName: string,
    path: string,
    branch?: string
  ): Promise<Array<{ name: string; path: string; type: 'file' | 'dir' }>> {
    return this.getDirectoryContents(accessToken, repoFullName, path, branch);
  }

  private async getDirectoryContents(
    accessToken: string,
    repoFullName: string,
    path: string,
    branch?: string
  ): Promise<Array<{ name: string; path: string; type: 'file' | 'dir' }>> {
    const client = this.getClient(accessToken);
    const { owner, repo } = this.parseRepoFullName(repoFullName);

    try {
      const response = await client.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path,
        ref: branch,
      });
      const data = response.data as GitHubContentPayload;

      if (!Array.isArray(data)) {
        return [];
      }

      return data.map((item) => ({
        name: item.name,
        path: item.path,
        type: item.type === 'dir' ? 'dir' : 'file',
      }));
    } catch (error) {
      if (isNotFoundError(error)) {
        return [];
      }

      throw error;
    }
  }

  private mapRepository(data: GitHubRepositoryPayload): GitRepository {
    return {
      id: String(data.id),
      name: data.name,
      fullName: data.full_name,
      owner: data.owner?.login ?? '',
      cloneUrl: data.clone_url,
      sshUrl: data.ssh_url,
      webUrl: data.html_url,
      defaultBranch: data.default_branch || 'main',
      isPrivate: data.private,
    };
  }

  private mapReviewState(input: {
    draft: boolean;
    state: string | null;
    mergedAt: string | null;
  }): GitReviewRequest['state'] {
    if (input.mergedAt) {
      return 'merged';
    }
    if (input.draft) {
      return 'draft';
    }
    if (input.state === 'open') {
      return 'open';
    }
    if (input.state === 'closed') {
      return 'closed';
    }
    return 'unknown';
  }

  private getReviewStateLabel(state: GitReviewRequest['state']): string {
    switch (state) {
      case 'open':
        return '进行中';
      case 'closed':
        return '已关闭';
      case 'merged':
        return '已合并';
      case 'draft':
        return '草稿';
      default:
        return '未知';
    }
  }
}
