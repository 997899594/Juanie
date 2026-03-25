interface ReleaseArtifactLike {
  serviceId?: string;
  imageUrl: string;
  imageDigest?: string | null;
  service: {
    id?: string;
    name: string;
  };
}

interface ReleaseMigrationLike {
  databaseId?: string;
  serviceId?: string | null;
  specification?:
    | {
        tool?: string;
        phase?: string;
        command?: string;
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
  return artifact.serviceId ?? artifact.service.id ?? artifact.service.name;
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
    run.specification.command,
  ].join('::');
}

function buildMigrationLabel(run: ReleaseMigrationLike): string {
  const databaseName = run.database?.name ?? '数据库';
  const serviceName = run.service?.name ?? '项目';
  const tool = run.specification?.tool ?? 'custom';
  const phase = run.specification?.phase ?? 'manual';

  return `${databaseName} · ${serviceName} · ${tool} · ${phase}`;
}

export function buildReleaseDiff(
  current: ReleaseLike,
  previous: ReleaseLike | null
): ReleaseDiffSnapshot {
  if (!previous) {
    return {
      isFirstRelease: true,
      changedArtifacts: current.artifacts.map((artifact) => ({
        serviceId: artifact.serviceId ?? artifact.service.id ?? artifact.service.name,
        serviceName: artifact.service.name,
        change: 'added',
        previousImageUrl: null,
        currentImageUrl: artifact.imageUrl,
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
        serviceId: artifact.serviceId ?? artifact.service.id ?? artifact.service.name,
        serviceName: artifact.service.name,
        change: 'added',
        previousImageUrl: null,
        currentImageUrl: artifact.imageUrl,
      });
      continue;
    }

    if (
      previousArtifact.imageUrl !== artifact.imageUrl ||
      (previousArtifact.imageDigest ?? null) !== (artifact.imageDigest ?? null)
    ) {
      changedArtifacts.push({
        serviceId: artifact.serviceId ?? artifact.service.id ?? artifact.service.name,
        serviceName: artifact.service.name,
        change: 'updated',
        previousImageUrl: previousArtifact.imageUrl,
        currentImageUrl: artifact.imageUrl,
      });
    }
  }

  for (const artifact of previous.artifacts) {
    if (currentArtifacts.has(normalizeArtifactKey(artifact))) {
      continue;
    }

    changedArtifacts.push({
      serviceId: artifact.serviceId ?? artifact.service.id ?? artifact.service.name,
      serviceName: artifact.service.name,
      change: 'removed',
      previousImageUrl: artifact.imageUrl,
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
