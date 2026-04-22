import { describe, expect, it } from 'bun:test';
import { canMarkSchemaAligned } from '@/lib/schema-management/adopt';

describe('schema adoption support matrix', () => {
  it('supports mark aligned for relational atlas targets', () => {
    expect(canMarkSchemaAligned({ tool: 'atlas', databaseType: 'postgresql' })).toBe(true);
    expect(canMarkSchemaAligned({ tool: 'atlas', databaseType: 'mysql' })).toBe(true);
  });

  it('only supports drizzle adoption on postgresql', () => {
    expect(canMarkSchemaAligned({ tool: 'drizzle', databaseType: 'postgresql' })).toBe(true);
    expect(canMarkSchemaAligned({ tool: 'drizzle', databaseType: 'mysql' })).toBe(false);
  });

  it('keeps sql adoption available for platform-tracked ledgers', () => {
    expect(canMarkSchemaAligned({ tool: 'sql', databaseType: 'postgresql' })).toBe(true);
    expect(canMarkSchemaAligned({ tool: 'sql', databaseType: 'mysql' })).toBe(true);
    expect(canMarkSchemaAligned({ tool: 'sql', databaseType: 'mongodb' })).toBe(false);
  });
});
