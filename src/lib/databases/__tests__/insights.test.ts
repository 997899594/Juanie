import { describe, expect, it } from 'bun:test';
import { getDatabaseInsights } from '@/lib/databases/insights';

describe('getDatabaseInsights', () => {
  it('skips non-postgres databases', async () => {
    const result = await getDatabaseInsights(
      {
        id: 'db-1',
        name: 'cache',
        type: 'redis',
        connectionString: 'redis://example',
      },
      {
        getOverview: async () => ({
          tableCount: 1,
          estimatedRows: 1,
        }),
      }
    );

    expect(result.status).toBe('unsupported');
    expect(result.available).toBe(false);
  });

  it('returns structural metrics for postgres databases', async () => {
    const result = await getDatabaseInsights(
      {
        id: 'db-1',
        name: 'primary',
        type: 'postgresql',
        connectionString: 'postgres://example',
      },
      {
        getOverview: async () => ({
          tableCount: 12,
          estimatedRows: 4200,
        }),
      }
    );

    expect(result.status).toBe('ready');
    expect(result.available).toBe(true);
    expect(result.tableCount).toBe(12);
    expect(result.estimatedRows).toBe(4200);
  });
});
