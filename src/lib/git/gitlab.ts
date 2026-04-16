import type {
  CreateBranchOptions,
  CreateRepoOptions,
  CreateReviewRequestOptions,
  CreateTagOptions,
  GitProvider,
  GitProviderConfig,
  GitRepository,
  GitReviewRequest,
  GitUser,
  PushOptions,
  SyncBranchRefOptions,
  TriggerReleaseBuildOptions,
} from './index';

export class GitLabProvider implements GitProvider {
  type = 'gitlab' as const;
  private serverUrl: string;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(config: GitProviderConfig) {
    this.serverUrl = config.serverUrl || 'https://gitlab.com';
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'api read_repository write_repository',
      state,
    });
    return `${this.serverUrl}/oauth/authorize?${params}`;
  }

  async getAccessToken(code: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }> {
    const res = await fetch(`${this.serverUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
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
    const res = await fetch(`${this.serverUrl}/api/v4/user`, {
      headers: this.getHeaders(accessToken),
    });

    if (!res.ok) {
      throw new Error('Failed to get user');
    }

    const data = await res.json();

    return {
      id: String(data.id),
      username: data.username,
      name: data.name,
      email: data.email || `${data.username}@${new URL(this.serverUrl).hostname}`,
      avatarUrl: data.avatar_url,
    };
  }

  async getRepositories(
    accessToken: string,
    options?: { page?: number; perPage?: number; search?: string }
  ): Promise<GitRepository[]> {
    const page = options?.page || 1;
    const perPage = options?.perPage || 100;

    let url = `${this.serverUrl}/api/v4/projects?page=${page}&per_page=${perPage}&order_by=updated_at&owned=true`;

    if (options?.search) {
      url += `&search=${encodeURIComponent(options.search)}`;
    }

    const res = await fetch(url, { headers: this.getHeaders(accessToken) });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return data.map(this.mapRepository);
  }

  async getRepository(accessToken: string, fullName: string): Promise<GitRepository | null> {
    const encodedPath = encodeURIComponent(fullName);
    const res = await fetch(`${this.serverUrl}/api/v4/projects/${encodedPath}`, {
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
    const data = await this.fetchMergeRequest(accessToken, repoFullName, number);

    if (!data) {
      return null;
    }
    const state = this.mapReviewState({
      draft: Boolean(data.draft),
      state: typeof data.state === 'string' ? data.state : null,
    });

    return {
      number,
      kind: 'merge_request',
      label: `MR !${number}`,
      title: data.title as string,
      state,
      stateLabel: this.getReviewStateLabel(state),
      authorName: ((data.author as { name?: string | null; username?: string | null } | undefined)
        ?.name ??
        (data.author as { username?: string | null } | undefined)?.username ??
        null) as string | null,
      webUrl: (data.web_url as string | null) ?? null,
    };
  }

  async resolveRefToCommitSha(
    accessToken: string,
    repoFullName: string,
    ref: string
  ): Promise<string | null> {
    const encodedPath = encodeURIComponent(repoFullName);

    if (ref.startsWith('refs/heads/')) {
      const branch = ref.slice('refs/heads/'.length);
      const res = await fetch(
        `${this.serverUrl}/api/v4/projects/${encodedPath}/repository/branches/${encodeURIComponent(branch)}`,
        {
          headers: this.getHeaders(accessToken),
        }
      );

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      const sha = (data.commit as { id?: string } | undefined)?.id;
      return typeof sha === 'string' ? sha : null;
    }

    const prMatch = ref.match(/^refs\/pull\/(\d+)\/(head|merge)$/);
    if (prMatch) {
      const [, mergeRequestNumber] = prMatch;
      const data = await this.fetchMergeRequest(
        accessToken,
        repoFullName,
        Number(mergeRequestNumber)
      );

      if (!data) {
        return null;
      }
      if (typeof data.sha === 'string') {
        return data.sha;
      }

      const headSha = (data.diff_refs as { head_sha?: string } | undefined)?.head_sha;
      return typeof headSha === 'string' ? headSha : null;
    }

    return null;
  }

  async triggerReleaseBuild(
    accessToken: string,
    options: TriggerReleaseBuildOptions
  ): Promise<void> {
    let pipelineRef: string | null = null;

    if (options.ref.startsWith('refs/heads/')) {
      pipelineRef = options.ref.slice('refs/heads/'.length);
    } else {
      const prMatch = options.ref.match(/^refs\/pull\/(\d+)\/(head|merge)$/);
      if (prMatch) {
        const [, mergeRequestNumber] = prMatch;
        const data = await this.fetchMergeRequest(
          accessToken,
          options.repoFullName,
          Number(mergeRequestNumber)
        );
        const sourceBranch =
          typeof data?.source_branch === 'string' && data.source_branch.trim().length > 0
            ? data.source_branch
            : null;
        pipelineRef = sourceBranch;
      }
    }

    if (!pipelineRef) {
      throw new Error('当前 GitLab 来源无法触发预览构建，请检查 MR 或改用分支启动');
    }

    const encodedPath = encodeURIComponent(options.repoFullName);
    const res = await fetch(`${this.serverUrl}/api/v4/projects/${encodedPath}/pipeline`, {
      method: 'POST',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify({
        ref: pipelineRef,
        variables: [
          {
            key: 'JUANIE_SOURCE_SHA',
            value: options.sourceCommitSha,
          },
          {
            key: 'JUANIE_RELEASE_REF',
            value: options.releaseRef ?? options.ref,
          },
          {
            key: 'JUANIE_FORCE_FULL_BUILD',
            value: options.forceFullBuild ? '1' : '0',
          },
        ],
      }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => null);
      throw new Error(
        error && typeof error.message === 'string'
          ? error.message
          : 'Failed to trigger GitLab preview build pipeline'
      );
    }
  }

  async createRepository(accessToken: string, options: CreateRepoOptions): Promise<GitRepository> {
    const res = await fetch(`${this.serverUrl}/api/v4/projects`, {
      method: 'POST',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify({
        name: options.name,
        description: options.description,
        visibility: options.isPrivate ? 'private' : 'public',
        initialize_with_readme: options.autoInit ?? true,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to create repository');
    }

    return this.mapRepository(await res.json());
  }

  async createBranch(accessToken: string, options: CreateBranchOptions): Promise<void> {
    const encodedPath = encodeURIComponent(options.repoFullName);
    const res = await fetch(
      `${this.serverUrl}/api/v4/projects/${encodedPath}/repository/branches`,
      {
        method: 'POST',
        headers: this.getHeaders(accessToken),
        body: JSON.stringify({
          branch: options.branch,
          ref: options.fromBranch,
        }),
      }
    );

    if (!res.ok && res.status !== 400) {
      const error = await res.json();
      throw new Error(error.message || `Failed to create branch ${options.branch}`);
    }
  }

  async syncBranchRef(accessToken: string, options: SyncBranchRefOptions): Promise<void> {
    const encodedPath = encodeURIComponent(options.repoFullName);
    const encodedBranch = encodeURIComponent(options.branch);
    const currentSha = await this.resolveRefToCommitSha(
      accessToken,
      options.repoFullName,
      `refs/heads/${options.branch}`
    );

    if (currentSha === options.commitSha) {
      return;
    }

    if (currentSha) {
      const deleteRes = await fetch(
        `${this.serverUrl}/api/v4/projects/${encodedPath}/repository/branches/${encodedBranch}`,
        {
          method: 'DELETE',
          headers: this.getHeaders(accessToken),
        }
      );

      if (!deleteRes.ok && deleteRes.status !== 404) {
        const error = await deleteRes.json().catch(() => null);
        throw new Error(
          (error as { message?: string } | null)?.message ??
            `Failed to reset branch ${options.branch}`
        );
      }
    }

    const createRes = await fetch(
      `${this.serverUrl}/api/v4/projects/${encodedPath}/repository/branches`,
      {
        method: 'POST',
        headers: this.getHeaders(accessToken),
        body: JSON.stringify({
          branch: options.branch,
          ref: options.commitSha,
        }),
      }
    );

    if (!createRes.ok) {
      const error = await createRes.json().catch(() => null);
      throw new Error(
        (error as { message?: string } | null)?.message ?? `Failed to sync branch ${options.branch}`
      );
    }
  }

  async createTag(accessToken: string, options: CreateTagOptions): Promise<void> {
    const encodedPath = encodeURIComponent(options.repoFullName);
    const res = await fetch(`${this.serverUrl}/api/v4/projects/${encodedPath}/repository/tags`, {
      method: 'POST',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify({
        tag_name: options.tag,
        ref: options.commitSha,
      }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => null);
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: string }).message)
          : null;

      if (res.status === 400 && message?.includes('already exists')) {
        return;
      }

      throw new Error(message ?? `Failed to create tag ${options.tag}`);
    }
  }

  async createReviewRequest(
    accessToken: string,
    options: CreateReviewRequestOptions
  ): Promise<GitReviewRequest> {
    const encodedPath = encodeURIComponent(options.repoFullName);
    const res = await fetch(`${this.serverUrl}/api/v4/projects/${encodedPath}/merge_requests`, {
      method: 'POST',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify({
        title: options.title,
        description: options.body ?? '',
        source_branch: options.headBranch,
        target_branch: options.baseBranch,
        draft: options.draft ?? true,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to create merge request');
    }

    const data = await res.json();
    const state = this.mapReviewState({
      draft: Boolean(data.draft),
      state: typeof data.state === 'string' ? data.state : null,
    });

    return {
      number: data.iid as number,
      kind: 'merge_request',
      label: `MR !${data.iid as number}`,
      title: data.title as string,
      state,
      stateLabel: this.getReviewStateLabel(state),
      authorName: ((
        data.author as
          | {
              name?: string | null;
              username?: string | null;
            }
          | undefined
      )?.name ??
        (data.author as { username?: string | null } | undefined)?.username ??
        null) as string | null,
      webUrl: (data.web_url as string | null) ?? null,
    };
  }

  async pushFiles(accessToken: string, options: PushOptions): Promise<void> {
    const encodedPath = encodeURIComponent(options.repoFullName);
    const branch = options.branch;

    for (const [path, content] of Object.entries(options.files)) {
      const res = await fetch(
        `${this.serverUrl}/api/v4/projects/${encodedPath}/repository/files/${encodeURIComponent(path)}`,
        {
          method: 'POST',
          headers: this.getHeaders(accessToken),
          body: JSON.stringify({
            branch,
            commit_message: options.message,
            content,
          }),
        }
      );

      if (!res.ok && res.status !== 400) {
        const error = await res.json();
        throw new Error(error.message || `Failed to push file: ${path}`);
      }

      if (res.status === 400) {
        await fetch(
          `${this.serverUrl}/api/v4/projects/${encodedPath}/repository/files/${encodeURIComponent(path)}`,
          {
            method: 'PUT',
            headers: this.getHeaders(accessToken),
            body: JSON.stringify({
              branch,
              commit_message: options.message,
              content,
            }),
          }
        );
      }
    }
  }

  private getHeaders(accessToken: string): HeadersInit {
    return {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  private async fetchMergeRequest(
    accessToken: string,
    repoFullName: string,
    mergeRequestNumber: number
  ): Promise<Record<string, unknown> | null> {
    const encodedPath = encodeURIComponent(repoFullName);
    const res = await fetch(
      `${this.serverUrl}/api/v4/projects/${encodedPath}/merge_requests/${mergeRequestNumber}`,
      {
        headers: this.getHeaders(accessToken),
      }
    );

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as Record<string, unknown>;
  }

  async listRootFiles(
    accessToken: string,
    repoFullName: string,
    branch?: string
  ): Promise<string[]> {
    const encodedPath = encodeURIComponent(repoFullName);
    const ref = branch ? `&ref=${branch}` : '';

    // Get root directory tree (path=empty means root, per_page=100 to get more files)
    const res = await fetch(
      `${this.serverUrl}/api/v4/projects/${encodedPath}/repository/tree?per_page=100${ref}`,
      { headers: this.getHeaders(accessToken) }
    );

    if (!res.ok) {
      return [];
    }

    const data = await res.json();

    if (!Array.isArray(data)) {
      return [];
    }

    // Get file names from root level only (type === 'blob')
    return data
      .filter((item: { type: string }) => item.type === 'blob')
      .map((item: { name: string; path: string }) => item.path);
  }

  async fileExists(
    accessToken: string,
    repoFullName: string,
    path: string,
    branch?: string
  ): Promise<boolean> {
    const encodedPath = encodeURIComponent(repoFullName);
    const ref = branch ? `?ref=${branch}` : '';

    const res = await fetch(
      `${this.serverUrl}/api/v4/projects/${encodedPath}/repository/files/${encodeURIComponent(path)}${ref}`,
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
    const encodedPath = encodeURIComponent(repoFullName);
    const ref = branch ? `?ref=${branch}` : '';

    const res = await fetch(
      `${this.serverUrl}/api/v4/projects/${encodedPath}/repository/files/${encodeURIComponent(path)}${ref}`,
      { headers: this.getHeaders(accessToken) }
    );

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (!data.content) {
      return null;
    }

    // GitLab returns base64 encoded content
    return Buffer.from(data.content, 'base64').toString('utf-8');
  }

  async listDirectory(
    accessToken: string,
    repoFullName: string,
    path: string,
    branch?: string
  ): Promise<Array<{ name: string; path: string; type: 'file' | 'dir' }>> {
    const encodedPath = encodeURIComponent(repoFullName);
    const ref = branch ? `&ref=${branch}` : '';

    const res = await fetch(
      `${this.serverUrl}/api/v4/projects/${encodedPath}/repository/tree?path=${encodeURIComponent(path)}&per_page=100${ref}`,
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
      type: item.type === 'tree' ? 'dir' : 'file',
    }));
  }

  private mapRepository(data: Record<string, unknown>): GitRepository {
    const httpUrl = data.http_url_to_repo as string;
    const sshUrl = data.ssh_url_to_repo as string;

    return {
      id: String(data.id),
      name: data.name as string,
      fullName: data.path_with_namespace as string,
      owner: (data.namespace as { path: string })?.path || '',
      cloneUrl: httpUrl,
      sshUrl: sshUrl,
      webUrl: data.web_url as string,
      defaultBranch: (data.default_branch as string) || 'main',
      isPrivate: data.visibility === 'private' || data.visibility === 'internal',
    };
  }

  private mapReviewState(input: {
    draft: boolean;
    state: string | null;
  }): GitReviewRequest['state'] {
    if (input.draft) {
      return 'draft';
    }
    if (input.state === 'opened') {
      return 'open';
    }
    if (input.state === 'merged') {
      return 'merged';
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
