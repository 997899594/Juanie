import { resolveMigrationSpecifications } from '@/lib/migrations';
import type { PlatformSignalChip } from '@/lib/signals/platform';

interface PreviewDatabaseGuardEnvironmentLike {
  kind?: string | null;
  isPreview?: boolean | null;
  databaseStrategy?: 'direct' | 'inherit' | 'isolated_clone' | null;
}

interface PreviewDatabaseGuardMigrationSpecLike {
  specification: {
    phase: 'preDeploy' | 'postDeploy' | 'manual';
  };
}

export interface PreviewDatabaseGuardSnapshot {
  canCreate: boolean;
  blockingReason: string | null;
  summary: string | null;
  nextActionLabel: string | null;
  customSignals: PlatformSignalChip[];
}

export class PreviewDatabaseGuardBlockedError extends Error {
  constructor(
    readonly snapshot: PreviewDatabaseGuardSnapshot,
    message = snapshot.blockingReason ?? 'Release blocked by preview database strategy'
  ) {
    super(message);
    this.name = 'PreviewDatabaseGuardBlockedError';
  }
}

export const previewDatabaseGuardMessage =
  '当前预览环境继承基础数据库，检测到该分支包含数据库迁移。为避免误改基础环境数据库，请改用独立预览库后再启动预览环境。';

const previewDatabaseGuardNextActionLabel = '切换到独立预览库后重试';

function isPreviewEnvironment(environment: PreviewDatabaseGuardEnvironmentLike): boolean {
  return environment.kind === 'preview' || environment.isPreview === true;
}

function hasReleaseMigrations(migrationSpecs: PreviewDatabaseGuardMigrationSpecLike[]): boolean {
  return migrationSpecs.some(
    (spec) => spec.specification.phase === 'preDeploy' || spec.specification.phase === 'postDeploy'
  );
}

export function inspectPreviewDatabaseGuard(input: {
  environment: PreviewDatabaseGuardEnvironmentLike;
  migrationSpecs: PreviewDatabaseGuardMigrationSpecLike[];
}): PreviewDatabaseGuardSnapshot {
  const shouldBlock =
    isPreviewEnvironment(input.environment) &&
    input.environment.databaseStrategy === 'inherit' &&
    hasReleaseMigrations(input.migrationSpecs);

  return {
    canCreate: !shouldBlock,
    blockingReason: shouldBlock ? previewDatabaseGuardMessage : null,
    summary: shouldBlock ? previewDatabaseGuardMessage : null,
    nextActionLabel: shouldBlock ? previewDatabaseGuardNextActionLabel : null,
    customSignals: shouldBlock
      ? [
          {
            key: 'preview-database:inherit-migration-blocked',
            label: '预览库继承风险',
            tone: 'danger',
          },
        ]
      : [],
  };
}

export async function inspectPreviewDatabaseGuardForRelease(input: {
  projectId: string;
  environmentId: string;
  environment: PreviewDatabaseGuardEnvironmentLike;
  serviceIds: string[];
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
}): Promise<PreviewDatabaseGuardSnapshot> {
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

  return inspectPreviewDatabaseGuard({
    environment: input.environment,
    migrationSpecs: [...preDeploySpecs, ...postDeploySpecs],
  });
}
