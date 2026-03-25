import { evaluateReleasePolicy, type ReleasePolicySnapshot } from '@/lib/policies/delivery';
import { buildReleaseDiff } from '@/lib/releases/diff';
import {
  getReleaseIntelligenceSnapshot,
  type ReleaseIntelligenceSnapshot,
} from '@/lib/releases/intelligence';

interface ReleaseViewLike {
  id: string;
  environment: {
    id: string;
    isProduction?: boolean | null;
    isPreview?: boolean | null;
    expiresAt?: Date | string | null;
  };
  artifacts: Array<{
    service: {
      id: string;
      name: string;
    };
    imageUrl: string;
    imageDigest?: string | null;
  }>;
  migrationRuns: Array<{
    service?: {
      id: string;
      name: string;
    } | null;
    serviceId?: string | null;
    database?: {
      id: string;
      name: string;
    } | null;
    databaseId?: string;
    specification?: {
      tool?: string;
      phase?: string;
      command?: string;
      compatibility?: string | null;
      approvalPolicy?: string | null;
    } | null;
    status: string;
  }>;
  status: string;
  errorMessage?: string | null;
  deployments: Array<{
    status: string;
  }>;
}

export interface ReleaseDiffSummary {
  isFirstRelease: boolean;
  artifactChanges: number;
  migrationChanges: number;
}

export interface ReleaseListDecorations {
  intelligence: ReleaseIntelligenceSnapshot;
  policy: ReleasePolicySnapshot;
  diffSummary: ReleaseDiffSummary;
}

export function decorateReleaseList<T extends ReleaseViewLike>(
  releases: T[]
): Array<T & ReleaseListDecorations> {
  const previousReleaseById = new Map<string, T | null>();
  const previousReleaseByEnvironment = new Map<string, T>();

  for (let index = releases.length - 1; index >= 0; index -= 1) {
    const release = releases[index];
    previousReleaseById.set(
      release.id,
      previousReleaseByEnvironment.get(release.environment.id) ?? null
    );
    previousReleaseByEnvironment.set(release.environment.id, release);
  }

  return releases.map((release) => {
    const previousRelease = previousReleaseById.get(release.id) ?? null;
    const intelligence = getReleaseIntelligenceSnapshot(release);
    const policy = evaluateReleasePolicy(release);
    const diff = buildReleaseDiff(release, previousRelease);

    return {
      ...release,
      intelligence,
      policy,
      diffSummary: {
        isFirstRelease: diff.isFirstRelease,
        artifactChanges: diff.changedArtifacts.length,
        migrationChanges: diff.changedMigrations.length,
      },
    };
  });
}
