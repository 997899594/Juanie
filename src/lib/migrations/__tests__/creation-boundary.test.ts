import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveReleaseMigrationCreationDecision } from '@/lib/migrations';

describe('migration run creation boundary', () => {
  it('does not run live schema inspection or capability reconciliation before creating runs', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/migrations/index.ts'), 'utf8');

    expect(source).not.toContain('inspectResolvedMigrationSpecPendingState');
    expect(source).not.toContain('ensureDatabaseCapabilities');
    expect(source).not.toContain('inferDatabaseCapabilitiesFromText');
  });

  it('creates release migration runs only from current pending schema state', () => {
    const requested = {
      sourceRef: 'refs/heads/main',
      sourceCommitSha: 'new-sha',
    };

    expect(
      resolveReleaseMigrationCreationDecision(
        {
          status: 'pending_migrations',
          sourceRef: 'refs/heads/main',
          sourceCommitSha: 'new-sha',
        },
        requested
      )
    ).toEqual({ kind: 'create' });

    expect(
      resolveReleaseMigrationCreationDecision(
        {
          status: 'aligned',
          sourceRef: 'refs/heads/main',
          sourceCommitSha: 'new-sha',
        },
        requested
      )
    ).toEqual({ kind: 'skip' });

    expect(
      resolveReleaseMigrationCreationDecision(
        {
          status: 'pending_migrations',
          sourceRef: 'refs/heads/main',
          sourceCommitSha: 'old-sha',
        },
        requested
      )
    ).toEqual({ kind: 'missing_current_schema_state' });
  });
});
