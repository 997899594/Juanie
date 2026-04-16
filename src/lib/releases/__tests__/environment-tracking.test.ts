import { describe, expect, it } from 'bun:test';
import { buildEnvironmentTrackingBranchName } from '@/lib/releases/environment-tracking';

describe('release environment tracking', () => {
  it('builds stable tracking branch names from environment names', () => {
    expect(buildEnvironmentTrackingBranchName('Production')).toBe('juanie-env-production');
    expect(buildEnvironmentTrackingBranchName('QA / Blue Green')).toBe('juanie-env-qa-blue-green');
    expect(buildEnvironmentTrackingBranchName('   ')).toBe('juanie-env-environment');
  });
});
