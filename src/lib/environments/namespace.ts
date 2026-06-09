import { type EnvironmentKindLike, getEnvironmentKind } from '@/lib/environments/model';
import { buildPreviewNamespace } from '@/lib/environments/preview';
import { buildK8sName, buildProjectNamespaceBase } from '@/lib/k8s/naming';

export interface EnvironmentNamespaceLike extends EnvironmentKindLike {
  name: string;
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

export function buildEnvironmentNamespace(
  projectSlug: string,
  environment: EnvironmentNamespaceLike
): string {
  const kind = getEnvironmentKind(environment);

  if (kind === 'preview') {
    return buildPreviewNamespace(projectSlug, environment.name);
  }

  if (kind === 'production') {
    return buildK8sName([buildProjectNamespaceBase(projectSlug), 'prod'], {
      fallback: 'juanie-prod',
    });
  }

  const environmentSlug = truncateSegment(slugifySegment(environment.name) || 'env', 40);
  return buildK8sName([buildProjectNamespaceBase(projectSlug), environmentSlug], {
    fallback: 'juanie-env',
  });
}
