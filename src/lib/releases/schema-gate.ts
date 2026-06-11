import { isSchemaManagedDatabaseType } from '@/lib/databases/platform-support';
import { resolveMigrationSpecifications } from '@/lib/migrations';
import {
  type EnvironmentSchemaInspectionRequestSnapshot,
  type EnvironmentSchemaStateSnapshot,
  getEnvironmentSchemaStateRevision,
  requestEnvironmentSchemaStateInspection,
} from '@/lib/schema-management/inspect';
import { isSchemaStateForRequestedRevision } from '@/lib/schema-management/revision';
import { getEnvironmentSchemaStateLabel } from '@/lib/schema-safety/presentation';
import type { PlatformSignalChip } from '@/lib/signals/platform';

export interface ReleaseSchemaGateState {
  databaseId: string;
  databaseName: string;
  status:
    | 'aligned'
    | 'pending_migrations'
    | 'aligned_untracked'
    | 'drifted'
    | 'unmanaged'
    | 'blocked';
  statusLabel: string;
  summary: string | null;
  hasLedger?: boolean;
  hasUserTables?: boolean;
  freshness?: 'live' | 'stored' | 'missing';
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
  lastInspectedAt?: string | Date | null;
  refreshStatus?: EnvironmentSchemaInspectionRequestSnapshot['status'] | 'idle';
}

export interface ReleaseSchemaGateRefreshSnapshot {
  requested: boolean;
  queuedCount: number;
  runningCount: number;
  unavailableCount: number;
  failedCount: number;
  missingCount: number;
}

export interface ReleaseSchemaGateSnapshot {
  canCreate: boolean;
  checkedCount: number;
  blockingCount: number;
  blockingReason: string | null;
  summary: string | null;
  nextActionLabel: string | null;
  customSignals: PlatformSignalChip[];
  states: ReleaseSchemaGateState[];
  refresh?: ReleaseSchemaGateRefreshSnapshot;
}

function getSchemaStatusChip(status: ReleaseSchemaGateState['status']): PlatformSignalChip | null {
  switch (status) {
    case 'pending_migrations':
      return {
        key: 'schema:pending_migrations',
        label: '待执行迁移',
        tone: 'neutral',
      };
    case 'aligned_untracked':
      return {
        key: 'schema:aligned_untracked',
        label: '账本缺失',
        tone: 'danger',
      };
    case 'drifted':
      return {
        key: 'schema:drifted',
        label: 'Schema 漂移',
        tone: 'danger',
      };
    case 'unmanaged':
      return {
        key: 'schema:unmanaged',
        label: 'Schema 未纳管',
        tone: 'danger',
      };
    case 'blocked':
      return {
        key: 'schema:blocked',
        label: 'Schema 检查失败',
        tone: 'danger',
      };
    default:
      return null;
  }
}

export function isReleaseSchemaStateBlocking(state: ReleaseSchemaGateState): boolean {
  if (state.status === 'aligned' || state.status === 'pending_migrations') {
    return false;
  }

  if (state.status !== 'unmanaged') {
    return true;
  }

  return state.hasLedger === true || state.hasUserTables === true;
}

export function isReleaseSchemaGateWaitingForRefresh(
  snapshot: Pick<ReleaseSchemaGateSnapshot, 'canCreate' | 'refresh'>
): boolean {
  if (snapshot.canCreate) {
    return false;
  }

  const refresh = snapshot.refresh;
  return Boolean(refresh && refresh.queuedCount + refresh.runningCount > 0);
}

export function isReleaseSchemaGateRefreshUnavailable(
  snapshot: Pick<ReleaseSchemaGateSnapshot, 'refresh'>
): boolean {
  const refresh = snapshot.refresh;
  return Boolean(refresh && refresh.unavailableCount + refresh.failedCount > 0);
}

export function buildReleaseSchemaGateSnapshot(
  states: ReleaseSchemaGateState[],
  refresh?: Partial<ReleaseSchemaGateRefreshSnapshot>
): ReleaseSchemaGateSnapshot {
  const blockingStates = states.filter(isReleaseSchemaStateBlocking);
  const customSignals: PlatformSignalChip[] = [];
  const refreshSnapshot = {
    requested: refresh?.requested ?? false,
    queuedCount: refresh?.queuedCount ?? 0,
    runningCount: refresh?.runningCount ?? 0,
    unavailableCount: refresh?.unavailableCount ?? 0,
    failedCount: refresh?.failedCount ?? 0,
    missingCount: refresh?.missingCount ?? 0,
  } satisfies ReleaseSchemaGateRefreshSnapshot;

  if (blockingStates.length > 0) {
    customSignals.push({
      key: 'schema:blocking',
      label: `Schema 门禁 ${blockingStates.length} 项`,
      tone: 'danger',
    });
  }

  if (states.some((state) => state.status === 'pending_migrations')) {
    customSignals.push({
      key: 'schema:pending_migrations',
      label: `待执行迁移 ${states.filter((state) => state.status === 'pending_migrations').length} 项`,
      tone: 'neutral',
    });
  }

  if (refreshSnapshot.queuedCount + refreshSnapshot.runningCount > 0) {
    customSignals.push({
      key: 'schema:refreshing',
      label: 'Schema 刷新中',
      tone: 'neutral',
    });
  } else if (refreshSnapshot.unavailableCount + refreshSnapshot.failedCount > 0) {
    customSignals.push({
      key: 'schema:refresh-failed',
      label: 'Schema 检查不可用',
      tone: 'danger',
    });
  } else if (refreshSnapshot.missingCount > 0) {
    customSignals.push({
      key: 'schema:unknown',
      label: `Schema 待检查 ${refreshSnapshot.missingCount} 项`,
      tone: 'neutral',
    });
  }

  for (const state of blockingStates) {
    const chip = getSchemaStatusChip(state.status);
    if (chip && !customSignals.some((existing) => existing.key === chip.key)) {
      customSignals.push(chip);
    }
  }

  const firstBlockingState = blockingStates[0] ?? null;
  const hasRefreshBlockedState = blockingStates.some(
    (state) => state.refreshStatus === 'queued' || state.refreshStatus === 'running'
  );
  const hasUnavailableRefreshState =
    refreshSnapshot.unavailableCount + refreshSnapshot.failedCount > 0;
  const hasPendingMissingBlockedState = blockingStates.some(
    (state) => state.freshness === 'missing' && state.refreshStatus !== 'failed'
  );

  return {
    canCreate: blockingStates.length === 0,
    checkedCount: states.length,
    blockingCount: blockingStates.length,
    blockingReason:
      blockingStates.length > 0
        ? hasUnavailableRefreshState
          ? '数据库 schema 检查不可用，请查看环境数据库诊断'
          : hasRefreshBlockedState || hasPendingMissingBlockedState
            ? '数据库 schema 检查尚未完成，请稍后重试'
            : `存在 ${blockingStates.length} 个数据库 schema 门禁未满足`
        : null,
    summary: firstBlockingState?.summary ?? null,
    nextActionLabel:
      blockingStates.length > 0
        ? hasUnavailableRefreshState
          ? '查看数据库诊断'
          : hasRefreshBlockedState || hasPendingMissingBlockedState
            ? '等待 Schema 检查完成'
            : '先在环境页处理数据库纳管'
        : null,
    customSignals,
    states,
    refresh: refreshSnapshot,
  };
}

async function resolveReleaseSchemaGateDatabases(input: {
  projectId: string;
  environmentId: string;
  serviceIds: string[];
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
}): Promise<Array<{ id: string; name: string }>> {
  const [preDeploySpecs, postDeploySpecs] = await Promise.all([
    resolveMigrationSpecifications(input.projectId, input.environmentId, 'preDeploy', {
      serviceIds: input.serviceIds,
      sourceRef: input.sourceRef,
      sourceCommitSha: input.sourceCommitSha,
    }),
    resolveMigrationSpecifications(input.projectId, input.environmentId, 'postDeploy', {
      serviceIds: input.serviceIds,
      sourceRef: input.sourceRef,
      sourceCommitSha: input.sourceCommitSha,
    }),
  ]);

  const databases = new Map<string, { id: string; name: string }>();

  for (const spec of [...preDeploySpecs, ...postDeploySpecs]) {
    if (!isSchemaManagedDatabaseType(spec.database.type)) {
      continue;
    }

    databases.set(spec.database.id, {
      id: spec.database.id,
      name: spec.database.name,
    });
  }

  return [...databases.values()];
}

function toReleaseSchemaGateState(input: {
  database: {
    id: string;
    name: string;
  };
  state: EnvironmentSchemaStateSnapshot;
  freshness: ReleaseSchemaGateState['freshness'];
  refreshStatus?: ReleaseSchemaGateState['refreshStatus'];
}): ReleaseSchemaGateState {
  return {
    databaseId: input.database.id,
    databaseName: input.database.name,
    status: input.state.status,
    statusLabel: getEnvironmentSchemaStateLabel(input.state.status),
    summary: input.state.summary,
    hasLedger: input.state.hasLedger,
    hasUserTables: input.state.hasUserTables,
    freshness: input.freshness,
    sourceRef: input.state.sourceRef,
    sourceCommitSha: input.state.sourceCommitSha,
    lastInspectedAt: input.state.lastInspectedAt,
    refreshStatus: input.refreshStatus ?? 'idle',
  };
}

function buildMissingReleaseSchemaGateState(input: {
  database: {
    id: string;
    name: string;
  };
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
  requestedRefresh: boolean;
  refreshStatus?: ReleaseSchemaGateState['refreshStatus'];
}): ReleaseSchemaGateState {
  return {
    databaseId: input.database.id,
    databaseName: input.database.name,
    status: 'blocked',
    statusLabel: getEnvironmentSchemaStateLabel('blocked'),
    summary: input.requestedRefresh
      ? '尚未有当前版本的 schema 检查结果，已请求后台刷新。'
      : '尚未有当前版本的 schema 检查结果。',
    sourceRef: input.sourceRef ?? null,
    sourceCommitSha: input.sourceCommitSha ?? null,
    hasLedger: false,
    hasUserTables: false,
    freshness: 'missing',
    lastInspectedAt: null,
    refreshStatus: input.refreshStatus ?? 'idle',
  };
}

export function isStoredSchemaStateForRequestedRevision(
  state: EnvironmentSchemaStateSnapshot,
  input: {
    sourceRef?: string | null;
    sourceCommitSha?: string | null;
  }
): boolean {
  return isSchemaStateForRequestedRevision(state, input);
}

export async function getStoredReleaseSchemaGate(input: {
  projectId: string;
  environmentId: string;
  serviceIds: string[];
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
  requestRefresh?: boolean;
}): Promise<ReleaseSchemaGateSnapshot> {
  const databases = await resolveReleaseSchemaGateDatabases(input);

  if (databases.length === 0) {
    return buildReleaseSchemaGateSnapshot([]);
  }

  const revisionStates = await Promise.all(
    databases.map(async (database) => ({
      databaseId: database.id,
      state: await getEnvironmentSchemaStateRevision(input.projectId, database.id, {
        sourceRef: input.sourceRef,
        sourceCommitSha: input.sourceCommitSha,
      }),
    }))
  );
  const revisionStateByDatabaseId = new Map(
    revisionStates.map((item) => [item.databaseId, item.state] as const)
  );
  const refreshRequests = input.requestRefresh
    ? await Promise.all(
        databases
          .filter((database) => !revisionStateByDatabaseId.get(database.id))
          .map(async (database) => ({
            databaseId: database.id,
            request: await requestEnvironmentSchemaStateInspection({
              projectId: input.projectId,
              databaseId: database.id,
              sourceRef: input.sourceRef,
              sourceCommitSha: input.sourceCommitSha,
              updateCurrentState: false,
            }),
          }))
      )
    : [];
  const refreshByDatabaseId = new Map(
    refreshRequests.map((item) => [item.databaseId, item.request] as const)
  );

  const states = await Promise.all(
    databases.map(async (database) => {
      const refresh = refreshByDatabaseId.get(database.id) ?? null;
      const state = revisionStateByDatabaseId.get(database.id) ?? null;

      if (!state || !isStoredSchemaStateForRequestedRevision(state, input)) {
        return buildMissingReleaseSchemaGateState({
          database,
          sourceRef: input.sourceRef,
          sourceCommitSha: input.sourceCommitSha,
          requestedRefresh: input.requestRefresh === true,
          refreshStatus: refresh?.status ?? 'idle',
        });
      }

      return toReleaseSchemaGateState({
        database,
        state,
        freshness: 'stored',
        refreshStatus: refresh?.status ?? 'idle',
      });
    })
  );

  return buildReleaseSchemaGateSnapshot(states, {
    requested: input.requestRefresh === true,
    queuedCount: refreshRequests.filter((item) => item.request.status === 'queued').length,
    runningCount: refreshRequests.filter((item) => item.request.status === 'running').length,
    unavailableCount: refreshRequests.filter((item) => item.request.status === 'unavailable')
      .length,
    failedCount: refreshRequests.filter((item) => item.request.status === 'failed').length,
    missingCount: states.filter((state) => state.freshness === 'missing').length,
  });
}
