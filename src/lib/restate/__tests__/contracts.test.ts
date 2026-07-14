import { describe, expect, it } from 'bun:test';
import { buildRestateInvocationUrl } from '@/lib/restate/config';
import {
  buildDurableCommand,
  buildRestateInvocationHeaders,
  resolveRestateTarget,
} from '@/lib/restate/contracts';

describe('Restate command contracts', () => {
  it('maps project initialization to a keyed workflow invocation', () => {
    const target = resolveRestateTarget('project.init.requested', 'project-1', 'initial');
    expect(buildRestateInvocationUrl('http://restate:8080/', target)).toBe(
      'http://restate:8080/ProjectInitializationWorkflow/project-1%3Ainitial/run/send'
    );
    expect(buildRestateInvocationHeaders(target, 'outbox-1')).toEqual({
      'content-type': 'application/json',
    });
  });

  it('uses the outbox message id for virtual object request idempotency', () => {
    const target = resolveRestateTarget('deployment.requested', 'deployment-1', 'command-1');

    expect(buildRestateInvocationHeaders(target, 'outbox-1')).toEqual({
      'content-type': 'application/json',
      'idempotency-key': 'outbox-1',
    });
  });

  it('creates a new project deletion workflow for each explicit attempt', () => {
    const firstAttempt = resolveRestateTarget(
      'project.delete.requested',
      'project-1',
      'delete-attempt-1'
    );
    const retryAttempt = resolveRestateTarget(
      'project.delete.requested',
      'project-1',
      'delete-attempt-2'
    );

    expect(firstAttempt.key).toBe('project-1:delete-attempt-1');
    expect(retryAttempt.key).toBe('project-1:delete-attempt-2');
    expect(retryAttempt.key).not.toBe(firstAttempt.key);
  });

  it('keeps command identity outside mutable payload', () => {
    expect(
      buildDurableCommand({
        commandId: 'command-1',
        aggregateId: 'release-1',
        payload: { traceId: 'trace-1' },
      })
    ).toEqual({
      commandId: 'command-1',
      aggregateId: 'release-1',
      payload: { traceId: 'trace-1' },
    });
  });
});
