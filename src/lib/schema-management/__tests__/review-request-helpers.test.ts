import { describe, expect, it } from 'bun:test';
import { buildSchemaRepairRuntimeArtifacts } from '@/lib/schema-management/review-request-helpers';

describe('schema review request helpers', () => {
  it('builds runtime-only atlas artifacts outside the repo review surface', () => {
    const artifacts = buildSchemaRepairRuntimeArtifacts({
      provider: 'github',
      tool: 'drizzle',
      databaseType: 'postgresql',
      migrationPath: 'drizzle',
      planId: 'plan-12345678',
      title: 'Schema repair',
      summary: 'Need repair',
      planKind: 'repair_pr_required',
      stateStatus: 'drifted',
      databaseName: 'postgresql',
      expectedVersion: '0001_soft_hedge_knight',
      actualVersion: '0000_known_mole_man',
      sourceConfigPath: 'apps/api/drizzle.config.ts',
    });

    expect(artifacts.atlasConfigPath).toBe('.juanie/schema-repair/plan-12345678.atlas.hcl');
    expect(artifacts.atlasScriptPath).toBe('.juanie/schema-repair/plan-12345678.atlas.sh');
    expect(Object.keys(artifacts.files)).toEqual([
      '.juanie/schema-repair/plan-12345678.atlas.hcl',
      '.juanie/schema-repair/plan-12345678.atlas.sh',
    ]);
    expect(artifacts.files['.juanie/schema-repair/plan-12345678.atlas.hcl']).toContain(
      'plan-12345678.schema.sql'
    );
    expect(artifacts.files['.juanie/schema-repair/plan-12345678.atlas.hcl']).toContain(
      '.juanie/schema-repair/generated'
    );
    expect(artifacts.files['.juanie/schema-repair/plan-12345678.atlas.sh']).toContain(
      'migrate diff'
    );
    expect(artifacts.files['.juanie/schema-repair/plan-12345678.atlas.sh']).toContain(
      'apps/api/drizzle.config.ts'
    );
  });
});
