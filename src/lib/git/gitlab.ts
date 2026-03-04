import type {
  CreateRepoOptions,
  GitProvider,
  GitProviderConfig,
  GitRepository,
  GitUser,
  PushOptions,
  RegistryWebhookOptions,
  WebhookOptions,
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

  async createWebhook(accessToken: string, options: WebhookOptions): Promise<{ id: string }> {
    const encodedPath = encodeURIComponent(options.repoFullName);

    const res = await fetch(`${this.serverUrl}/api/v4/projects/${encodedPath}/hooks`, {
      method: 'POST',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify({
        url: options.webhookUrl,
        token: options.secret,
        push_events: options.events.includes('push'),
        issues_events: options.events.includes('issues'),
        merge_requests_events: options.events.includes('merge_requests'),
        tag_push_events: options.events.includes('tag_push'),
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to create webhook');
    }

    const data = await res.json();
    return { id: String(data.id) };
  }

  async deleteWebhook(accessToken: string, repoFullName: string, webhookId: string): Promise<void> {
    const encodedPath = encodeURIComponent(repoFullName);
    await fetch(`${this.serverUrl}/api/v4/projects/${encodedPath}/hooks/${webhookId}`, {
      method: 'DELETE',
      headers: this.getHeaders(accessToken),
    });
  }

  async setupRegistryWebhook(
    accessToken: string,
    options: RegistryWebhookOptions
  ): Promise<{ id: string }> {
    const webhookUrl = `https://juanie.art/api/webhooks/registry?project_id=${options.juanieProjectId}`;
    const encodedPath = encodeURIComponent(options.ownerOrProjectPath);

    const res = await fetch(`${this.serverUrl}/api/v4/projects/${encodedPath}/hooks`, {
      method: 'POST',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify({
        url: webhookUrl,
        token: options.webhookSecret,
        push_events: false,
        tag_push_events: false,
        pipeline_events: false,
        job_events: false,
        deployment_events: false,
        releases_events: false,
        container_registry_events: true, // Image push events
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to create GitLab registry webhook');
    }

    const data = await res.json();
    return { id: String(data.id) };
  }

  private getHeaders(accessToken: string): HeadersInit {
    return {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
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
}
