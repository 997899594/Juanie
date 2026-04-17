import { createHash } from 'node:crypto';

export interface DomainEnvironmentLike {
  name: string;
  isPreview?: boolean | null;
}

export interface DomainRecordLike {
  id: string;
  hostname: string;
  isCustom?: boolean | null;
  isVerified?: boolean | null;
}

export interface DomainServiceLike {
  id: string;
  name: string;
  type: string;
  isPublic?: boolean | null;
  port?: number | null;
}

const DEFAULT_PLATFORM_BASE_DOMAIN = 'juanie.art';
const MAX_DNS_LABEL_LENGTH = 63;

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function shortenDnsLabel(value: string): string {
  const normalized = slugify(value) || 'preview';
  if (normalized.length <= MAX_DNS_LABEL_LENGTH) {
    return normalized;
  }

  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 8);
  const prefix = normalized.slice(0, MAX_DNS_LABEL_LENGTH - hash.length - 1).replace(/-+$/g, '');

  return `${prefix}-${hash}`;
}

export function getPlatformBaseDomain(): string {
  return process.env.JUANIE_BASE_DOMAIN?.trim() || DEFAULT_PLATFORM_BASE_DOMAIN;
}

export function buildPlatformHostname(label: string): string {
  return `${shortenDnsLabel(label)}.${getPlatformBaseDomain()}`;
}

export function buildPrimaryEnvironmentHostname(projectSlug: string): string {
  return buildPlatformHostname(projectSlug);
}

export function buildPreviewEnvironmentHostname(
  projectSlug: string,
  environment: Pick<DomainEnvironmentLike, 'name'>
): string {
  return buildPlatformHostname(`${projectSlug}-${environment.name}`);
}

export function buildDomainRouteName(hostname: string): string {
  return shortenDnsLabel(`route-${hostname.replaceAll('.', '-')}`);
}

export function buildEnvironmentAccessUrl(hostname: string): string {
  return `https://${hostname}`;
}

export function pickPrimaryEnvironmentDomain<T extends DomainRecordLike>(domains: T[]): T | null {
  if (domains.length === 0) {
    return null;
  }

  return (
    domains.find((domain) => domain.isCustom && domain.isVerified) ??
    domains.find((domain) => domain.isVerified) ??
    domains.find((domain) => domain.isCustom) ??
    domains[0] ??
    null
  );
}

export function pickDefaultPublicService<T extends DomainServiceLike>(services: T[]): T | null {
  const publicWebServices = services.filter(
    (service) => service.type === 'web' && service.isPublic !== false
  );

  if (publicWebServices.length === 0) {
    return null;
  }

  return (
    publicWebServices.find((service) => service.name === 'web') ?? publicWebServices[0] ?? null
  );
}
