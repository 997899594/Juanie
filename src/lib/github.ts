import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { gitConnections, teams } from '@/lib/db/schema';

const GITHUB_API_BASE = 'https://api.github.com';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  ssh_url: string;
  description: string | null;
  private: boolean;
  default_branch: string;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
}

export interface GitHubRef {
  ref: string;
  object: {
    sha: string;
    type: string;
  };
}

export class GitHubAPI {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `GitHub API error: ${response.status}`);
    }

    return response.json();
  }

  async getAuthenticatedUser(): Promise<{ login: string; id: number }> {
    return this.request('/user');
  }

  async listRepos(options?: {
    page?: number;
    per_page?: number;
    sort?: 'updated' | 'created' | 'pushed';
  }): Promise<GitHubRepo[]> {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', options.page.toString());
    if (options?.per_page) params.set('per_page', options.per_page.toString());
    if (options?.sort) params.set('sort', options.sort);

    return this.request(`/user/repos?${params.toString()}`);
  }

  async createRepo(options: {
    name: string;
    description?: string;
    private?: boolean;
    auto_init?: boolean;
    team_id?: number;
  }): Promise<GitHubRepo> {
    return this.request('/user/repos', {
      method: 'POST',
      body: JSON.stringify({
        name: options.name,
        description: options.description || '',
        private: options.private ?? true,
        auto_init: options.auto_init ?? true,
        team_id: options.team_id,
      }),
    });
  }

  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    return this.request(`/repos/${owner}/${repo}`);
  }

  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch: string = 'main'
  ): Promise<{ commit: { sha: string } }> {
    const encodedContent = Buffer.from(content).toString('base64');

    let sha: string | undefined;
    try {
      const existing = await this.request<{ sha: string }>(
        `/repos/${owner}/${repo}/contents/${path}`,
        {
          headers: { Accept: 'application/vnd.github.v3.raw' },
        }
      );
      sha = existing.sha;
    } catch {
      // File doesn't exist, that's fine
    }

    return this.request(`/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({
        message,
        content: encodedContent,
        branch,
        ...(sha && { sha }),
      }),
    });
  }

  async createRef(owner: string, repo: string, ref: string, sha: string): Promise<GitHubRef> {
    return this.request(`/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({
        ref,
        sha,
      }),
    });
  }

  async getDefaultBranch(owner: string, repo: string): Promise<{ name: string }> {
    return this.request(`/repos/${owner}/${repo}`);
  }

  async listCommits(
    owner: string,
    repo: string,
    options?: { page?: number; per_page?: number; sha?: string }
  ): Promise<GitHubCommit[]> {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', options.page.toString());
    if (options?.per_page) params.set('per_page', options.per_page.toString());
    if (options?.sha) params.set('sha', options.sha);

    return this.request(`/repos/${owner}/${repo}/commits?${params.toString()}`);
  }

  async createWebhook(
    owner: string,
    repo: string,
    config: { url: string; content_type: string; secret?: string },
    events: string[] = ['push']
  ): Promise<{ id: number }> {
    return this.request(`/repos/${owner}/${repo}/hooks`, {
      method: 'POST',
      body: JSON.stringify({
        config,
        events,
        active: true,
      }),
    });
  }
}

export async function getTeamGitHubConnection(teamId: string) {
  const connection = await db.query.gitConnections.findFirst({
    where: eq(gitConnections.teamId, teamId),
  });

  if (!connection || connection.provider !== 'github') {
    return null;
  }

  return new GitHubAPI(connection.accessToken);
}

export async function createGitHubRepo(
  teamId: string,
  options: {
    name: string;
    description?: string;
    private?: boolean;
  }
): Promise<GitHubRepo | null> {
  const connection = await getTeamGitHubConnection(teamId);
  if (!connection) {
    return null;
  }

  return connection.createRepo(options);
}

export async function pushTemplateToRepo(
  teamId: string,
  owner: string,
  repo: string,
  files: Record<string, string>,
  branch: string = 'main'
): Promise<boolean> {
  const connection = await getTeamGitHubConnection(teamId);
  if (!connection) {
    return false;
  }

  for (const [path, content] of Object.entries(files)) {
    await connection.createOrUpdateFile(owner, repo, path, content, `Add ${path}`, branch);
  }

  return true;
}
