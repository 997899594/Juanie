import { describe, expect, it, mock } from 'bun:test';

const findManyMock = mock(async () => [
  {
    id: 'run-success',
    lockKey: 'db-1:env-1',
    status: 'success',
    errorMessage: null,
    createdAt: new Date('2026-05-02T00:00:00.000Z'),
    service: { name: 'web' },
    database: { name: 'primary' },
  },
  {
    id: 'run-failed',
    lockKey: 'db-1:env-1',
    status: 'failed',
    errorMessage: 'type "public.vector" does not exist',
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    service: { name: 'web' },
    database: { name: 'primary' },
  },
  {
    id: 'run-awaiting',
    lockKey: 'db-2:env-1',
    status: 'awaiting_approval',
    errorMessage: 'production approval required',
    createdAt: new Date('2026-05-03T00:00:00.000Z'),
    service: { name: 'worker' },
    database: { name: 'analytics' },
  },
]);

mock.module('@/lib/db', () => ({
  db: {
    query: {
      migrationRuns: {
        findMany: findManyMock,
      },
    },
  },
}));

mock.module('@/lib/ai/context/environment-context', () => ({
  loadAIEnvironmentContext: mock(async () => ({
    teamId: 'team-1',
    projectName: 'nexusnote',
    environment: {
      id: 'env-1',
      name: 'production',
      latestReleaseCard: { title: 'main release' },
      latestMigrationRun: { status: 'success' },
      databases: [
        { schemaState: { status: 'stable' } },
        { schemaState: { status: 'pending_migrations' } },
      ],
    },
  })),
}));

describe('environment migration review evidence', () => {
  it('does not report historical failed runs after the same lockKey succeeds', async () => {
    const { buildEnvironmentMigrationReviewEvidence } = await import(
      '@/lib/ai/evidence/environment-migration-review'
    );

    const evidence = await buildEnvironmentMigrationReviewEvidence({
      projectId: 'project-1',
      environmentId: 'env-1',
    });

    expect(evidence.migration.failedCount).toBe(0);
    expect(evidence.migration.awaitingApprovalCount).toBe(1);
    expect(evidence.attentionRuns.map((run) => run.id)).toEqual(['run-awaiting']);
  });
});
