import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('release planning boundary', () => {
  it('does not run live migration inspection while building release plans', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/releases/planning.ts'), 'utf8');

    expect(source).not.toContain('inspectResolvedMigrationSpecPendingState');
  });
});
