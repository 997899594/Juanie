import { sql } from 'drizzle-orm';
import { Counter, collectDefaultMetrics, Gauge, Histogram, Registry } from 'prom-client';
import { db } from '@/lib/db';

export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry, prefix: 'juanie_' });

export const outboxDispatchTotal = new Counter({
  name: 'juanie_outbox_dispatch_total',
  help: 'Outbox dispatch attempts by topic and outcome',
  labelNames: ['topic', 'outcome'] as const,
  registers: [metricsRegistry],
});

export const outboxDispatchDuration = new Histogram({
  name: 'juanie_outbox_dispatch_duration_seconds',
  help: 'Outbox delivery latency to Restate ingress',
  labelNames: ['topic'] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

const outboxMessages = new Gauge({
  name: 'juanie_outbox_messages',
  help: 'Current outbox messages by status',
  labelNames: ['status'] as const,
  registers: [metricsRegistry],
});

const outboxOldestPendingSeconds = new Gauge({
  name: 'juanie_outbox_oldest_pending_seconds',
  help: 'Age of the oldest dispatchable outbox message',
  registers: [metricsRegistry],
});

const aiTasks = new Gauge({
  name: 'juanie_ai_tasks',
  help: 'Current PostgreSQL-backed AI tasks by status',
  labelNames: ['status'] as const,
  registers: [metricsRegistry],
});

const aiTaskOldestQueuedSeconds = new Gauge({
  name: 'juanie_ai_task_oldest_queued_seconds',
  help: 'Age of the oldest queued PostgreSQL-backed AI task',
  registers: [metricsRegistry],
});

const staleWorkflowProjections = new Gauge({
  name: 'juanie_stale_workflow_projections',
  help: 'Control-plane projections that have remained in an active workflow state beyond policy',
  labelNames: ['aggregate_type'] as const,
  registers: [metricsRegistry],
});

export async function collectControlPlaneMetrics(): Promise<void> {
  const result = await db.execute<{
    status: string;
    count: number;
    oldestPendingSeconds: number | null;
  }>(sql`
    select status::text as status,
           count(*)::int as count,
           case
             when status in ('pending', 'failed')
             then extract(epoch from now() - min("createdAt"))::float8
             else null
           end as "oldestPendingSeconds"
    from "outboxMessage"
    group by status
  `);

  outboxMessages.reset();
  let oldest = 0;
  for (const row of result) {
    outboxMessages.set({ status: row.status }, row.count);
    oldest = Math.max(oldest, row.oldestPendingSeconds ?? 0);
  }
  outboxOldestPendingSeconds.set(oldest);

  const taskRows = await db.execute<{
    status: string;
    count: number;
    oldestQueuedSeconds: number | null;
  }>(sql`
    select status::text as status,
           count(*)::int as count,
           case when status = 'queued'
             then extract(epoch from now() - min("createdAt"))::float8
             else null
           end as "oldestQueuedSeconds"
    from "aiTask"
    group by status
  `);
  aiTasks.reset();
  let oldestQueued = 0;
  for (const row of taskRows) {
    aiTasks.set({ status: row.status }, row.count);
    oldestQueued = Math.max(oldestQueued, row.oldestQueuedSeconds ?? 0);
  }
  aiTaskOldestQueuedSeconds.set(oldestQueued);

  const staleRows = await db.execute<{ aggregateType: string; count: number }>(sql`
    select 'project' as "aggregateType", count(*)::int as count
    from "project"
    where status in ('initializing', 'deleting')
      and "updatedAt" < now() - interval '30 minutes'
    union all
    select 'release' as "aggregateType", count(*)::int as count
    from "release"
    where status in (
      'admission_running', 'queued', 'planning', 'migration_pre_running', 'deploying',
      'awaiting_rollout', 'verifying', 'migration_post_running'
    )
      and "updatedAt" < now() - interval '30 minutes'
  `);
  staleWorkflowProjections.reset();
  for (const row of staleRows) {
    staleWorkflowProjections.set({ aggregate_type: row.aggregateType }, row.count);
  }
}

export function startMetricsServer(port = Number(process.env.METRICS_PORT ?? 9464)): Server {
  const server = createServer(async (request, response) => {
    if (request.url !== '/metrics') {
      response.writeHead(404).end();
      return;
    }

    try {
      await collectControlPlaneMetrics();
      response.writeHead(200, { 'content-type': metricsRegistry.contentType });
      response.end(await metricsRegistry.metrics());
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain' });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });
  server.listen(port);
  return server;
}

import { createServer, type Server } from 'node:http';
