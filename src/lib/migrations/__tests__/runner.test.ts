import { describe, expect, it } from 'bun:test';
import { getMigrationCompletionStatus } from '@/lib/migrations/runner';

describe('migration runner completion status', () => {
  it('marks no-op migration runs as skipped', () => {
    expect(getMigrationCompletionStatus(0)).toBe('skipped');
  });

  it('marks migration runs with applied changes as success', () => {
    expect(getMigrationCompletionStatus(1)).toBe('success');
  });
});
