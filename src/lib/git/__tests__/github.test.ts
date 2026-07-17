import { describe, expect, it } from 'bun:test';
import { GitHubProvider } from '@/lib/git/github';

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
    try {
      globalThis.fetch = (async (input) => {
        expect(String(input)).toBe(
          `https://api.github.com/repos/acme/demo/tarball/${'a'.repeat(40)}`
        );
        return new Response('archive');
      }) as typeof fetch;

      const archive = await createProvider().downloadRepositoryArchive(
        'token',
        'acme/demo',
        'a'.repeat(40)
      );
      expect(new TextDecoder().decode(archive)).toBe('archive');
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
        return init?.method === 'POST' ? new Response(null, { status: 204 }) : Response.json([]);
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
