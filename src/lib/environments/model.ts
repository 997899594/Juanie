import type { EnvironmentKind } from '@/lib/db/schema';
import { buildPreviewNamespace } from '@/lib/environments/preview';

interface EnvironmentKindLike {
  kind?: EnvironmentKind | null;
  isPreview?: boolean | null;
  isProduction?: boolean | null;
}

interface EnvironmentNamespaceLike extends EnvironmentKindLike {
  name: string;
}

interface EnvironmentIdentityLike extends EnvironmentKindLike {
  name?: string | null;
}

function slugifySegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function truncateSegment(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength).replace(/-+$/g, '');
}

export function getEnvironmentKind(environment: EnvironmentKindLike): EnvironmentKind {
  if (environment.kind) {
    return environment.kind;
  }

  if (environment.isPreview) {
    return 'preview';
  }

  if (environment.isProduction) {
    return 'production';
  }

  return 'persistent';
}

export function isPreviewEnvironment(environment: EnvironmentKindLike): boolean {
  return getEnvironmentKind(environment) === 'preview';
}

export function isProductionEnvironment(environment: EnvironmentKindLike): boolean {
  return getEnvironmentKind(environment) === 'production';
}

export function isPersistentEnvironment(environment: EnvironmentKindLike): boolean {
  return getEnvironmentKind(environment) === 'persistent';
}

export function getEnvironmentSortRank(environment: EnvironmentKindLike): number {
  switch (getEnvironmentKind(environment)) {
    case 'persistent':
      return 0;
    case 'production':
      return 1;
    case 'preview':
      return 2;
    default:
      return 3;
  }
}

export function compareEnvironmentDisplayOrder(
  left: EnvironmentIdentityLike,
  right: EnvironmentIdentityLike
): number {
  const leftRank = getEnvironmentSortRank(left);
  const rightRank = getEnvironmentSortRank(right);

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return (left.name ?? '').localeCompare(right.name ?? '');
}

export function pickDefaultEnvironment<T extends EnvironmentIdentityLike>(
  environments: T[]
): T | null {
  const ordered = [...environments].sort(compareEnvironmentDisplayOrder);
  return ordered[0] ?? null;
}

export function pickProductionEnvironment<T extends EnvironmentKindLike>(
  environments: T[]
): T | null {
  return environments.find((environment) => isProductionEnvironment(environment)) ?? null;
}

export function buildEnvironmentNamespace(
  projectSlug: string,
  environment: EnvironmentNamespaceLike
): string {
  const kind = getEnvironmentKind(environment);

  if (kind === 'preview') {
    return buildPreviewNamespace(projectSlug, environment.name);
  }

  if (kind === 'production') {
    return `juanie-${projectSlug}-prod`;
  }

  const environmentSlug = truncateSegment(slugifySegment(environment.name) || 'env', 40);
  return truncateSegment(`juanie-${projectSlug}-${environmentSlug}`, 63);
}
