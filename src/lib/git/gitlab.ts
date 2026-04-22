import type {
  BranchSchema,
  ExpandedMergeRequestSchema,
  ExpandedUserSchema,
  ProjectSchema,
  RepositoryFileExpandedSchema,
  RepositoryTreeSchema,
} from '@gitbeaker/rest';
import { Gitlab } from '@gitbeaker/rest';
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

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = error.message;

    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (message && typeof message === 'object') {
      return Object.entries(message as Record<string, string[]>)
        .flatMap(([key, value]) => value.map((entry) => `${key}: ${entry}`))
        .join(', ');
    }
  }

  return fallback;
}

function isStatusError(error: unknown, status: number): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  if ('status' in error && error.status === status) {
    return true;
  }

  if ('cause' in error) {
    return (
      ((error.cause as { response?: { status?: number } } | undefined)?.response?.status ??
        null) === status
    );
  }

  return false;
}

function normalizeArchiveRef(ref: string): string {
  if (ref.startsWith('refs/heads/')) {
    return ref.slice('refs/heads/'.length);
  }

  if (ref.startsWith('refs/tags/')) {
    return ref.slice('refs/tags/'.length);
  }

  return ref;
}

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

  private getClient(accessToken: string): InstanceType<typeof Gitlab> {
    return new Gitlab({
      host: this.serverUrl,
      token: accessToken,
    });
  }

  private buildApiUrl(path: string): string {
    return new URL(`/api/v4${path}`, this.serverUrl).toString();
  }

  private async requestJson<T>(
    accessToken: string,
    path: string,
    options?: {
      method?: string;
      body?: unknown;
    }
  ): Promise<T> {
    const response = await fetch(this.buildApiUrl(path), {
      method: options?.method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const raw = await response.text();
    const payload = raw.length > 0 ? this.parseJsonSafely(raw) : null;

    if (!response.ok) {
      throw Object.assign(new Error(this.extractGitLabErrorMessage(payload, raw)), {
        status: response.status,
      });
    }

    return payload as T;
  }

  private async requestBinary(accessToken: string, path: string): Promise<Uint8Array> {
    const response = await fetch(this.buildApiUrl(path), {
      headers: {
        Accept: 'application/octet-stream',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const raw = await response.text();
      const payload = raw.length > 0 ? this.parseJsonSafely(raw) : null;

      throw Object.assign(new Error(this.extractGitLabErrorMessage(payload, raw)), {
        status: response.status,
      });
    }

    return new Uint8Array(await response.arrayBuffer());
  }

  private parseJsonSafely(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  private extractGitLabErrorMessage(payload: unknown, raw: string): string {
    if (typeof payload === 'object' && payload !== null) {
      if ('message' in payload) {
        const message = payload.message;

        if (typeof message === 'string' && message.trim().length > 0) {
          return message;
        }

        if (Array.isArray(message)) {
          return message.join(', ');
        }

        if (message && typeof message === 'object') {
          return Object.entries(message as Record<string, string[]>)
            .flatMap(([key, value]) => value.map((entry) => `${key}: ${entry}`))
            .join(', ');
        }
      }

      if (
        'error' in payload &&
        typeof payload.error === 'string' &&
        payload.error.trim().length > 0
      ) {
        return payload.error;
      }
    }

    return raw.trim().length > 0 ? raw : 'GitLab API request failed';
  }

  private encodeProjectId(repoFullName: string): string {
    return encodeURIComponent(repoFullName);
  }

  private encodePath(path: string): string {
    return path
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
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
    const client = this.getClient(accessToken);
    const data = (await client.Users.showCurrentUser()) as ExpandedUserSchema;

    return {
      id: String(data.id),
      username: data.username,
      name: data.name,
      email: data.email || `${data.username}@${new URL(this.serverUrl).hostname}`,
      avatarUrl: data.avatar_url ?? null,
    };
  }

  async getRepositories(
    accessToken: string,
    options?: { page?: number; perPage?: number; search?: string }
  ): Promise<GitRepository[]> {
    const client = this.getClient(accessToken);
    const page = options?.page || 1;
    const perPage = options?.perPage || 100;
    const data = (await client.Projects.all({
      orderBy: 'updated_at',
      owned: true,
      search: options?.search,
      ...(options?.page ? ({ page } as Record<string, number>) : {}),
      ...(options?.perPage ? ({ perPage } as Record<string, number>) : {}),
    } as Record<string, unknown>)) as ProjectSchema[];

    return data.map((item) => this.mapRepository(item));
  }

  async getRepository(accessToken: string, fullName: string): Promise<GitRepository | null> {
    const client = this.getClient(accessToken);

    try {
      const data = (await client.Projects.show(fullName)) as ProjectSchema;
      return this.mapRepository(data);
    } catch (error) {
      if (isStatusError(error, 404)) {
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

    try {
      const data = (await client.MergeRequests.show(
        repoFullName,
        number
      )) as ExpandedMergeRequestSchema;
      const state = this.mapReviewState({
        draft: Boolean(data.draft),
        state: typeof data.state === 'string' ? data.state : null,
      });

      return {
        number,
        kind: 'merge_request',
        label: `MR !${number}`,
        title: data.title,
        state,
        stateLabel: this.getReviewStateLabel(state),
        authorName: data.author?.name ?? data.author?.username ?? null,
        webUrl: data.web_url ?? null,
      };
    } catch (error) {
      if (isStatusError(error, 404)) {
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
    if (ref.startsWith('refs/heads/')) {
      const branch = ref.slice('refs/heads/'.length);

      try {
        const data = await this.requestJson<BranchSchema>(
          accessToken,
          `/projects/${this.encodeProjectId(repoFullName)}/repository/branches/${encodeURIComponent(branch)}`
        );
        return data.commit?.id ?? null;
      } catch (error) {
        if (isStatusError(error, 404)) {
          return null;
        }

        throw error;
      }
    }

    const prMatch = ref.match(/^refs\/pull\/(\d+)\/(head|merge)$/);
    if (!prMatch) {
      return null;
    }

    const data = await this.requestJson<ExpandedMergeRequestSchema>(
      accessToken,
      `/projects/${this.encodeProjectId(repoFullName)}/merge_requests/${prMatch[1]}`
    );

    if (typeof data.sha === 'string') {
      return data.sha;
    }

    return data.diff_refs?.head_sha ?? null;
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
        const data = await this.requestJson<ExpandedMergeRequestSchema>(
          accessToken,
          `/projects/${this.encodeProjectId(options.repoFullName)}/merge_requests/${prMatch[1]}`
        );
        pipelineRef =
          typeof data.source_branch === 'string' && data.source_branch.trim().length > 0
            ? data.source_branch
            : null;
      }
    }

    if (!pipelineRef) {
      throw new Error('当前 GitLab 来源无法触发预览构建，请检查 MR 或改用分支启动');
    }

    try {
      await this.requestJson<{ id: number }>(
        accessToken,
        `/projects/${this.encodeProjectId(options.repoFullName)}/pipeline`,
        {
          method: 'POST',
          body: {
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
          },
        }
      );
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Failed to trigger GitLab preview build pipeline'));
    }
  }

  async createRepository(accessToken: string, options: CreateRepoOptions): Promise<GitRepository> {
    const client = this.getClient(accessToken);
    const data = (await client.Projects.create({
      name: options.name,
      description: options.description,
      visibility: options.isPrivate ? 'private' : 'public',
      initializeWithReadme: options.autoInit ?? true,
    })) as ProjectSchema;

    return this.mapRepository(data);
  }

  async createBranch(accessToken: string, options: CreateBranchOptions): Promise<void> {
    const client = this.getClient(accessToken);

    try {
      await client.Branches.create(options.repoFullName, options.branch, options.fromBranch);
    } catch (error) {
      if (!isStatusError(error, 400)) {
        throw new Error(getErrorMessage(error, `Failed to create branch ${options.branch}`));
      }
    }
  }

  async syncBranchRef(accessToken: string, options: SyncBranchRefOptions): Promise<void> {
    const currentSha = await this.resolveRefToCommitSha(
      accessToken,
      options.repoFullName,
      `refs/heads/${options.branch}`
    );

    if (currentSha === options.commitSha) {
      return;
    }

    if (currentSha) {
      try {
        await this.requestJson<void>(
          accessToken,
          `/projects/${this.encodeProjectId(options.repoFullName)}/repository/branches/${encodeURIComponent(options.branch)}`,
          {
            method: 'DELETE',
          }
        );
      } catch (error) {
        if (!isStatusError(error, 404)) {
          throw new Error(getErrorMessage(error, `Failed to reset branch ${options.branch}`));
        }
      }
    }

    await this.requestJson<{ name: string }>(
      accessToken,
      `/projects/${this.encodeProjectId(options.repoFullName)}/repository/branches`,
      {
        method: 'POST',
        body: {
          branch: options.branch,
          ref: options.commitSha,
        },
      }
    );
  }

  async createTag(accessToken: string, options: CreateTagOptions): Promise<void> {
    try {
      await this.requestJson<{ name: string }>(
        accessToken,
        `/projects/${this.encodeProjectId(options.repoFullName)}/repository/tags`,
        {
          method: 'POST',
          body: {
            tag_name: options.tag,
            ref: options.commitSha,
          },
        }
      );
    } catch (error) {
      const message = getErrorMessage(error, '');
      if (!message.includes('already exists')) {
        throw new Error(message || `Failed to create tag ${options.tag}`);
      }
    }
  }

  async createReviewRequest(
    accessToken: string,
    options: CreateReviewRequestOptions
  ): Promise<GitReviewRequest> {
    const client = this.getClient(accessToken);
    const reviewRequestTitle = (options.draft ?? true) ? `Draft: ${options.title}` : options.title;
    const data = (await client.MergeRequests.create(
      options.repoFullName,
      options.headBranch,
      options.baseBranch,
      reviewRequestTitle,
      {
        description: options.body ?? '',
      }
    )) as ExpandedMergeRequestSchema;
    const state = this.mapReviewState({
      draft: Boolean(data.draft),
      state: typeof data.state === 'string' ? data.state : null,
    });

    return {
      number: data.iid,
      kind: 'merge_request',
      label: `MR !${data.iid}`,
      title: data.title,
      state,
      stateLabel: this.getReviewStateLabel(state),
      authorName: data.author?.name ?? data.author?.username ?? null,
      webUrl: data.web_url ?? null,
    };
  }

  async pushFiles(accessToken: string, options: PushOptions): Promise<void> {
    const client = this.getClient(accessToken);

    for (const [path, content] of Object.entries(options.files)) {
      try {
        await client.RepositoryFiles.create(
          options.repoFullName,
          path,
          options.branch,
          content,
          options.message
        );
      } catch (error) {
        if (!isStatusError(error, 400)) {
          throw new Error(getErrorMessage(error, `Failed to push file: ${path}`));
        }

        await client.RepositoryFiles.edit(
          options.repoFullName,
          path,
          options.branch,
          content,
          options.message
        );
      }
    }
  }

  async deleteFiles(accessToken: string, options: DeleteFilesOptions): Promise<void> {
    for (const path of options.paths) {
      try {
        await this.requestJson<void>(
          accessToken,
          `/projects/${this.encodeProjectId(options.repoFullName)}/repository/files/${this.encodePath(path)}`,
          {
            method: 'DELETE',
            body: {
              branch: options.branch,
              commit_message: options.message,
            },
          }
        );
      } catch (error) {
        const message = getErrorMessage(error, '');

        if (
          isStatusError(error, 404) ||
          (isStatusError(error, 400) && /doesn['’]t exist|not exist/i.test(message))
        ) {
          continue;
        }

        throw new Error(message || `Failed to delete file: ${path}`);
      }
    }
  }

  async listRootFiles(
    accessToken: string,
    repoFullName: string,
    branch?: string
  ): Promise<string[]> {
    const client = this.getClient(accessToken);
    const data = (await client.Repositories.allRepositoryTrees(repoFullName, {
      ref: branch,
      perPage: 100,
    })) as RepositoryTreeSchema[];

    return data.filter((item) => item.type === 'blob').map((item) => item.path);
  }

  async fileExists(
    accessToken: string,
    repoFullName: string,
    path: string,
    branch?: string
  ): Promise<boolean> {
    const client = this.getClient(accessToken);

    try {
      await client.RepositoryFiles.show(repoFullName, path, branch ?? 'HEAD');
      return true;
    } catch (error) {
      if (isStatusError(error, 404)) {
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

    try {
      const data = (await client.RepositoryFiles.show(
        repoFullName,
        path,
        branch ?? 'HEAD'
      )) as RepositoryFileExpandedSchema;

      if (!data.content) {
        return null;
      }

      return Buffer.from(data.content, 'base64').toString('utf-8');
    } catch (error) {
      if (isStatusError(error, 404)) {
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
    const client = this.getClient(accessToken);
    const data = (await client.Repositories.allRepositoryTrees(repoFullName, {
      path,
      ref: branch,
      perPage: 100,
    })) as RepositoryTreeSchema[];

    return data.map((item) => ({
      name: item.name,
      path: item.path,
      type: item.type === 'tree' ? 'dir' : 'file',
    }));
  }

  async downloadRepositoryArchive(
    accessToken: string,
    repoFullName: string,
    ref: string
  ): Promise<Uint8Array> {
    const archiveRef = normalizeArchiveRef(ref);

    return this.requestBinary(
      accessToken,
      `/projects/${this.encodeProjectId(repoFullName)}/repository/archive.tar.gz?sha=${encodeURIComponent(archiveRef)}`
    );
  }

  private mapRepository(data: ProjectSchema): GitRepository {
    return {
      id: String(data.id),
      name: data.name,
      fullName: data.path_with_namespace,
      owner: data.namespace?.path || '',
      cloneUrl: data.http_url_to_repo,
      sshUrl: data.ssh_url_to_repo,
      webUrl: data.web_url,
      defaultBranch: data.default_branch || 'main',
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
