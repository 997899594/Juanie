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
  subject: 'repo:997899594/Juanie:ref:refs/heads/main',
  repository: '997899594/Juanie',
  ref: 'refs/heads/main',
  sha: '1111111111111111111111111111111111111111',
  runId: '42',
  runAttempt: '3',
  externalRunId: '42-3',
  workflowRef: '997899594/Juanie/.github/workflows/application-delivery.yml@refs/heads/main',
  workflowSha: '1111111111111111111111111111111111111111',
  eventName: 'workflow_dispatch',
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
      repository: 'acme/api',
      ref: 'refs/heads/main',
      sha: 'a'.repeat(40),
      beforeSha: 'b'.repeat(40),
      externalRunId: 'github:delivery-42',
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
      mismatch = undefined;
      try {
        await verifyJuanieCiToken(result.token, { ...scope, beforeSha: 'c'.repeat(40) });
      } catch (error) {
        mismatch = error;
      }
      expect(mismatch instanceof Error).toBe(true);
      expect((mismatch as Error).message).toContain('scope mismatch');
    } finally {
      if (originalMasterKey === undefined) delete process.env.ENCRYPTION_MASTER_KEY;
      else process.env.ENCRYPTION_MASTER_KEY = originalMasterKey;
      clearMasterKeyCache();
    }
  });

  it('allows the trusted platform executor to bind a GitLab source scope', async () => {
    process.env.ENCRYPTION_MASTER_KEY = '1'.repeat(64);
    clearMasterKeyCache();
    const scope = {
      projectId: '11111111-1111-4111-8111-111111111111',
      repositoryId: '22222222-2222-4222-8222-222222222222',
      provider: 'gitlab' as const,
      repository: 'acme/api',
      ref: 'refs/heads/main',
      sha: 'a'.repeat(40),
      beforeSha: null,
      externalRunId: 'gitlab:delivery-42',
    };
    try {
      const result = await issueJuanieCiToken(identity, scope);
      expect(await verifyJuanieCiToken(result.token, scope)).toEqual({
        projectId: scope.projectId,
        repositoryId: scope.repositoryId,
        provider: 'gitlab',
      });
    } finally {
      if (originalMasterKey === undefined) delete process.env.ENCRYPTION_MASTER_KEY;
      else process.env.ENCRYPTION_MASTER_KEY = originalMasterKey;
      clearMasterKeyCache();
    }
  });
});
