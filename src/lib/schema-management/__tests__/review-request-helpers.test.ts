import { describe, expect, it } from 'bun:test';
import {
  appendDrizzleJournalEntry,
  buildNextMigrationTag,
  buildSchemaRepairArtifacts,
} from '@/lib/schema-management/review-request-helpers';

describe('schema review request helpers', () => {
  it('builds the next migration tag from numeric prefixes', () => {
    expect(
      buildNextMigrationTag(['0000_known_mole_man', '0001_soft_hedge_knight'], 'juanie_fix')
    ).toBe('0002_juanie_fix');
  });

  it('appends a drizzle journal entry', () => {
    const next = appendDrizzleJournalEntry(
      JSON.stringify({
        version: '7',
        dialect: 'postgresql',
        entries: [{ idx: 0, version: '7', when: 1, tag: '0000_known_mole_man', breakpoints: true }],
      }),
      '0001_juanie_fix',
      2
    );

    expect(next).toContain('"tag": "0001_juanie_fix"');
    expect(next).toContain('"idx": 1');
  });

  it('builds drizzle scaffold artifacts with journal update', () => {
    const artifacts = buildSchemaRepairArtifacts({
      provider: 'github',
      tool: 'drizzle',
      databaseType: 'postgresql',
      migrationPath: 'drizzle',
      existingMigrationNames: ['0000_known_mole_man.sql'],
      journalContent: JSON.stringify({
        version: '7',
        dialect: 'postgresql',
        entries: [{ idx: 0, version: '7', when: 1, tag: '0000_known_mole_man', breakpoints: true }],
      }),
      planId: 'plan-12345678',
      title: 'Schema repair',
      summary: 'Need repair',
      planKind: 'repair_pr_required',
      stateStatus: 'drifted',
      databaseName: 'postgresql',
      expectedVersion: '0001_soft_hedge_knight',
      actualVersion: '0000_known_mole_man',
    });

    expect(Object.keys(artifacts.files)).toContain('.juanie/schema-repair/plan-12345678.json');
    expect(Object.keys(artifacts.files)).toContain('.juanie/schema-repair/plan-12345678.atlas.hcl');
    expect(Object.keys(artifacts.files)).toContain('.juanie/schema-repair/plan-12345678.atlas.sh');
    expect(Object.keys(artifacts.files)).toContain('.github/workflows/schema-repair-plan-123.yml');
    expect(Object.keys(artifacts.files)).toContain(
      'drizzle/0001_juanie_schema_repair_plan-123.sql'
    );
    expect(Object.keys(artifacts.files)).toContain('drizzle/meta/_journal.json');
    expect(artifacts.files['drizzle/meta/_journal.json']).toContain(
      '0001_juanie_schema_repair_plan-123'
    );
    expect(artifacts.files['.juanie/schema-repair/plan-12345678.atlas.hcl']).toContain(
      'plan-12345678.schema.sql'
    );
  });

  it('builds baseline scaffold with baseline stem', () => {
    const artifacts = buildSchemaRepairArtifacts({
      provider: 'gitlab',
      tool: 'sql',
      databaseType: 'postgresql',
      migrationPath: 'migrations/postgresql',
      existingMigrationNames: ['0000_init.sql'],
      planId: 'plan-abcdefgh',
      title: 'Adopt current db',
      summary: 'Need baseline',
      planKind: 'adopt_current_db',
      stateStatus: 'unmanaged',
      databaseName: 'postgresql',
      expectedVersion: null,
      actualVersion: null,
    });

    expect(Object.keys(artifacts.files)).toContain('.juanie/schema-repair/plan-abcdefgh.json');
    expect(Object.keys(artifacts.files)).toContain('.juanie/schema-repair/plan-abcdefgh.atlas.hcl');
    expect(Object.keys(artifacts.files)).toContain('.juanie/schema-repair/plan-abcdefgh.atlas.sh');
    expect(Object.keys(artifacts.files)).toContain(
      '.juanie/schema-repair/plan-abcdefgh.gitlab-ci.yml'
    );
    expect(Object.keys(artifacts.files)).toContain(
      'migrations/postgresql/0001_juanie_schema_baseline_plan-abc.sql'
    );
    expect(artifacts.files['.juanie/schema-repair/plan-abcdefgh.atlas.sh']).toContain(
      'migrate diff'
    );
  });
});
