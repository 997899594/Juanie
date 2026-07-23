import { describe, expect, it } from 'bun:test';
import { GitHubProvider } from '@/lib/git/github';
import { RepositoryArchiveError } from '@/lib/git/repository-archive';

function createProvider(): GitHubProvider {
  return new GitHubProvider({
    type: 'github',
    clientId: '',
    clientSecret: '',
    redirectUri: '',
  });
}

describe('GitHubProvider source control plane', () => {
  const originalFetch = globalThis.fetch;

  it('resolves branch refs with slashes to the latest commit sha', async () => {
    try {
      globalThis.fetch = (async (input) => {
        expect(String(input)).toContain('/branches/codex%2Fevidence-event-knowledge-os');
        return Response.json({ commit: { sha: 'a'.repeat(40) } });
      }) as typeof fetch;

      expect(
        await createProvider().resolveRefToCommitSha(
          'token',
          '997899594/nexusnote',
          'refs/heads/codex/evidence-event-knowledge-os'
        )
      ).toBe('a'.repeat(40));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('downloads an immutable repository archive through the provider API', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    try {
      globalThis.fetch = (async (input, init) => {
        const url = String(input);
        requests.push({ url, init });
        if (url.startsWith('https://api.github.com/')) {
          return new Response(null, {
            status: 302,
            headers: {
              location: `https://codeload.github.com/acme/demo/legacy.tar.gz/${'a'.repeat(40)}`,
            },
          });
        }
        return new Response('archive', {
          headers: { 'content-type': 'application/x-gzip' },
        });
      }) as typeof fetch;

      const archive = await createProvider().downloadRepositoryArchive(
        'token',
        'acme/demo',
        'a'.repeat(40)
      );
      expect(new TextDecoder().decode(archive)).toBe('archive');
      expect(requests[0]?.url).toBe(
        `https://api.github.com/repos/acme/demo/tarball/${'a'.repeat(40)}`
      );
      const apiHeaders = new Headers(requests[0]?.init?.headers);
      expect(apiHeaders.get('accept')).toBe('application/vnd.github+json');
      expect(apiHeaders.get('authorization')).toBe('Bearer token');
      expect(requests[1]?.url.startsWith('https://codeload.github.com/')).toBe(true);
      const codeloadHeaders = new Headers(requests[1]?.init?.headers);
      expect(codeloadHeaders.get('accept')).toBe('application/octet-stream');
      expect(codeloadHeaders.has('authorization')).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('preserves an upstream archive rejection as a typed provider error', async () => {
    try {
      globalThis.fetch = (async () =>
        Response.json(
          { message: 'Resource not accessible by integration' },
          { status: 403 }
        )) as typeof fetch;

      let caught: unknown;
      try {
        await createProvider().openRepositoryArchive('token', 'acme/demo', 'a'.repeat(40));
      } catch (error) {
        caught = error;
      }

      expect(caught instanceof RepositoryArchiveError).toBe(true);
      if (!(caught instanceof RepositoryArchiveError)) throw caught;
      expect(caught.code).toBe('upstream_rejected');
      expect(caught.provider).toBe('github');
      expect(caught.upstreamStatus).toBe(403);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('treats GitHub compare results at the provider cap as incomplete', async () => {
    try {
      globalThis.fetch = (async () =>
        Response.json({
          files: Array.from({ length: 300 }, (_, index) => ({ filename: `src/${index}.ts` })),
        })) as typeof fetch;

      const comparison = await createProvider().compareCommits(
        'token',
        'acme/demo',
        'a'.repeat(40),
        'b'.repeat(40)
      );
      expect(comparison.changedFiles.length).toBe(300);
      expect(comparison.complete).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('creates a signed push-only webhook when none exists', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    try {
      globalThis.fetch = (async (input, init) => {
        requests.push({ url: String(input), init });
        return init?.method === 'POST'
          ? Response.json({ id: 41 }, { status: 201 })
          : Response.json([]);
      }) as typeof fetch;

      await createProvider().ensurePushWebhook('token', {
        repoFullName: 'acme/demo',
        url: 'https://juanie.art/api/webhooks/source',
        secret: 'secret',
      });
      expect(requests[1]?.init?.method).toBe('POST');
      expect(JSON.parse(String(requests[1]?.init?.body))).toEqual({
        name: 'web',
        active: true,
        events: ['push'],
        config: {
          url: 'https://juanie.art/api/webhooks/source',
          content_type: 'json',
          insecure_ssl: '0',
          secret: 'secret',
        },
      });
      expect(requests.length).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('updates the persisted webhook id and deletes only recognized Juanie duplicates', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    try {
      globalThis.fetch = (async (input, init) => {
        requests.push({ url: String(input), init });
        if (init?.method === 'PATCH') return Response.json({ id: 42 });
        if (init?.method === 'DELETE') return new Response(null, { status: 204 });
        return Response.json([
          { id: 42, config: { url: 'https://undefined/api/webhooks/git' } },
          { id: 43, config: { url: 'https://undefined/api/webhooks/git' } },
          { id: 99, config: { url: 'https://example.com/webhook' } },
        ]);
      }) as typeof fetch;

      const webhook = await createProvider().ensurePushWebhook('token', {
        repoFullName: 'acme/demo',
        url: 'https://juanie.art/api/webhooks/source',
        secret: 'secret',
        managedWebhookId: '42',
        legacyUrls: ['https://undefined/api/webhooks/git'],
      });

      expect(webhook).toEqual({
        id: '42',
        url: 'https://juanie.art/api/webhooks/source',
        removedWebhookIds: ['43'],
      });
      expect(requests.filter((request) => request.init?.method === 'DELETE').length).toBe(1);
      expect(requests.some((request) => request.url.includes('/hooks/99'))).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('updates an existing webhook without sending create-only fields', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    try {
      globalThis.fetch = (async (input, init) => {
        requests.push({ url: String(input), init });
        if (init?.method === 'PATCH') return Response.json({ id: 42 });
        return Response.json([
          {
            id: 42,
            config: { url: 'https://juanie.art/api/webhooks/source' },
          },
        ]);
      }) as typeof fetch;

      await createProvider().ensurePushWebhook('token', {
        repoFullName: 'acme/demo',
        url: 'https://juanie.art/api/webhooks/source',
        secret: 'rotated-secret',
      });

      expect(requests[1]?.url).toContain('/repos/acme/demo/hooks/42');
      expect(requests[1]?.init?.method).toBe('PATCH');
      expect(JSON.parse(String(requests[1]?.init?.body))).toEqual({
        active: true,
        events: ['push'],
        config: {
          url: 'https://juanie.art/api/webhooks/source',
          content_type: 'json',
          insecure_ssl: '0',
          secret: 'rotated-secret',
        },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
