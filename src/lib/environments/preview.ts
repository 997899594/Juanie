interface PreviewEnvironmentLike {
  id: string;
  name: string;
  branch: string | null;
  isPreview: boolean | null;
  previewPrNumber: number | null;
  expiresAt?: Date | string | null;
}

export interface PreviewEnvironmentInput {
  branch?: string | null;
  prNumber?: number | null;
  ttlHours?: number | null;
}

const DEFAULT_PREVIEW_TTL_HOURS = 72;
const MAX_ENV_NAME_LENGTH = 48;
const MAX_NAMESPACE_LENGTH = 63;

function slugifySegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^refs\/heads\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function truncateSegment(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength).replace(/-+$/g, '');
}

export function extractPrNumberFromRef(ref: string): number | null {
  const match = ref.match(/^refs\/pull\/(\d+)\/(?:head|merge)$/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function extractBranchFromRef(ref: string): string | null {
  if (!ref.startsWith('refs/heads/')) {
    return null;
  }

  return ref.slice('refs/heads/'.length);
}

export function buildPreviewEnvironmentName(input: PreviewEnvironmentInput): string {
  if (input.prNumber) {
    return `preview-pr-${input.prNumber}`;
  }

  if (!input.branch) {
    throw new Error('Preview environments require branch or prNumber');
  }

  const branchSlug = truncateSegment(
    slugifySegment(input.branch) || 'branch',
    MAX_ENV_NAME_LENGTH - 'preview-'.length
  );
  return `preview-${branchSlug}`;
}

export function buildPreviewNamespace(projectSlug: string, environmentName: string): string {
  return truncateSegment(
    slugifySegment(`${projectSlug}-${environmentName}`) || 'preview',
    MAX_NAMESPACE_LENGTH
  );
}

export function calculatePreviewExpiry(
  ttlHours = DEFAULT_PREVIEW_TTL_HOURS,
  now = new Date()
): Date {
  const safeHours = Math.max(1, Math.min(ttlHours, 24 * 30));
  return new Date(now.getTime() + safeHours * 60 * 60 * 1000);
}

export function resolvePreviewEnvironment<T extends PreviewEnvironmentLike>(
  ref: string,
  environments: T[]
): T | undefined {
  const prNumber = extractPrNumberFromRef(ref);
  if (prNumber !== null) {
    return environments.find(
      (environment) => environment.isPreview && environment.previewPrNumber === prNumber
    );
  }

  const branch = extractBranchFromRef(ref);
  if (!branch) {
    return undefined;
  }

  return environments.find((environment) => environment.isPreview && environment.branch === branch);
}

export function isPreviewEnvironmentExpired(
  environment: Pick<PreviewEnvironmentLike, 'expiresAt'>
): boolean {
  if (!environment.expiresAt) {
    return false;
  }

  return new Date(environment.expiresAt).getTime() <= Date.now();
}
