import { changedPathsBetween, type PlatformImageTarget } from './plan-platform-images';

export interface PlatformReleasePlan {
  platformRequired: boolean;
  operatorRequired: boolean;
  changedPaths: string[];
  reasons: string[];
}

export const restateOperatorLockPath = 'deploy/k8s/restate-operator.lock.json';

const platformDeploymentPrefixes = ['deploy/k8s/charts/juanie/', 'deploy/k8s/scripts/'] as const;
const platformDeploymentFiles = new Set([
  '.github/workflows/application-delivery.yml',
  '.github/workflows/ci.yml',
  'scripts/plan-platform-images.ts',
  'scripts/plan-platform-release.ts',
]);

function normalizePaths(paths: string[]): string[] {
  return [...new Set(paths.map((path) => path.trim()).filter(Boolean))].sort();
}

export function planPlatformRelease(
  changedPaths: string[] | null,
  imageTargets: PlatformImageTarget[]
): PlatformReleasePlan {
  if (changedPaths === null) {
    return {
      platformRequired: true,
      operatorRequired: true,
      changedPaths: [],
      reasons: ['no successful production revision is available'],
    };
  }

  const normalizedPaths = normalizePaths(changedPaths);
  const platformPaths = normalizedPaths.filter(
    (path) =>
      platformDeploymentFiles.has(path) ||
      platformDeploymentPrefixes.some((prefix) => path.startsWith(prefix))
  );
  const operatorRequired = normalizedPaths.includes(restateOperatorLockPath);
  const platformRequired = imageTargets.length > 0 || platformPaths.length > 0;
  const reasons: string[] = [];

  if (imageTargets.length > 0) {
    reasons.push(`component images changed: ${imageTargets.join(', ')}`);
  }
  if (platformPaths.length > 0) {
    reasons.push(`platform delivery inputs changed: ${platformPaths.join(', ')}`);
  }
  if (operatorRequired) {
    reasons.push('Restate Operator lock changed');
  }
  if (!platformRequired && !operatorRequired) {
    reasons.push('only non-deployable files changed');
  }

  return {
    platformRequired,
    operatorRequired,
    changedPaths: normalizedPaths,
    reasons,
  };
}

if (import.meta.main) {
  const [baseRevision, headRevision = 'HEAD', rawImageTargets = '[]'] = process.argv.slice(2);
  if (!baseRevision) {
    throw new Error(
      'Usage: bun scripts/plan-platform-release.ts <base-revision|none> [head-revision] [image-targets-json]'
    );
  }

  const imageTargets = JSON.parse(rawImageTargets) as PlatformImageTarget[];
  const changedPaths =
    baseRevision === 'none' ? null : changedPathsBetween(baseRevision, headRevision);
  if (baseRevision !== 'none' && changedPaths === null) {
    throw new Error(`Cannot compare production revision ${baseRevision} with ${headRevision}`);
  }
  const plan = planPlatformRelease(changedPaths, imageTargets);

  process.stdout.write(`${JSON.stringify(plan)}\n`);
}
