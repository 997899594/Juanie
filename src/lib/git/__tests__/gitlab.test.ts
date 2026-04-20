import { describe, expect, it } from 'bun:test';
import { GitLabProvider } from '@/lib/git/gitlab';

describe('GitLabProvider preview build trigger', () => {
  const originalFetch = globalThis.fetch;

  it('triggers merge request preview builds on the MR source branch', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    try {
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof URL ? input.toString() : String(input);
        calls.push({ url, init });

        if (url.endsWith('/merge_requests/42')) {
          return new Response(
            JSON.stringify({
              source_branch: 'feature/preview-checkout',
            }),
            { status: 200 }
          );
        }

        if (url.endsWith('/pipeline')) {
          return new Response(JSON.stringify({ id: 7 }), { status: 201 });
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

      await provider.triggerReleaseBuild('token', {
        repoFullName: 'acme/juanie-demo',
        ref: 'refs/pull/42/merge',
        releaseRef: 'refs/pull/42/merge',
        sourceCommitSha: 'abc123456789',
        forceFullBuild: true,
      });

      expect(calls[0]?.url).toContain('/merge_requests/42');
      expect(calls[1]?.url).toContain('/pipeline');

      const payload = JSON.parse(String(calls[1]?.init?.body ?? '{}')) as {
        ref: string;
        variables: Array<{ key: string; value: string }>;
      };

      expect(payload.ref).toBe('feature/preview-checkout');
      expect(payload.variables).toEqual([
        { key: 'JUANIE_SOURCE_SHA', value: 'abc123456789' },
        { key: 'JUANIE_RELEASE_REF', value: 'refs/pull/42/merge' },
        { key: 'JUANIE_FORCE_FULL_BUILD', value: '1' },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('deletes tracked files while skipping missing paths', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    try {
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof URL ? input.toString() : String(input);
        calls.push({ url, init });

        if (
          url.endsWith('/repository/files/juanie.yaml') &&
          init?.method &&
          init.method.toUpperCase() === 'DELETE'
        ) {
          return new Response(null, { status: 204 });
        }

        if (
          url.endsWith('/repository/files/.gitlab-ci.yml') &&
          init?.method &&
          init.method.toUpperCase() === 'DELETE'
        ) {
          return new Response('not found', { status: 404 });
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

      await provider.deleteFiles('token', {
        repoFullName: 'acme/juanie-demo',
        branch: 'main',
        paths: ['juanie.yaml', '.gitlab-ci.yml'],
        message: 'Remove Juanie managed files [skip ci]',
      });

      expect(calls.length).toBe(2);
      expect(calls[0]?.init?.method).toBe('DELETE');
      expect(JSON.parse(String(calls[0]?.init?.body ?? '{}'))).toEqual({
        branch: 'main',
        commit_message: 'Remove Juanie managed files [skip ci]',
      });
      expect(calls[1]?.url).toContain('/repository/files/.gitlab-ci.yml');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
