import postgres from 'postgres';
import { getNormalizedDatabaseUrlFromEnv } from '@/lib/db/connection-url';
import { logger } from '@/lib/logger';
import type { OutboxTopic } from '@/lib/outbox/types';
import { buildRestateInvocationUrl, getRestateIngressUrl } from '@/lib/restate/config';
import {
  buildDurableCommand,
  buildRestateInvocationHeaders,
  resolveRestateTarget,
} from '@/lib/restate/contracts';
import { startTelemetry, stopTelemetry } from '@/lib/telemetry/instrumentation';
import {
  outboxDispatchDuration,
  outboxDispatchTotal,
  startMetricsServer,
} from '@/lib/telemetry/metrics';

const dispatcherLogger = logger.child({ component: 'outbox-dispatcher' });
const dispatcherId = `${process.env.HOSTNAME ?? 'local'}:${process.pid}`;
const batchSize = 25;
const maxAttempts = 20;
const pollIntervalMs = 500;

interface ClaimedOutboxMessage {
  id: string;
  topic: OutboxTopic;
  aggregateId: string;
  commandId: string;
  payload: Record<string, unknown>;
  attemptCount: number;
}

export async function dispatchOutboxMessage(
  message: ClaimedOutboxMessage,
  options: { ingressUrl?: string; fetch?: typeof fetch } = {}
): Promise<void> {
  const startedAt = performance.now();
  return trace.getTracer('juanie-outbox').startActiveSpan('outbox.dispatch', async (span) => {
    span.setAttributes({
      'messaging.message.id': message.id,
      'messaging.destination.name': message.topic,
      'juanie.aggregate.id': message.aggregateId,
      'juanie.command.id': message.commandId,
    });

    try {
      const request = options.fetch ?? fetch;
      const target = resolveRestateTarget(message.topic, message.aggregateId, message.commandId);
      const response = await request(
        buildRestateInvocationUrl(options.ingressUrl ?? getRestateIngressUrl(), target),
        {
          method: 'POST',
          headers: buildRestateInvocationHeaders(target, message.id),
          body: JSON.stringify(
            buildDurableCommand({
              commandId: message.commandId,
              aggregateId: message.aggregateId,
              payload: message.payload,
            })
          ),
          signal: AbortSignal.timeout(10_000),
        }
      );

      if (!response.ok) {
        const responseBody = (await response.text()).slice(0, 2_000);
        const details = responseBody ? `: ${responseBody}` : '';
        throw new Error(`Restate ingress rejected command with HTTP ${response.status}${details}`);
      }
      outboxDispatchTotal.inc({ topic: message.topic, outcome: 'delivered' });
    } catch (error) {
      outboxDispatchTotal.inc({ topic: message.topic, outcome: 'failed' });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      outboxDispatchDuration.observe(
        { topic: message.topic },
        (performance.now() - startedAt) / 1000
      );
      span.end();
    }
  });
}

type DispatcherSql = ReturnType<typeof postgres>;
let dispatcherSql: DispatcherSql | null = null;
let stopping = false;

function getDispatcherSql(): DispatcherSql {
  if (!dispatcherSql) {
    dispatcherSql = postgres(getNormalizedDatabaseUrlFromEnv(), { max: 4 });
  }
  return dispatcherSql;
}

export async function closeOutboxDispatcherStore(): Promise<void> {
  const activeSql = dispatcherSql;
  dispatcherSql = null;
  await activeSql?.end({ timeout: 5 });
}

export async function claimOutboxMessages(): Promise<ClaimedOutboxMessage[]> {
  const sql = getDispatcherSql();
  return sql.begin(async (transaction) => {
    const rows = await transaction<ClaimedOutboxMessage[]>`
      with candidates as (
        select id
        from "outboxMessage"
        where (
          status in ('pending', 'failed')
          and "availableAt" <= now()
        ) or (
          status = 'dispatching'
          and "claimedAt" < now() - interval '2 minutes'
        )
        order by "availableAt", "createdAt"
        for update skip locked
        limit ${batchSize}
      )
      update "outboxMessage" as message
      set status = 'dispatching',
          "attemptCount" = message."attemptCount" + 1,
          "claimedAt" = now(),
          "claimedBy" = ${dispatcherId},
          "updatedAt" = now()
      from candidates
      where message.id = candidates.id
      returning message.id,
                message.topic,
                message."aggregateId",
                message."commandId",
                message.payload,
                message."attemptCount"
    `;
    return rows;
  });
}

async function markDelivered(id: string): Promise<void> {
  const sql = getDispatcherSql();
  await sql`
    update "outboxMessage"
    set status = 'delivered',
        "deliveredAt" = now(),
        "claimedAt" = null,
        "claimedBy" = null,
        "lastError" = null,
        "updatedAt" = now()
    where id = ${id}
      and "claimedBy" = ${dispatcherId}
  `;
}

async function markFailed(message: ClaimedOutboxMessage, error: unknown): Promise<void> {
  const sql = getDispatcherSql();
  const terminal = message.attemptCount >= maxAttempts;
  const retryDelaySeconds = Math.min(300, 2 ** Math.min(message.attemptCount, 8));
  await sql`
    update "outboxMessage"
    set status = ${terminal ? 'dead_letter' : 'failed'}::"outboxStatus",
        "availableAt" = now() + (${retryDelaySeconds} * interval '1 second'),
        "claimedAt" = null,
        "claimedBy" = null,
        "lastError" = ${error instanceof Error ? error.message : String(error)},
        "updatedAt" = now()
    where id = ${message.id}
      and "claimedBy" = ${dispatcherId}
  `;
}

export async function dispatchOutboxBatch(): Promise<number> {
  const messages = await claimOutboxMessages();
  await Promise.all(
    messages.map(async (message) => {
      try {
        await dispatchOutboxMessage(message);
        await markDelivered(message.id);
      } catch (error) {
        dispatcherLogger.warn('Outbox delivery failed', {
          outboxMessageId: message.id,
          topic: message.topic,
          attemptCount: message.attemptCount,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        await markFailed(message, error);
      }
    })
  );
  return messages.length;
}

async function run(): Promise<void> {
  await startTelemetry('juanie-outbox-dispatcher');
  const metricsServer = startMetricsServer();
  dispatcherLogger.info('Outbox dispatcher started', { dispatcherId });
  while (!stopping) {
    const count = await dispatchOutboxBatch();
    if (count === 0) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }
  metricsServer.close();
  await closeOutboxDispatcherStore();
  await stopTelemetry();
}

function stop(): void {
  stopping = true;
}

process.once('SIGINT', stop);
process.once('SIGTERM', stop);

if (import.meta.main) {
  run().catch((error) => {
    dispatcherLogger.error('Outbox dispatcher stopped unexpectedly', error);
    process.exit(1);
  });
}

import { SpanStatusCode, trace } from '@opentelemetry/api';
