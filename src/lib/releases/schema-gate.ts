import { resolveMigrationSpecifications } from '@/lib/migrations';
import { inspectEnvironmentSchemaState } from '@/lib/schema-management/inspect';
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
}

export class ReleaseSchemaGateBlockedError extends Error {
  constructor(
    readonly snapshot: ReleaseSchemaGateSnapshot,
    message = snapshot.blockingReason ?? 'Release blocked by schema state'
  ) {
    super(message);
    this.name = 'ReleaseSchemaGateBlockedError';
  }
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

function buildReleaseSchemaGateSnapshot(
  states: ReleaseSchemaGateState[]
): ReleaseSchemaGateSnapshot {
  const blockingStates = states.filter(isReleaseSchemaStateBlocking);
  const customSignals: PlatformSignalChip[] = [];

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

  for (const state of blockingStates) {
    const chip = getSchemaStatusChip(state.status);
    if (chip && !customSignals.some((existing) => existing.key === chip.key)) {
      customSignals.push(chip);
    }
  }

  const firstBlockingState = blockingStates[0] ?? null;

  return {
    canCreate: blockingStates.length === 0,
    checkedCount: states.length,
    blockingCount: blockingStates.length,
    blockingReason:
      blockingStates.length > 0 ? `存在 ${blockingStates.length} 个数据库 schema 门禁未满足` : null,
    summary: firstBlockingState?.summary ?? null,
    nextActionLabel: blockingStates.length > 0 ? '先在环境页处理数据库纳管' : null,
    customSignals,
    states,
  };
}

export async function inspectReleaseSchemaGate(input: {
  projectId: string;
  environmentId: string;
  serviceIds: string[];
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
}): Promise<ReleaseSchemaGateSnapshot> {
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
    databases.set(spec.database.id, {
      id: spec.database.id,
      name: spec.database.name,
    });
  }

  if (databases.size === 0) {
    return buildReleaseSchemaGateSnapshot([]);
  }

  const states = await Promise.all(
    [...databases.values()].map(async (database) => {
      const state = await inspectEnvironmentSchemaState({
        projectId: input.projectId,
        databaseId: database.id,
        sourceRef: input.sourceRef,
        sourceCommitSha: input.sourceCommitSha,
      });

      return {
        databaseId: database.id,
        databaseName: database.name,
        status: state.status,
        statusLabel: getEnvironmentSchemaStateLabel(state.status),
        summary: state.summary,
        hasLedger: state.hasLedger,
        hasUserTables: state.hasUserTables,
      } satisfies ReleaseSchemaGateState;
    })
  );

  return buildReleaseSchemaGateSnapshot(states);
}
