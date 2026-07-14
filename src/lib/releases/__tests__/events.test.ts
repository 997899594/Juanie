import { describe, expect, it } from 'bun:test';
import { buildReleaseEvent, projectReleaseStatus } from '@/lib/releases/events';

describe('release event ledger', () => {
  it('builds an immutable event identity and projects status transitions', () => {
    const event = buildReleaseEvent({
      releaseId: 'release-1',
      projectId: 'project-1',
      environmentId: 'environment-1',
      eventKey: 'admission-started',
      type: 'release.status.changed',
      data: { from: 'queued', to: 'admission_running' },
      correlationId: 'release-1',
      causationId: 'outbox-1',
    });

    expect(event.eventKey).toBe('admission-started');
    expect(projectReleaseStatus('queued', event)).toBe('admission_running');
  });

  it('keeps status unchanged for non-status events', () => {
    const event = buildReleaseEvent({
      releaseId: 'release-1',
      projectId: 'project-1',
      environmentId: 'environment-1',
      eventKey: 'approval-requested',
      type: 'release.approval.requested',
      data: { phase: 'preDeploy' },
      correlationId: 'release-1',
    });

    expect(projectReleaseStatus('migration_pre_running', event)).toBe('migration_pre_running');
  });

  it('rejects an unknown projected release status', () => {
    const event = buildReleaseEvent({
      releaseId: 'release-1',
      projectId: 'project-1',
      environmentId: 'environment-1',
      eventKey: 'invalid-status',
      type: 'release.status.changed',
      data: { from: 'queued', to: 'made_up' },
      correlationId: 'release-1',
    });

    expect(() => projectReleaseStatus('queued', event)).toThrow('Unknown release status');
  });
});
