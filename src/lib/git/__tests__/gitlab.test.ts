import { describe, expect, it } from 'bun:test';
import { GitLabProvider } from '@/lib/git/gitlab';

function createProvider(): GitLabProvider {
  return new GitLabProvider({
    type: 'gitlab',
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    serverUrl: 'https://gitlab.example.com',
  });
}

describe('GitLabProvider source control plane', () => {
  const originalFetch = globalThis.fetch;

  it('downloads an immutable repository archive through the provider API', async () => {
    try {
      globalThis.fetch = (async (input) => {
        expect(String(input)).toContain(`/repository/archive.tar.gz?sha=${'a'.repeat(40)}`);
        return new Response('archive', {
          headers: { 'content-type': 'application/octet-stream' },
        });
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

  it('returns complete changed paths from GitLab compare', async () => {
    try {
      globalThis.fetch = (async (input) => {
        const url = String(input);
        expect(url).toContain(`from=${'a'.repeat(40)}`);
        expect(url).toContain(`to=${'b'.repeat(40)}`);
        return Response.json({ diffs: [{ new_path: 'src/new.ts' }], overflow: false });
      }) as typeof fetch;
      expect(
        await createProvider().compareCommits('token', 'acme/demo', 'a'.repeat(40), 'b'.repeat(40))
      ).toEqual({ changedFiles: ['src/new.ts'], complete: true });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('creates a verified push webhook when none exists', async () => {
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
        url: 'https://juanie.art/api/webhooks/source',
        push_events: true,
        enable_ssl_verification: true,
        token: 'secret',
      });
      expect(requests.length).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
