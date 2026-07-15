import { describe, expect, it } from 'bun:test';
import type { CiWorkloadIdentity } from '@/lib/ci/workload-identity';
import { clearMasterKeyCache } from '@/lib/crypto';
import {
  isJuanieCiToken,
  issueJuanieCiToken,
  verifyJuanieCiToken,
} from '@/lib/releases/ci-identity';

const identity: CiWorkloadIdentity = {
  provider: 'github',
  issuer: 'https://token.actions.githubusercontent.com',
  subject: 'repo:acme/api:ref:refs/heads/main',
  repository: 'acme/api',
  ref: 'refs/heads/main',
  sha: '1111111111111111111111111111111111111111',
  runId: '42',
  runAttempt: '3',
  externalRunId: '42-3',
  workflowRef: 'acme/api/.github/workflows/juanie-ci.yml@refs/heads/main',
  workflowSha: '1111111111111111111111111111111111111111',
  eventName: 'push',
};

describe('Juanie CI workload token', () => {
  const originalMasterKey = process.env.ENCRYPTION_MASTER_KEY;

  it('binds the exchanged token to source and workflow run', async () => {
    process.env.ENCRYPTION_MASTER_KEY = '1'.repeat(64);
    clearMasterKeyCache();
    const scope = {
      projectId: '11111111-1111-4111-8111-111111111111',
      repositoryId: '22222222-2222-4222-8222-222222222222',
      provider: identity.provider,
      repository: identity.repository,
      ref: identity.ref,
      sha: identity.sha!,
      externalRunId: identity.externalRunId,
    };
    try {
      const result = await issueJuanieCiToken(identity, scope);

      expect(result.expiresIn).toBe(300);
      expect(isJuanieCiToken(result.token)).toBe(true);
      expect(await verifyJuanieCiToken(result.token, scope)).toEqual({
        projectId: scope.projectId,
        repositoryId: scope.repositoryId,
        provider: scope.provider,
      });
      let mismatch: unknown;
      try {
        await verifyJuanieCiToken(result.token, { ...scope, externalRunId: '42-4' });
      } catch (error) {
        mismatch = error;
      }
      expect(mismatch instanceof Error).toBe(true);
      expect((mismatch as Error).message).toContain('scope mismatch');

      let providerMismatch: unknown;
      try {
        await issueJuanieCiToken(identity, { ...scope, provider: 'gitlab' });
      } catch (error) {
        providerMismatch = error;
      }
      expect(providerMismatch instanceof Error).toBe(true);
      expect((providerMismatch as Error).message).toContain('provider');
    } finally {
      if (originalMasterKey === undefined) delete process.env.ENCRYPTION_MASTER_KEY;
      else process.env.ENCRYPTION_MASTER_KEY = originalMasterKey;
      clearMasterKeyCache();
    }
  });
});
