import { describe, expect, it } from 'bun:test';
import {
  isPlatformManagedMigrationSpec,
  isPlatformManagedMigrationTool,
} from '@/lib/migrations/platform-managed';

describe('platform managed migrations', () => {
  it('treats drizzle on postgresql as platform managed', () => {
    expect(isPlatformManagedMigrationTool('drizzle', 'postgresql')).toBe(true);
    expect(isPlatformManagedMigrationTool('drizzle', 'mysql')).toBe(false);
    expect(isPlatformManagedMigrationTool('sql', 'mysql')).toBe(true);
    expect(isPlatformManagedMigrationTool('sql', 'mongodb')).toBe(false);
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
