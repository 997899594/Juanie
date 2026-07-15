interface ReleaseArtifactLike {
  kind?: string | null;
  name?: string | null;
  variant?: string | null;
  platform?: string | null;
  uri?: string | null;
  serviceId?: string | null;
  imageUrl?: string | null;
  imageDigest?: string | null;
  service?: {
    id?: string;
    name: string;
  } | null;
}

interface ReleaseMigrationLike {
  databaseId?: string;
  serviceId?: string | null;
  specification?:
    | {
        tool?: string;
        phase?: string;
        command?: string;
        releaseStage?: string | null;
        targetVersion?: string | null;
      }
    | null
    | undefined;
  database?: {
    id?: string;
    name: string;
  } | null;
  service?: {
    id?: string;
    name: string;
  } | null;
}

interface ReleaseLike {
  artifacts: ReleaseArtifactLike[];
  migrationRuns: ReleaseMigrationLike[];
}

export interface ReleaseArtifactDiffItem {
  serviceId: string;
  serviceName: string;
  change: 'added' | 'updated' | 'removed';
  previousImageUrl: string | null;
  currentImageUrl: string | null;
}

export interface ReleaseMigrationDiffItem {
  key: string;
  label: string;
  change: 'added' | 'removed';
  tool: string;
  phase: string;
}

export interface ReleaseDiffSnapshot {
  isFirstRelease: boolean;
  changedArtifacts: ReleaseArtifactDiffItem[];
  changedMigrations: ReleaseMigrationDiffItem[];
}

function normalizeArtifactKey(artifact: ReleaseArtifactLike): string {
  if ((artifact.kind ?? 'image') === 'image') {
    return artifact.serviceId ?? artifact.service?.id ?? artifact.service?.name ?? 'image';
  }

  return [
    artifact.kind,
    artifact.name,
    artifact.variant ?? 'default',
    artifact.platform ?? 'any',
  ].join('::');
}

function getArtifactName(artifact: ReleaseArtifactLike): string {
  const fallback = [artifact.name, artifact.variant, artifact.platform].filter(Boolean).join(' / ');
  return artifact.service?.name ?? (fallback || 'artifact');
}

function getArtifactUri(artifact: ReleaseArtifactLike): string | null {
  return artifact.uri ?? artifact.imageUrl ?? null;
}

function normalizeMigrationKey(run: ReleaseMigrationLike): string | null {
  if (!run.specification) {
    return null;
  }

  if (!run.specification.tool || !run.specification.phase || !run.specification.command) {
    return null;
  }

  return [
    run.databaseId ?? run.database?.id ?? run.database?.name ?? 'database',
    run.serviceId ?? run.service?.id ?? run.service?.name ?? 'project',
    run.specification.tool,
    run.specification.phase,
    run.specification.releaseStage ?? 'standard',
    run.specification.targetVersion ?? 'latest',
    run.specification.command,
  ].join('::');
}

function buildMigrationLabel(run: ReleaseMigrationLike): string {
  const databaseName = run.database?.name ?? '数据库';
  const serviceName = run.service?.name ?? '项目';
  const tool = run.specification?.tool ?? 'custom';
  const phase = run.specification?.phase ?? 'manual';
  const releaseStage = run.specification?.releaseStage;

  return `${databaseName} · ${serviceName} · ${tool} · ${releaseStage && releaseStage !== 'standard' ? releaseStage : phase}`;
}

export function buildReleaseDiff(
  current: ReleaseLike,
  previous: ReleaseLike | null
): ReleaseDiffSnapshot {
  if (!previous) {
    return {
      isFirstRelease: true,
      changedArtifacts: current.artifacts.map((artifact) => ({
        serviceId: normalizeArtifactKey(artifact),
        serviceName: getArtifactName(artifact),
        change: 'added',
        previousImageUrl: null,
        currentImageUrl: getArtifactUri(artifact),
      })),
      changedMigrations: current.migrationRuns
        .filter((run) => run.specification)
        .map((run) => ({
          key: normalizeMigrationKey(run) ?? `${run.databaseId}::unknown`,
          label: buildMigrationLabel(run),
          change: 'added',
          tool: run.specification?.tool ?? 'custom',
          phase: run.specification?.phase ?? 'manual',
        })),
    };
  }

  const previousArtifacts = new Map(
    previous.artifacts.map((artifact) => [normalizeArtifactKey(artifact), artifact])
  );
  const currentArtifacts = new Map(
    current.artifacts.map((artifact) => [normalizeArtifactKey(artifact), artifact])
  );

  const changedArtifacts: ReleaseArtifactDiffItem[] = [];

  for (const artifact of current.artifacts) {
    const previousArtifact = previousArtifacts.get(normalizeArtifactKey(artifact));
    if (!previousArtifact) {
      changedArtifacts.push({
        serviceId: normalizeArtifactKey(artifact),
        serviceName: getArtifactName(artifact),
        change: 'added',
        previousImageUrl: null,
        currentImageUrl: getArtifactUri(artifact),
      });
      continue;
    }

    if (
      getArtifactUri(previousArtifact) !== getArtifactUri(artifact) ||
      (previousArtifact.imageDigest ?? null) !== (artifact.imageDigest ?? null)
    ) {
      changedArtifacts.push({
        serviceId: normalizeArtifactKey(artifact),
        serviceName: getArtifactName(artifact),
        change: 'updated',
        previousImageUrl: getArtifactUri(previousArtifact),
        currentImageUrl: getArtifactUri(artifact),
      });
    }
  }

  for (const artifact of previous.artifacts) {
    if (currentArtifacts.has(normalizeArtifactKey(artifact))) {
      continue;
    }

    changedArtifacts.push({
      serviceId: normalizeArtifactKey(artifact),
      serviceName: getArtifactName(artifact),
      change: 'removed',
      previousImageUrl: getArtifactUri(artifact),
      currentImageUrl: null,
    });
  }

  const previousMigrations = new Map(
    previous.migrationRuns
      .map((run) => [normalizeMigrationKey(run), run] as const)
      .filter((entry): entry is [string, ReleaseMigrationLike] => !!entry[0])
  );
  const currentMigrations = new Map(
    current.migrationRuns
      .map((run) => [normalizeMigrationKey(run), run] as const)
      .filter((entry): entry is [string, ReleaseMigrationLike] => !!entry[0])
  );

  const changedMigrations: ReleaseMigrationDiffItem[] = [];

  for (const [key, run] of currentMigrations) {
    if (previousMigrations.has(key)) {
      continue;
    }

    changedMigrations.push({
      key,
      label: buildMigrationLabel(run),
      change: 'added',
      tool: run.specification?.tool ?? 'custom',
      phase: run.specification?.phase ?? 'manual',
    });
  }

  for (const [key, run] of previousMigrations) {
    if (currentMigrations.has(key)) {
      continue;
    }

    changedMigrations.push({
      key,
      label: buildMigrationLabel(run),
      change: 'removed',
      tool: run.specification?.tool ?? 'custom',
      phase: run.specification?.phase ?? 'manual',
    });
  }

  return {
    isFirstRelease: false,
    changedArtifacts,
    changedMigrations,
  };
}
