import { describe, expect, it } from 'bun:test';
import {
  buildEnvironmentTrackingBranchName,
  buildReleaseEnvironmentTagName,
} from '@/lib/releases/environment-tracking';

describe('release environment tracking', () => {
  it('builds stable tracking branch names from environment names', () => {
    expect(buildEnvironmentTrackingBranchName('Production')).toBe('juanie-env-production');
    expect(buildEnvironmentTrackingBranchName('QA / Blue Green')).toBe('juanie-env-qa-blue-green');
    expect(buildEnvironmentTrackingBranchName('   ')).toBe('juanie-env-environment');
  });

  it('builds deterministic environment tag names from release metadata', () => {
    expect(
      buildReleaseEnvironmentTagName({
        environmentName: 'Production',
        createdAt: '2026-04-16T12:34:56.000Z',
        sourceCommitSha: 'abcdef1234567890',
      })
    ).toBe('juanie-production-2026.04.16-abcdef1');
  });
});
