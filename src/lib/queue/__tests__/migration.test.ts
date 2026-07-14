import { describe, expect, it } from 'bun:test';
import {
  shouldFailCompletedSchemaRunnerJobWithoutStateUpdate,
  shouldFailMissingSchemaRunnerJob,
  shouldFailStaleSchemaRunnerRun,
} from '@/lib/queue/migration-state-healing';
import { resolveMigrationPhaseNextAction } from '@/lib/releases/phase-progress';

describe('migration recovery', () => {
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

describe('release durable execution', () => {
  it('treats skipped no-op migration runs as completed release phase work', () => {
    expect(
      resolveMigrationPhaseNextAction([
        {
          id: 'run-noop',
          status: 'skipped',
          createdAt: new Date('2026-04-24T08:00:00.000Z'),
        },
      ])
    ).toEqual({ kind: 'completed' });
  });
});
