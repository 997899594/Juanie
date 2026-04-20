import crypto from 'node:crypto';

const MAX_K8S_NAME_LENGTH = 63;

export function slugifyK8sNameSegment(value: string, fallback = 'x'): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^refs\/heads\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return normalized || fallback;
}

export function truncateK8sName(value: string, maxLength = MAX_K8S_NAME_LENGTH): string {
  if (value.length <= maxLength) {
    return value;
  }

  const hash = crypto.createHash('sha1').update(value).digest('hex').slice(0, 8);
  const headLength = Math.max(1, maxLength - hash.length - 1);
  const head = value.slice(0, headLength).replace(/-+$/g, '') || 'x';
  return `${head}-${hash}`;
}

export function buildK8sName(
  segments: Array<string | null | undefined>,
  options?: {
    fallback?: string;
    maxLength?: number;
  }
): string {
  const normalized = segments
    .map((segment) => (segment ? slugifyK8sNameSegment(segment, '') : ''))
    .filter(Boolean)
    .join('-');

  return truncateK8sName(
    normalized || slugifyK8sNameSegment(options?.fallback ?? 'resource'),
    options?.maxLength ?? MAX_K8S_NAME_LENGTH
  );
}

export function buildProjectNamespaceBase(projectSlug: string): string {
  return buildK8sName(['juanie', projectSlug], {
    fallback: 'juanie-project',
  });
}

export function buildProjectScopedK8sName(
  projectSlug: string,
  ...segments: Array<string | null | undefined>
): string {
  return buildK8sName([projectSlug, ...segments], {
    fallback: 'app',
  });
}
