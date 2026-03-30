import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLogs, services } from '@/lib/db/schema';
import { getInfrastructureDiagnostics } from '@/lib/infrastructure/diagnostics';
import type { ReleaseGovernanceEvent } from '@/lib/releases/recap';

function getAuditMetadata(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export async function getReleaseOperationalContext(input: {
  projectId: string;
  teamId: string;
  environmentId: string;
  environmentName: string;
  environmentIsPreview?: boolean | null;
  namespace?: string | null;
  deploymentStrategy?: 'rolling' | 'controlled' | 'canary' | 'blue_green' | null;
  releaseWindow: {
    startedAt: Date;
    finishedAt?: Date | null;
  };
}): Promise<{
  infrastructureDiagnostics: Awaited<ReturnType<typeof getInfrastructureDiagnostics>> | null;
  governanceEvents: ReleaseGovernanceEvent[];
}> {
  const [serviceList, recentAuditLogs] = await Promise.all([
    input.namespace
      ? db.query.services.findMany({
          where: eq(services.projectId, input.projectId),
          columns: {
            id: true,
            name: true,
            type: true,
            replicas: true,
            cpuRequest: true,
            memoryRequest: true,
          },
        })
      : Promise.resolve([]),
    db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.teamId, input.teamId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(80),
  ]);

  const infrastructureDiagnostics = input.namespace
    ? await getInfrastructureDiagnostics({
        namespace: input.namespace,
        deploymentStrategy: input.deploymentStrategy,
        workloads: serviceList,
        releaseWindow: {
          startedAt: input.releaseWindow.startedAt,
          finishedAt: input.releaseWindow.finishedAt ?? input.releaseWindow.startedAt,
        },
      }).catch(() => null)
    : null;

  const releaseStart = input.releaseWindow.startedAt.getTime() - 15 * 60 * 1000;
  const releaseUpdatedAt = (
    input.releaseWindow.finishedAt ?? input.releaseWindow.startedAt
  ).getTime();
  const governanceEvents = recentAuditLogs
    .filter((log) => {
      if (
        log.action !== 'environment.preview_deleted' &&
        log.action !== 'environment.preview_cleanup_completed' &&
        log.action !== 'environment.remediation_triggered'
      ) {
        return false;
      }

      const createdAt = new Date(log.createdAt).getTime();
      if (createdAt < releaseStart) {
        return false;
      }

      const metadata = getAuditMetadata(log.metadata);
      if (metadata?.projectId !== input.projectId) {
        return false;
      }

      if (log.action === 'environment.preview_deleted') {
        return (
          log.resourceId === input.environmentId || metadata?.environmentId === input.environmentId
        );
      }

      const deletedIds = Array.isArray(metadata?.deletedIds) ? metadata.deletedIds : [];
      return (
        deletedIds.includes(input.environmentId) ||
        input.environmentIsPreview === true ||
        createdAt <= releaseUpdatedAt + 15 * 60 * 1000
      );
    })
    .slice(0, 4)
    .map((log) => {
      const metadata = getAuditMetadata(log.metadata);

      if (log.action === 'environment.preview_deleted') {
        return {
          key: `governance:${log.id}`,
          code: 'preview_deleted' as const,
          title: '平台已回收预览环境',
          description: `${String(metadata?.environmentName ?? input.environmentName)} 已被手动回收`,
          at: log.createdAt,
          tone: 'warning' as const,
        };
      }

      if (log.action === 'environment.remediation_triggered') {
        const action = typeof metadata?.action === 'string' ? metadata.action : 'remediation';
        const podCount = typeof metadata?.podCount === 'number' ? metadata.podCount : 0;
        const mode = metadata?.mode === 'auto' ? 'auto' : 'manual';

        return {
          key: `governance:${log.id}`,
          code:
            action === 'cleanup_terminating_pods'
              ? ('cleanup_terminating_pods' as const)
              : ('restart_deployments' as const),
          title:
            action === 'cleanup_terminating_pods'
              ? mode === 'auto'
                ? '平台自动清理残留 Pod'
                : '平台清理残留 Pod'
              : mode === 'auto'
                ? '平台自动重启环境'
                : '平台重启环境',
          description:
            action === 'cleanup_terminating_pods'
              ? `平台${mode === 'auto' ? '自动' : ''}清理了 ${podCount} 个长时间 Terminating 的 Pod`
              : `平台${mode === 'auto' ? '自动' : ''}触发了当前环境 Deployment 的滚动重启`,
          at: log.createdAt,
          tone: 'info' as const,
        };
      }

      const deletedCount = typeof metadata?.deletedCount === 'number' ? metadata.deletedCount : 0;
      const blockedCount = typeof metadata?.blockedCount === 'number' ? metadata.blockedCount : 0;
      const summaryParts = [`平台回收 ${deletedCount} 个过期预览环境`];

      if (blockedCount > 0) {
        summaryParts.push(`${blockedCount} 个仍被活跃发布阻塞`);
      }

      return {
        key: `governance:${log.id}`,
        code: 'preview_cleanup_completed' as const,
        title: '平台执行预览治理',
        description: summaryParts.join('，'),
        at: log.createdAt,
        tone: deletedCount > 0 ? ('info' as const) : ('warning' as const),
      };
    });

  return {
    infrastructureDiagnostics,
    governanceEvents,
  };
}
