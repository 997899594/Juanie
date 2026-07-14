import { describe, expect, it } from 'bun:test';
import {
  issueBuildSecretCapability,
  verifyBuildSecretCapability,
} from '@/lib/builds/secret-capability';

function withCapabilitySecret(run: () => void): void {
  const originalSecret = process.env.BUILD_SECRET_CAPABILITY_SECRET;
  process.env.BUILD_SECRET_CAPABILITY_SECRET = 'test-capability-secret-with-enough-entropy';
  try {
    run();
  } finally {
    if (originalSecret === undefined) delete process.env.BUILD_SECRET_CAPABILITY_SECRET;
    else process.env.BUILD_SECRET_CAPABILITY_SECRET = originalSecret;
  }
}

describe('build secret capability', () => {
  it('binds a short-lived token to one build run', () => {
    withCapabilitySecret(() => {
      const now = Date.parse('2026-07-14T00:00:00Z');
      const token = issueBuildSecretCapability('run-1', now);

      expect(verifyBuildSecretCapability({ token, buildRunId: 'run-1', now })).toBe(true);
      expect(verifyBuildSecretCapability({ token, buildRunId: 'run-2', now })).toBe(false);
      expect(
        verifyBuildSecretCapability({
          token,
          buildRunId: 'run-1',
          now: now + 7 * 60 * 60 * 1000,
        })
      ).toBe(false);
    });
  });

  it('rejects tampered signatures', () => {
    withCapabilitySecret(() => {
      const token = issueBuildSecretCapability('run-1');
      expect(verifyBuildSecretCapability({ token: `${token}x`, buildRunId: 'run-1' })).toBe(false);
    });
  });
});
