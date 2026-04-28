import { describe, expect, it } from 'bun:test';
import {
  getUnexpectedMigrationJobFailureCode,
  shouldReconcileUnexpectedMigrationJobFailure,
} from '@/lib/queue/migration';
import {
  shouldFailCompletedSchemaRunnerJobWithoutStateUpdate,
  shouldFailMissingSchemaRunnerJob,
  shouldFailStaleSchemaRunnerRun,
} from '@/lib/queue/migration-state-healing';
import { shouldReconcileUnexpectedReleaseJobFailure } from '@/lib/queue/release';

describe('migration queue failure reconciliation', () => {
  it('only reconciles unexpected queue failures for active runs', () => {
    expect(shouldReconcileUnexpectedMigrationJobFailure('queued')).toBe(true);
    expect(shouldReconcileUnexpectedMigrationJobFailure('planning')).toBe(true);
    expect(shouldReconcileUnexpectedMigrationJobFailure('running')).toBe(true);
    expect(shouldReconcileUnexpectedMigrationJobFailure('awaiting_approval')).toBe(false);
    expect(shouldReconcileUnexpectedMigrationJobFailure('success')).toBe(false);
    expect(shouldReconcileUnexpectedMigrationJobFailure('failed')).toBe(false);
  });

  it('classifies stalled BullMQ failures separately from generic job failures', () => {
    expect(
      getUnexpectedMigrationJobFailureCode(new Error('job stalled more than allowable limit'))
    ).toBe('MIGRATION_JOB_STALLED');
    expect(getUnexpectedMigrationJobFailureCode(new Error('worker exited unexpectedly'))).toBe(
      'MIGRATION_JOB_FAILED'
    );
  });

  it('applies grace windows before failing missing or completed schema-runner jobs', () => {
    const now = new Date('2026-04-24T08:00:00.000Z');

    expect(
      shouldFailMissingSchemaRunnerJob({
        updatedAt: new Date('2026-04-24T07:57:00.000Z'),
        now,
        graceMs: 60_000,
      })
    ).toBe(true);
    expect(
      shouldFailCompletedSchemaRunnerJobWithoutStateUpdate({
        updatedAt: new Date('2026-04-24T07:59:50.000Z'),
        now,
        graceMs: 30_000,
      })
    ).toBe(false);
  });

  it('detects stale running schema-runner migration runs', () => {
    const now = new Date('2026-04-24T08:00:00.000Z');

    expect(
      shouldFailStaleSchemaRunnerRun({
        updatedAt: new Date('2026-04-24T07:20:00.000Z'),
        now,
        staleMinutes: 30,
      })
    ).toBe(true);
    expect(
      shouldFailStaleSchemaRunnerRun({
        updatedAt: new Date('2026-04-24T07:45:30.000Z'),
        now,
        staleMinutes: 30,
      })
    ).toBe(false);
  });
});

describe('release queue failure reconciliation', () => {
  it('only reconciles unexpected queue failures for active release phases', () => {
    expect(shouldReconcileUnexpectedReleaseJobFailure('queued')).toBe(true);
    expect(shouldReconcileUnexpectedReleaseJobFailure('migration_pre_running')).toBe(true);
    expect(shouldReconcileUnexpectedReleaseJobFailure('deploying')).toBe(true);
    expect(shouldReconcileUnexpectedReleaseJobFailure('awaiting_approval')).toBe(false);
    expect(shouldReconcileUnexpectedReleaseJobFailure('succeeded')).toBe(false);
    expect(shouldReconcileUnexpectedReleaseJobFailure('failed')).toBe(false);
  });
});
