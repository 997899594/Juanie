import { describe, expect, it } from 'bun:test';
import { GitHubProvider } from '@/lib/git/github';

describe('GitHubProvider preview build trigger', () => {
  const originalFetch = globalThis.fetch;

  it('resolves branch refs with slashes to the latest commit sha', async () => {
    try {
      globalThis.fetch = (async (input) => {
        expect(String(input)).toContain('/branches/codex%2Fevidence-event-knowledge-os');

        return new Response(
          JSON.stringify({
            commit: {
              sha: 'eff1991cae3b54c221a080f665122de9e43e8161',
            },
          }),
          { status: 200 }
        );
      }) as typeof fetch;

      const provider = new GitHubProvider({
        type: 'github',
        clientId: '',
        clientSecret: '',
        redirectUri: '',
      });

      const sha = await provider.resolveRefToCommitSha(
        'token',
        '997899594/nexusnote',
        'refs/heads/codex/evidence-event-knowledge-os'
      );

      expect(sha).toBe('eff1991cae3b54c221a080f665122de9e43e8161');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('dispatches preview builds on the requested branch when workflow_dispatch is available', async () => {
    try {
      const requests: Array<{ url: string; init?: RequestInit }> = [];

      globalThis.fetch = (async (input, init) => {
        requests.push({
          url: String(input),
          init,
        });

        return new Response(null, { status: 204 });
      }) as typeof fetch;

      const provider = new GitHubProvider({
        type: 'github',
        clientId: '',
        clientSecret: '',
        redirectUri: '',
      });

      await provider.triggerReleaseBuild('token', {
        repoFullName: '997899594/nexusnote',
        ref: 'refs/heads/codex/evidence-event-knowledge-os',
        releaseRef: 'refs/heads/codex/evidence-event-knowledge-os',
        sourceCommitSha: 'eff1991cae3b54c221a080f665122de9e43e8161',
        forceFullBuild: true,
      });

      const dispatchRequest = requests.find((request) => request.init?.method === 'POST');
      expect(dispatchRequest?.url).toBe(
        'https://api.github.com/repos/997899594/nexusnote/actions/workflows/juanie-ci.yml/dispatches'
      );
      expect(JSON.parse(String(dispatchRequest?.init?.body))).toEqual({
        ref: 'codex/evidence-event-knowledge-os',
        inputs: {
          juanie_source_sha: 'eff1991cae3b54c221a080f665122de9e43e8161',
          juanie_release_ref: 'refs/heads/codex/evidence-event-knowledge-os',
          juanie_force_full_build: 'true',
        },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('downloads repository archives through the provider API instead of shell git', async () => {
    try {
      const requests: Array<string> = [];

      globalThis.fetch = (async (input) => {
        requests.push(String(input));

        if (String(input).includes('/branches/feature%2Fpreview-checkout')) {
          return new Response(
            JSON.stringify({
              commit: {
                sha: 'eff1991cae3b54c221a080f665122de9e43e8161',
              },
            }),
            { status: 200 }
          );
        }

        return new Response('archive', { status: 200 });
      }) as typeof fetch;

      const provider = new GitHubProvider({
        type: 'github',
        clientId: '',
        clientSecret: '',
        redirectUri: '',
      });

      const archive = await provider.downloadRepositoryArchive(
        'token',
        'acme/juanie-demo',
        'refs/heads/feature/preview-checkout'
      );

      expect(archive instanceof Uint8Array).toBe(true);
      expect(requests).toEqual([
        'https://api.github.com/repos/acme/juanie-demo/tarball/feature%2Fpreview-checkout',
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns an actionable error when the repo-side workflow contract is stale', async () => {
    try {
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            message: 'Unexpected inputs provided: [juanie_force_full_build]',
          }),
          { status: 422 }
        )) as typeof fetch;

      const provider = new GitHubProvider({
        type: 'github',
        clientId: '',
        clientSecret: '',
        redirectUri: '',
      });

      let thrown: unknown;

      try {
        await provider.triggerReleaseBuild('token', {
          repoFullName: '997899594/nexusnote',
          ref: 'refs/heads/codex/evidence-event-knowledge-os',
          releaseRef: 'refs/heads/codex/evidence-event-knowledge-os',
          sourceCommitSha: 'eff1991cae3b54c221a080f665122de9e43e8161',
          forceFullBuild: true,
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown instanceof Error).toBe(true);
      expect((thrown as Error).message).toContain('契约不一致');
      expect((thrown as Error).message).toContain('juanie_force_full_build');
      expect((thrown as Error).message).toContain('重新通过 Juanie 导入或同步配置');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns an actionable message when workflow_dispatch is missing', async () => {
    try {
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            message: "Workflow does not have 'workflow_dispatch' trigger",
          }),
          { status: 422 }
        )) as typeof fetch;

      const provider = new GitHubProvider({
        type: 'github',
        clientId: '',
        clientSecret: '',
        redirectUri: '',
      });

      let thrown: unknown;

      try {
        await provider.triggerReleaseBuild('token', {
          repoFullName: 'acme/juanie-demo',
          ref: 'refs/heads/codex/evidence-event-knowledge-os',
          releaseRef: 'refs/heads/codex/evidence-event-knowledge-os',
          sourceCommitSha: 'c9908b266c051178bb515d6966c50bc1146ab598',
          forceFullBuild: true,
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown instanceof Error).toBe(true);
      expect((thrown as Error).message).toContain('workflow_dispatch');
      expect((thrown as Error).message).toContain('重新同步平台注入配置');
      expect((thrown as Error).message).toContain('按远端分支最新提交启动预览环境');
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

        if (url.endsWith('/contents/juanie.yaml?ref=main')) {
          return new Response(
            JSON.stringify({
              sha: 'existing-sha-1',
            }),
            { status: 200 }
          );
        }

        if (url.endsWith('/contents/.env.juanie.example?ref=main')) {
          return new Response('not found', { status: 404 });
        }

        if (url.endsWith('/contents/juanie.yaml') && init?.method === 'DELETE') {
          return new Response(null, { status: 200 });
        }

        return new Response('not found', { status: 404 });
      }) as typeof fetch;

      const provider = new GitHubProvider({
        type: 'github',
        clientId: '',
        clientSecret: '',
        redirectUri: '',
      });

      await provider.deleteFiles('token', {
        repoFullName: 'acme/juanie-demo',
        branch: 'main',
        paths: ['juanie.yaml', '.env.juanie.example'],
        message: 'Remove Juanie managed files [skip ci]',
      });

      expect(calls.map((call) => call.url)).toEqual([
        'https://api.github.com/repos/acme/juanie-demo/contents/juanie.yaml?ref=main',
        'https://api.github.com/repos/acme/juanie-demo/contents/juanie.yaml',
        'https://api.github.com/repos/acme/juanie-demo/contents/.env.juanie.example?ref=main',
      ]);
      expect(calls[1]?.init?.method).toBe('DELETE');
      expect(JSON.parse(String(calls[1]?.init?.body ?? '{}'))).toEqual({
        message: 'Remove Juanie managed files [skip ci]',
        sha: 'existing-sha-1',
        branch: 'main',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
