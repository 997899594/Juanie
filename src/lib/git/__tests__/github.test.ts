import { describe, expect, it } from 'bun:test';
import { GitHubProvider } from '@/lib/git/github';

describe('GitHubProvider preview build trigger', () => {
  const originalFetch = globalThis.fetch;

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
