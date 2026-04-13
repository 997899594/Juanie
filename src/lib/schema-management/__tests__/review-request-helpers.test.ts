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
    });

    expect(Object.keys(artifacts.files)).toContain(
      'drizzle/0001_juanie_schema_repair_plan-123.sql'
    );
    expect(Object.keys(artifacts.files)).toContain('drizzle/meta/_journal.json');
    expect(artifacts.files['drizzle/meta/_journal.json']).toContain(
      '0001_juanie_schema_repair_plan-123'
    );
  });
});
