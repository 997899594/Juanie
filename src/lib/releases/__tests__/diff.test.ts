import { describe, expect, it } from 'bun:test';
import { buildReleaseDiff } from '@/lib/releases/diff';

describe('release diff', () => {
  it('treats the first release as all additions', () => {
    const diff = buildReleaseDiff(
      {
        artifacts: [
          {
            serviceId: 'svc-1',
            imageUrl: 'ghcr.io/demo/web:sha-1',
            imageDigest: null,
            service: { name: 'web' },
          },
        ],
        migrationRuns: [
          {
            databaseId: 'db-1',
            serviceId: 'svc-1',
            specification: {
              tool: 'drizzle',
              phase: 'preDeploy',
              command: 'bun run db:push',
            },
            database: { name: 'primary' },
            service: { name: 'web' },
          },
        ],
      },
      null
    );

    expect(diff.isFirstRelease).toBe(true);
    expect(diff.changedArtifacts.length).toBe(1);
    expect(diff.changedArtifacts[0]?.change).toBe('added');
    expect(diff.changedMigrations.length).toBe(1);
    expect(diff.changedMigrations[0]?.change).toBe('added');
  });

  it('detects added, updated, and removed artifacts', () => {
    const diff = buildReleaseDiff(
      {
        artifacts: [
          {
            serviceId: 'svc-1',
            imageUrl: 'ghcr.io/demo/web:sha-2',
            imageDigest: null,
            service: { name: 'web' },
          },
          {
            serviceId: 'svc-2',
            imageUrl: 'ghcr.io/demo/worker:sha-2',
            imageDigest: null,
            service: { name: 'worker' },
          },
        ],
        migrationRuns: [],
      },
      {
        artifacts: [
          {
            serviceId: 'svc-1',
            imageUrl: 'ghcr.io/demo/web:sha-1',
            imageDigest: null,
            service: { name: 'web' },
          },
          {
            serviceId: 'svc-3',
            imageUrl: 'ghcr.io/demo/cron:sha-1',
            imageDigest: null,
            service: { name: 'cron' },
          },
        ],
        migrationRuns: [],
      }
    );

    expect(diff.isFirstRelease).toBe(false);
    expect(diff.changedArtifacts.map((item) => `${item.serviceName}:${item.change}`)).toEqual([
      'web:updated',
      'worker:added',
      'cron:removed',
    ]);
  });

  it('detects migration plan changes by tool, phase, and command', () => {
    const diff = buildReleaseDiff(
      {
        artifacts: [],
        migrationRuns: [
          {
            databaseId: 'db-1',
            serviceId: 'svc-1',
            specification: {
              tool: 'drizzle',
              phase: 'preDeploy',
              command: 'bun run db:push',
            },
            database: { name: 'primary' },
            service: { name: 'web' },
          },
        ],
      },
      {
        artifacts: [],
        migrationRuns: [
          {
            databaseId: 'db-1',
            serviceId: 'svc-1',
            specification: {
              tool: 'drizzle',
              phase: 'preDeploy',
              command: 'bun run db:migrate',
            },
            database: { name: 'primary' },
            service: { name: 'web' },
          },
        ],
      }
    );

    expect(diff.changedMigrations.length).toBe(2);
    expect(diff.changedMigrations.map((item) => item.change).sort()).toEqual(['added', 'removed']);
  });
});
