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
    const res = await fetch('https://api.github.com/user', {
      headers: this.getHeaders(accessToken),
    });

    if (!res.ok) {
      throw new Error('Failed to get user');
    }

    const data = await res.json();

    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: this.getHeaders(accessToken),
    });

    let email = data.email;
    if (!email && emailsRes.ok) {
      const emails = await emailsRes.json();
      const primaryEmail = emails.find((e: { primary: boolean; email: string }) => e.primary);
      email = primaryEmail?.email || emails[0]?.email;
    }

    return {
      id: String(data.id),
      username: data.login,
      name: data.name,
      email: email || `${data.login}@users.noreply.github.com`,
      avatarUrl: data.avatar_url,
    };
  }

  async getRepositories(
    accessToken: string,
    options?: { page?: number; perPage?: number; search?: string }
  ): Promise<GitRepository[]> {
    const page = options?.page || 1;
    const perPage = options?.perPage || 100;

    const url = `https://api.github.com/user/repos?page=${page}&per_page=${perPage}&sort=updated`;

    if (options?.search) {
      const searchRes = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(options.search)}+user:@me&per_page=${perPage}`,
        { headers: this.getHeaders(accessToken) }
      );
      if (!searchRes.ok) return [];
      const searchData = await searchRes.json();
      return searchData.items.map(this.mapRepository);
    }

    const res = await fetch(url, { headers: this.getHeaders(accessToken) });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return data.map(this.mapRepository);
  }

  async getRepository(accessToken: string, fullName: string): Promise<GitRepository | null> {
    const res = await fetch(`https://api.github.com/repos/${fullName}`, {
      headers: this.getHeaders(accessToken),
    });

    if (!res.ok) {
      return null;
    }

    return this.mapRepository(await res.json());
  }

  async getReviewRequest(
    accessToken: string,
    repoFullName: string,
    number: number
  ): Promise<GitReviewRequest | null> {
    const [owner, repo] = repoFullName.split('/');
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}`, {
      headers: this.getHeaders(accessToken),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const state = this.mapReviewState({
      draft: Boolean(data.draft),
      state: typeof data.state === 'string' ? data.state : null,
      mergedAt: typeof data.merged_at === 'string' ? data.merged_at : null,
    });

    return {
      number,
      kind: 'pull_request',
      label: `PR #${number}`,
      title: data.title as string,
      state,
      stateLabel: this.getReviewStateLabel(state),
      authorName: ((data.user as { name?: string | null; login?: string | null } | undefined)
        ?.name ??
        (data.user as { login?: string | null } | undefined)?.login ??
        null) as string | null,
      webUrl: (data.html_url as string | null) ?? null,
    };
  }

  async resolveRefToCommitSha(
    accessToken: string,
    repoFullName: string,
    ref: string
  ): Promise<string | null> {
    const [owner, repo] = repoFullName.split('/');

    if (ref.startsWith('refs/heads/')) {
      const branch = ref.slice('refs/heads/'.length);
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`,
        {
          headers: this.getHeaders(accessToken),
        }
      );

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      const sha = (data.commit as { sha?: string } | undefined)?.sha;
      return typeof sha === 'string' ? sha : null;
    }

    const prMatch = ref.match(/^refs\/pull\/(\d+)\/(head|merge)$/);
    if (prMatch) {
      const [, prNumber, target] = prMatch;
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
        headers: this.getHeaders(accessToken),
      });

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      if (target === 'merge' && typeof data.merge_commit_sha === 'string') {
        return data.merge_commit_sha;
      }

      const headSha = (data.head as { sha?: string } | undefined)?.sha;
      return typeof headSha === 'string' ? headSha : null;
    }

    return null;
  }

  async triggerReleaseBuild(
    accessToken: string,
    options: TriggerReleaseBuildOptions
  ): Promise<void> {
    const [owner, repo] = options.repoFullName.split('/');
    let dispatchRef: string | null = null;

    if (options.ref.startsWith('refs/heads/')) {
      dispatchRef = options.ref.slice('refs/heads/'.length);
    } else {
      const prMatch = options.ref.match(/^refs\/pull\/(\d+)\/(head|merge)$/);
      if (prMatch) {
        const [, prNumber] = prMatch;
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
          headers: this.getHeaders(accessToken),
        });

        if (!res.ok) {
          const error = await res.json().catch(() => null);
          throw new Error(
            error && typeof error.message === 'string'
              ? error.message
              : `Failed to resolve pull request #${prNumber} for preview build`
          );
        }

        const data = await res.json();
        const headRef = (data.head as { ref?: string } | undefined)?.ref;
        dispatchRef = typeof headRef === 'string' && headRef.trim().length > 0 ? headRef : null;
      }
    }

    if (!dispatchRef) {
      throw new Error('当前来源无法触发 GitHub 预览构建，请改用分支启动');
    }

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/juanie-ci.yml/dispatches`,
      {
        method: 'POST',
        headers: this.getHeaders(accessToken),
        body: JSON.stringify({
          ref: dispatchRef,
          inputs: {
            juanie_source_sha: options.sourceCommitSha,
            juanie_release_ref: options.releaseRef ?? options.ref,
            juanie_force_full_build: options.forceFullBuild ? 'true' : 'false',
          },
        }),
      }
    );

    if (!res.ok) {
      const error = await res.json().catch(() => null);
      throw new Error(
        mapGitHubWorkflowDispatchError(
          error && typeof error.message === 'string' ? error.message : null
        )
      );
    }
  }

  async createRepository(accessToken: string, options: CreateRepoOptions): Promise<GitRepository> {
    const res = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify({
        name: options.name,
        description: options.description,
        private: options.isPrivate,
        auto_init: options.autoInit ?? true,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to create repository');
    }

    return this.mapRepository(await res.json());
  }

  async createBranch(accessToken: string, options: CreateBranchOptions): Promise<void> {
    const [owner, repo] = options.repoFullName.split('/');
    const sourceRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${options.fromBranch}`,
      {
        headers: this.getHeaders(accessToken),
      }
    );

    if (!sourceRes.ok) {
      const error = await sourceRes.json();
      throw new Error(error.message || `Failed to load source branch ${options.fromBranch}`);
    }

    const sourceData = await sourceRes.json();
    const sha = sourceData.object?.sha;

    if (!sha || typeof sha !== 'string') {
      throw new Error(`Source branch ${options.fromBranch} has no resolvable commit SHA`);
    }

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify({
        ref: `refs/heads/${options.branch}`,
        sha,
      }),
    });

    if (!res.ok && res.status !== 422) {
      const error = await res.json();
      throw new Error(error.message || `Failed to create branch ${options.branch}`);
    }
  }

  async syncBranchRef(accessToken: string, options: SyncBranchRefOptions): Promise<void> {
    const [owner, repo] = options.repoFullName.split('/');
    const branchPath = `heads/${options.branch}`;
    const currentSha = await this.resolveRefToCommitSha(
      accessToken,
      options.repoFullName,
      `refs/heads/${options.branch}`
    );

    if (currentSha === options.commitSha) {
      return;
    }

    if (currentSha) {
      const updateRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/refs/${branchPath}`,
        {
          method: 'PATCH',
          headers: this.getHeaders(accessToken),
          body: JSON.stringify({
            sha: options.commitSha,
            force: true,
          }),
        }
      );

      if (!updateRes.ok) {
        const error = await updateRes.json().catch(() => null);
        throw new Error(
          (error as { message?: string } | null)?.message ??
            `Failed to sync branch ${options.branch}`
        );
      }

      return;
    }

    const createRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify({
        ref: `refs/heads/${options.branch}`,
        sha: options.commitSha,
      }),
    });

    if (!createRes.ok && createRes.status !== 422) {
      const error = await createRes.json().catch(() => null);
      throw new Error(
        (error as { message?: string } | null)?.message ??
          `Failed to create branch ${options.branch}`
      );
    }

    if (createRes.status === 422) {
      const retryRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/refs/${branchPath}`,
        {
          method: 'PATCH',
          headers: this.getHeaders(accessToken),
          body: JSON.stringify({
            sha: options.commitSha,
            force: true,
          }),
        }
      );

      if (!retryRes.ok) {
        const error = await retryRes.json().catch(() => null);
        throw new Error(
          (error as { message?: string } | null)?.message ??
            `Failed to sync branch ${options.branch}`
        );
      }
    }
  }

  async createTag(accessToken: string, options: CreateTagOptions): Promise<void> {
    const [owner, repo] = options.repoFullName.split('/');
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify({
        ref: `refs/tags/${options.tag}`,
        sha: options.commitSha,
      }),
    });

    if (!res.ok && res.status !== 422) {
      const error = await res.json().catch(() => null);
      throw new Error(
        (error as { message?: string } | null)?.message ?? `Failed to create tag ${options.tag}`
      );
    }
  }

  async createReviewRequest(
    accessToken: string,
    options: CreateReviewRequestOptions
  ): Promise<GitReviewRequest> {
    const [owner, repo] = options.repoFullName.split('/');
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify({
        title: options.title,
        body: options.body ?? '',
        head: options.headBranch,
        base: options.baseBranch,
        draft: options.draft ?? true,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to create pull request');
    }

    const data = await res.json();
    const state = this.mapReviewState({
      draft: Boolean(data.draft),
      state: typeof data.state === 'string' ? data.state : null,
      mergedAt: typeof data.merged_at === 'string' ? data.merged_at : null,
    });

    return {
      number: data.number as number,
      kind: 'pull_request',
      label: `PR #${data.number as number}`,
      title: data.title as string,
      state,
      stateLabel: this.getReviewStateLabel(state),
      authorName: ((data.user as { name?: string | null; login?: string | null } | undefined)
        ?.name ??
        (data.user as { login?: string | null } | undefined)?.login ??
        null) as string | null,
      webUrl: (data.html_url as string | null) ?? null,
    };
  }

  async pushFiles(accessToken: string, options: PushOptions): Promise<void> {
    const [owner, repo] = options.repoFullName.split('/');

    for (const [path, content] of Object.entries(options.files)) {
      let existingFileSha: string | undefined;

      const existingRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${options.branch}`,
        { headers: this.getHeaders(accessToken) }
      );

      if (existingRes.ok) {
        const existingData = await existingRes.json();
        existingFileSha = existingData.sha;
      }

      const body: Record<string, unknown> = {
        message: options.message,
        content: Buffer.from(content).toString('base64'),
        branch: options.branch,
      };

      if (existingFileSha) {
        body.sha = existingFileSha;
      }

      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
        method: 'PUT',
        headers: this.getHeaders(accessToken),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        console.error(`[GitHub pushFiles] Failed to push ${path}`);
        console.error(
          `[GitHub pushFiles] URL: https://api.github.com/repos/${owner}/${repo}/contents/${path}`
        );
        console.error(`[GitHub pushFiles] Branch: ${options.branch}`);
        console.error(`[GitHub pushFiles] Status: ${res.status}`);
        console.error(`[GitHub pushFiles] Error:`, JSON.stringify(error, null, 2));
        throw new Error(error.message || `Failed to push file: ${path}`);
      }
    }
  }

  async deleteFiles(accessToken: string, options: DeleteFilesOptions): Promise<void> {
    const [owner, repo] = options.repoFullName.split('/');

    for (const path of options.paths) {
      const existingRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${options.branch}`,
        { headers: this.getHeaders(accessToken) }
      );

      if (existingRes.status === 404) {
        continue;
      }

      if (!existingRes.ok) {
        const error = await existingRes.json().catch(() => null);
        throw new Error(
          (error as { message?: string } | null)?.message ?? `Failed to inspect file: ${path}`
        );
      }

      const existingData = (await existingRes.json()) as { sha?: string };
      if (!existingData.sha) {
        throw new Error(`Failed to resolve file sha for deletion: ${path}`);
      }

      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
        method: 'DELETE',
        headers: this.getHeaders(accessToken),
        body: JSON.stringify({
          message: options.message,
          sha: existingData.sha,
          branch: options.branch,
        }),
      });

      if (!res.ok && res.status !== 404) {
        const error = await res.json().catch(() => null);
        throw new Error(
          (error as { message?: string } | null)?.message ?? `Failed to delete file: ${path}`
        );
      }
    }
  }

  private getHeaders(accessToken: string): HeadersInit {
    return {
      Authorization: `token ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  async listRootFiles(
    accessToken: string,
    repoFullName: string,
    branch?: string
  ): Promise<string[]> {
    const [owner, repo] = repoFullName.split('/');
    const ref = branch ? `&ref=${branch}` : '';

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/?${ref}`, {
      headers: this.getHeaders(accessToken),
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();

    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .filter((item: { type: string }) => item.type === 'file')
      .map((item: { name: string; path: string }) => item.path);
  }

  async fileExists(
    accessToken: string,
    repoFullName: string,
    path: string,
    branch?: string
  ): Promise<boolean> {
    const [owner, repo] = repoFullName.split('/');
    const ref = branch ? `?ref=${branch}` : '';

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}${ref}`,
      { headers: this.getHeaders(accessToken) }
    );

    return res.ok;
  }

  async getFileContent(
    accessToken: string,
    repoFullName: string,
    path: string,
    branch?: string
  ): Promise<string | null> {
    const [owner, repo] = repoFullName.split('/');
    const ref = branch ? `?ref=${branch}` : '';

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}${ref}`,
      { headers: this.getHeaders(accessToken) }
    );

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (data.type !== 'file' || !data.content) {
      return null;
    }

    // GitHub returns base64 encoded content
    return Buffer.from(data.content, 'base64').toString('utf-8');
  }

  async listDirectory(
    accessToken: string,
    repoFullName: string,
    path: string,
    branch?: string
  ): Promise<Array<{ name: string; path: string; type: 'file' | 'dir' }>> {
    const [owner, repo] = repoFullName.split('/');
    const ref = branch ? `&ref=${branch}` : '';

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?${ref}`,
      { headers: this.getHeaders(accessToken) }
    );

    if (!res.ok) {
      return [];
    }

    const data = await res.json();

    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: { name: string; path: string; type: string }) => ({
      name: item.name,
      path: item.path,
      type: item.type === 'dir' ? 'dir' : 'file',
    }));
  }

  private mapRepository(data: Record<string, unknown>): GitRepository {
    return {
      id: String(data.id),
      name: data.name as string,
      fullName: data.full_name as string,
      owner: (data.owner as { login: string }).login,
      cloneUrl: data.clone_url as string,
      sshUrl: data.ssh_url as string,
      webUrl: data.html_url as string,
      defaultBranch: (data.default_branch as string) || 'main',
      isPrivate: data.private as boolean,
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
