import { describe, expect, it } from 'bun:test';
import { drizzleTagToFilename, parseDrizzleJournalEntries } from '@/lib/migrations/drizzle';
import {
  isPlatformManagedMigrationSpec,
  isPlatformManagedMigrationTool,
} from '@/lib/migrations/platform-managed';

describe('platform managed migrations', () => {
  it('treats drizzle on postgresql as platform managed', () => {
    expect(isPlatformManagedMigrationTool('drizzle', 'postgresql')).toBe(true);
    expect(isPlatformManagedMigrationTool('drizzle', 'mysql')).toBe(false);
    expect(isPlatformManagedMigrationTool('sql', 'mysql')).toBe(true);
  });

  it('requires non-external execution mode for platform management', () => {
    expect(
      isPlatformManagedMigrationSpec({
        specification: {
          tool: 'drizzle',
          executionMode: 'automatic',
        } as never,
        database: {
          type: 'postgresql',
        } as never,
      })
    ).toBe(true);

    expect(
      isPlatformManagedMigrationSpec({
        specification: {
          tool: 'drizzle',
          executionMode: 'external',
        } as never,
        database: {
          type: 'postgresql',
        } as never,
      })
    ).toBe(false);
  });
});

describe('drizzle helpers', () => {
  it('parses drizzle journal entries in order', () => {
    expect(
      parseDrizzleJournalEntries(
        JSON.stringify({
          entries: [
            { idx: 1, tag: '0001_add_users', when: 20 },
            { idx: 0, tag: '0000_init', when: 10 },
          ],
        })
      ).map((entry) => entry.tag)
    ).toEqual(['0000_init', '0001_add_users']);
  });

  it('maps drizzle tags to sql filenames', () => {
    expect(drizzleTagToFilename('0000_init')).toBe('0000_init.sql');
    expect(drizzleTagToFilename('0000_init.sql')).toBe('0000_init.sql');
  });
});
