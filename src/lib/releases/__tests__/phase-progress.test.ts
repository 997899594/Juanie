import { describe, expect, it } from 'bun:test';
import { resolveMigrationPhaseNextAction } from '@/lib/releases/phase-progress';

describe('release phase progress', () => {
  const baseTime = new Date('2026-04-24T10:00:00.000Z');

  it('keeps the phase running while a migration run is in progress', () => {
    expect(
      resolveMigrationPhaseNextAction([
        {
          id: 'run-1',
          status: 'running',
          createdAt: baseTime,
        },
        {
          id: 'run-2',
          status: 'queued',
          createdAt: new Date(baseTime.getTime() + 1000),
        },
      ])
    ).toEqual({ kind: 'running' });
  });

  it('starts the oldest queued run before exposing approval waits', () => {
    expect(
      resolveMigrationPhaseNextAction([
        {
          id: 'run-1',
          status: 'awaiting_approval',
          createdAt: new Date(baseTime.getTime() + 1000),
        },
        {
          id: 'run-0',
          status: 'queued',
          createdAt: baseTime,
        },
      ])
    ).toEqual({ kind: 'start_run', runId: 'run-0' });
  });

  it('surfaces approval after queued runs have cleared', () => {
    expect(
      resolveMigrationPhaseNextAction([
        {
          id: 'run-1',
          status: 'success',
          createdAt: baseTime,
        },
        {
          id: 'run-2',
          status: 'awaiting_approval',
          createdAt: new Date(baseTime.getTime() + 1000),
        },
      ])
    ).toEqual({ kind: 'awaiting_approval', runId: 'run-2' });
  });

  it('marks the phase completed only when every run succeeded', () => {
    expect(
      resolveMigrationPhaseNextAction([
        {
          id: 'run-1',
          status: 'success',
          createdAt: baseTime,
        },
        {
          id: 'run-2',
          status: 'success',
          createdAt: new Date(baseTime.getTime() + 1000),
        },
      ])
    ).toEqual({ kind: 'completed' });
  });

  it('treats failed runs as blocked once no active or queued work remains', () => {
    expect(
      resolveMigrationPhaseNextAction([
        {
          id: 'run-1',
          status: 'success',
          createdAt: baseTime,
        },
        {
          id: 'run-2',
          status: 'failed',
          createdAt: new Date(baseTime.getTime() + 1000),
        },
      ])
    ).toEqual({ kind: 'blocked', runId: 'run-2', status: 'failed' });
  });
});
