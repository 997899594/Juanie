import { describe, expect, it } from 'bun:test';
import { GitHubProvider } from '@/lib/git/github';
import { GitLabProvider } from '@/lib/git/gitlab';

describe('git provider branch ref sync', () => {
  const originalFetch = globalThis.fetch;

  it('updates an existing GitHub branch ref in place', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    try {
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof URL ? input.toString() : String(input);
        calls.push({ url, init });

        if (url.endsWith('/branches/juanie-env-production')) {
          return new Response(
            JSON.stringify({
              commit: {
                sha: 'oldsha123',
              },
            }),
            { status: 200 }
          );
        }

        if (url.endsWith('/git/refs/heads/juanie-env-production')) {
          return new Response(JSON.stringify({ ref: 'refs/heads/juanie-env-production' }), {
            status: 200,
          });
        }

        return new Response('not found', { status: 404 });
      }) as typeof fetch;

      const provider = new GitHubProvider({
        type: 'github',
        clientId: '',
        clientSecret: '',
        redirectUri: '',
      });

      await provider.syncBranchRef('token', {
        repoFullName: 'acme/juanie-demo',
        branch: 'juanie-env-production',
        commitSha: 'newsha456',
      });

      expect(calls[0]?.url).toContain('/branches/juanie-env-production');
      expect(calls[1]?.url).toContain('/git/refs/heads/juanie-env-production');
      expect(calls[1]?.init?.method).toBe('PATCH');
      expect(JSON.parse(String(calls[1]?.init?.body ?? '{}'))).toEqual({
        sha: 'newsha456',
        force: true,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('recreates a GitLab tracking branch when the SHA changes', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    try {
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof URL ? input.toString() : String(input);
        calls.push({ url, init });

        if (url.endsWith('/branches/juanie-env-staging') && !init?.method) {
          return new Response(
            JSON.stringify({
              commit: {
                id: 'oldsha123',
              },
            }),
            { status: 200 }
          );
        }

        if (
          url.endsWith('/branches/juanie-env-staging') &&
          init?.method &&
          init.method.toUpperCase() === 'DELETE'
        ) {
          return new Response(null, { status: 204 });
        }

        if (url.endsWith('/repository/branches') && init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              name: 'juanie-env-staging',
            }),
            { status: 201 }
          );
        }

        return new Response('not found', { status: 404 });
      }) as typeof fetch;

      const provider = new GitLabProvider({
        type: 'gitlab',
        clientId: '',
        clientSecret: '',
        redirectUri: '',
        serverUrl: 'https://gitlab.example.com',
      });

      await provider.syncBranchRef('token', {
        repoFullName: 'acme/juanie-demo',
        branch: 'juanie-env-staging',
        commitSha: 'newsha456',
      });

      expect(calls[0]?.url).toContain('/branches/juanie-env-staging');
      expect(calls[1]?.init?.method).toBe('DELETE');
      expect(calls[2]?.url).toContain('/repository/branches');
      expect(JSON.parse(String(calls[2]?.init?.body ?? '{}'))).toEqual({
        branch: 'juanie-env-staging',
        ref: 'newsha456',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
