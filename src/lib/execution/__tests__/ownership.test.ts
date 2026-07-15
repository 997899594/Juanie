import { describe, expect, it } from 'bun:test';
import { buildMigrationExecutionKey, buildReleaseExecutionKey } from '@/lib/execution/ownership';

describe('execution ownership keys', () => {
  it('coordinates releases per environment', () => {
    expect(buildReleaseExecutionKey('env-1')).toBe('environment:env-1');
  });

  it('coordinates migrations per environment and database', () => {
    expect(buildMigrationExecutionKey('env-1', 'db-1')).toBe('environment:env-1:database:db-1');
    expect(buildMigrationExecutionKey('env-2', 'db-1')).not.toBe(
      buildMigrationExecutionKey('env-1', 'db-1')
    );
  });
});
