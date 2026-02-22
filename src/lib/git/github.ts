import type {
  CreateRepoOptions,
  GitProvider,
  GitProviderConfig,
  GitRepository,
  GitUser,
  PushOptions,
  WebhookOptions,
} from './index';

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
      scope: 'repo user:email',
      state,
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
        throw new Error(error.message || `Failed to push file: ${path}`);
      }
    }
  }

  async createWebhook(accessToken: string, options: WebhookOptions): Promise<{ id: string }> {
    const [owner, repo] = options.repoFullName.split('/');

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
      method: 'POST',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: options.events,
        config: {
          url: options.webhookUrl,
          content_type: 'json',
          secret: options.secret,
        },
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
    const [owner, repo] = repoFullName.split('/');

    await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks/${webhookId}`, {
      method: 'DELETE',
      headers: this.getHeaders(accessToken),
    });
  }

  private getHeaders(accessToken: string): HeadersInit {
    return {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
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
}
