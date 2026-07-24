import type { OutboxTopic } from '@/lib/outbox/types';
import { type RestateInvocationTarget, restateServiceNames } from '@/lib/restate/config';

export interface DurableCommand {
  commandId: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}

const topicTargets: Record<OutboxTopic, Omit<RestateInvocationTarget, 'key'>> = {
  'project.init.requested': {
    service: restateServiceNames.projectInitialization,
    handler: 'run',
    idempotencyMode: 'workflow-key',
  },
  'project.init.retry.requested': {
    service: restateServiceNames.projectInitialization,
    handler: 'run',
    idempotencyMode: 'workflow-key',
  },
  'project.delete.requested': {
    service: restateServiceNames.projectDeletion,
    handler: 'run',
    idempotencyMode: 'workflow-key',
  },
  'release.requested': {
    service: restateServiceNames.release,
    handler: 'run',
    idempotencyMode: 'request-header',
  },
  'release.rollout.requested': {
    service: restateServiceNames.release,
    handler: 'rollout',
    idempotencyMode: 'request-header',
  },
  'migration.requested': {
    service: restateServiceNames.migration,
    handler: 'run',
    idempotencyMode: 'request-header',
  },
  'schema.repair.requested': {
    service: restateServiceNames.schemaRepair,
    handler: 'run',
    idempotencyMode: 'request-header',
  },
  'environment.runtime.requested': {
    service: restateServiceNames.environmentRuntime,
    handler: 'run',
    idempotencyMode: 'request-header',
  },
  'deployment.requested': {
    service: restateServiceNames.deployment,
    handler: 'run',
    idempotencyMode: 'request-header',
  },
  'source.delivery.requested': {
    service: restateServiceNames.sourceDelivery,
    handler: 'run',
    idempotencyMode: 'request-header',
  },
  'source.webhook.reconcile.requested': {
    service: restateServiceNames.sourceWebhookController,
    handler: 'run',
    idempotencyMode: 'request-header',
  },
};

const attemptScopedWorkflowTopics = new Set<OutboxTopic>([
  'project.init.requested',
  'project.init.retry.requested',
  'project.delete.requested',
]);

export function resolveRestateTarget(
  topic: OutboxTopic,
  aggregateId: string,
  commandId: string,
  payload: Record<string, unknown> = {}
) {
  const executionKey = payload.executionKey;
  const requiresExecutionKey =
    topic === 'release.requested' ||
    topic === 'release.rollout.requested' ||
    topic === 'migration.requested';
  if (requiresExecutionKey && (typeof executionKey !== 'string' || !executionKey)) {
    throw new Error(`${topic} requires an executionKey`);
  }
  const key = attemptScopedWorkflowTopics.has(topic)
    ? `${aggregateId}:${commandId}`
    : requiresExecutionKey
      ? (executionKey as string)
      : aggregateId;
  return {
    ...topicTargets[topic],
    key,
    oneWay: true,
  } satisfies RestateInvocationTarget;
}

export function buildDurableCommand(input: {
  commandId: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}): DurableCommand {
  return {
    commandId: input.commandId,
    aggregateId: input.aggregateId,
    payload: input.payload,
  };
}

export function buildRestateInvocationHeaders(
  target: RestateInvocationTarget,
  outboxMessageId: string
): Record<string, string> {
  return {
    'content-type': 'application/json',
    ...(target.idempotencyMode === 'request-header' ? { 'idempotency-key': outboxMessageId } : {}),
  };
}
