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

      expect(requests.length).toBe(1);
      expect(requests[0]?.url).toBe(
        'https://api.github.com/repos/997899594/nexusnote/actions/workflows/juanie-ci.yml/dispatches'
      );
      expect(requests[0]?.init?.method).toBe('POST');
      expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
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
      expect((thrown as Error).message).toContain('直接按远端分支最新提交启动预览环境');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
