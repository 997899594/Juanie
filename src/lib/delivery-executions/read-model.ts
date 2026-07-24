import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { deliveryExecutions } from '@/lib/db/schema';

const statusLabels = {
  received: '已接收',
  dispatching: '派发中',
  building: '构建中',
  staging_releasing: '预发布中',
  staging_verified: '预发布已验证',
  awaiting_promotion: '等待提升',
  production_releasing: '生产发布中',
  production_verified: '生产已验证',
  historical: '历史交付',
  failed: '失败',
  canceled: '已取消',
} as const;

const eventLabels: Record<string, string> = {
  'source.received': '收到源码变更',
  'source.dispatching': '派发构建执行',
  'build.started': '开始构建',
  'delivery.no_change': '无受影响单元，验证完成',
  'staging.release.requested': '创建预发布',
  'production.release.requested': '创建生产发布',
  'staging.verified': '预发布验证通过',
  'promotion.awaiting': '等待生产提升',
  'promotion.approved': '生产提升已审批',
  'production.verified': '生产验证通过',
  'build.failed': '构建失败',
  'ci.phase.failed': '托管 CI 阶段失败',
  'release.failed': '发布失败',
  'artifact.delivery.completed': '交付制品验证完成',
  'artifact.delivery.failed': '交付制品失败',
  'execution.history.imported': '导入历史交付记录',
};

export async function getDeliveryExecutionReadModel(executionId: string | null) {
  if (!executionId) return null;
  const execution = await db.query.deliveryExecutions.findFirst({
    where: eq(deliveryExecutions.id, executionId),
    with: {
      events: { orderBy: (event) => [asc(event.sequence)] },
      buildRuns: { columns: { id: true, status: true, createdAt: true, finishedAt: true } },
      releases: {
        columns: { id: true, status: true, environmentId: true, createdAt: true },
        with: { environment: { columns: { name: true, isProduction: true } } },
      },
      promotionRequests: {
        columns: { id: true, status: true, contentDigest: true, approvedAt: true },
      },
    },
  });
  if (!execution) return null;
  return {
    id: execution.id,
    status: execution.status,
    statusLabel: statusLabels[execution.status],
    sourceRef: execution.sourceRef,
    sourceCommitSha: execution.sourceCommitSha,
    startedAt: execution.startedAt,
    completedAt: execution.completedAt,
    lastErrorCode: execution.lastErrorCode,
    lastError: execution.lastError,
    events: execution.events.map((event) => ({
      id: event.id,
      type: event.type,
      label: eventLabels[event.type] ?? event.type,
      status: event.toStatus,
      statusLabel: statusLabels[event.toStatus],
      occurredAt: event.occurredAt,
      data: event.data,
    })),
    buildRuns: execution.buildRuns,
    releases: execution.releases,
    promotionRequests: execution.promotionRequests,
  };
}
