import { describe, expect, it } from 'bun:test';
import { buildOutboxMessage } from '@/lib/outbox/service';

describe('transactional outbox contract', () => {
  it('builds a stable deduplication identity from the command identity', () => {
    const first = buildOutboxMessage({
      topic: 'project.init.requested',
      aggregateType: 'project',
      aggregateId: 'project-1',
      commandId: 'command-1',
      payload: { projectId: 'project-1', mode: 'import' },
    });
    const second = buildOutboxMessage({
      topic: 'project.init.requested',
      aggregateType: 'project',
      aggregateId: 'project-1',
      commandId: 'command-1',
      payload: { projectId: 'project-1', mode: 'import' },
    });

    expect(first.dedupeKey).toBe('project.init.requested:project:project-1:command-1');
    expect(second.dedupeKey).toBe(first.dedupeKey);
    expect(first.status).toBe('pending');
  });

  it('does not derive message identity from mutable payload fields', () => {
    const message = buildOutboxMessage({
      topic: 'release.requested',
      aggregateType: 'release',
      aggregateId: 'release-1',
      commandId: 'build-42',
      payload: { sourceCommitSha: 'sha-new' },
    });

    expect(message.dedupeKey).toBe('release.requested:release:release-1:build-42');
  });

  it('keeps project deletion retries as immutable attempts', () => {
    const firstAttempt = buildOutboxMessage({
      topic: 'project.delete.requested',
      aggregateType: 'project',
      aggregateId: 'project-1',
      commandId: 'delete-attempt-1',
      payload: { deletionAttemptId: 'delete-attempt-1' },
    });
    const retryAttempt = buildOutboxMessage({
      topic: 'project.delete.requested',
      aggregateType: 'project',
      aggregateId: 'project-1',
      commandId: 'delete-attempt-2',
      payload: { deletionAttemptId: 'delete-attempt-2' },
    });

    expect(firstAttempt.dedupeKey).not.toBe(retryAttempt.dedupeKey);
  });

  it('uses the source delivery aggregate as the durable dispatch identity', () => {
    const message = buildOutboxMessage({
      topic: 'source.delivery.requested',
      aggregateType: 'sourceDelivery',
      aggregateId: 'source-delivery-1',
      commandId: 'dispatch-1',
      payload: {},
    });

    expect(message.dedupeKey).toBe(
      'source.delivery.requested:sourceDelivery:source-delivery-1:dispatch-1'
    );
  });
});
