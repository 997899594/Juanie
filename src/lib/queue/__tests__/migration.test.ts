import { describe, expect, it } from 'bun:test';
import {
  getUnexpectedMigrationJobFailureCode,
  shouldReconcileUnexpectedMigrationJobFailure,
} from '@/lib/queue/migration';

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
});
