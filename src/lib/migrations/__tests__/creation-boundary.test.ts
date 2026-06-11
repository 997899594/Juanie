import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('migration run creation boundary', () => {
  it('does not run live schema inspection or capability reconciliation before creating runs', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/migrations/index.ts'), 'utf8');

    expect(source).not.toContain('inspectResolvedMigrationSpecPendingState');
    expect(source).not.toContain('ensureDatabaseCapabilities');
    expect(source).not.toContain('inferDatabaseCapabilitiesFromText');
  });
});
