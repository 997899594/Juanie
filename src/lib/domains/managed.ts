import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { domains } from '@/lib/db/schema';
import { type EnvironmentKindLike, isProductionEnvironment } from '@/lib/environments/model';
import { buildPlatformHostname } from './defaults';

interface DomainRoutingConfigLike {
  managedHostnameBase?: unknown;
  vanitySlug?: unknown;
}

interface DomainConfigLike {
  routing?: DomainRoutingConfigLike;
}

export interface ManagedHostnameProjectLike {
  slug: string;
  configJson?: unknown;
}

export interface ManagedHostnameEnvironmentLike extends EnvironmentKindLike {
  name: string;
}

export interface HostnameAllocatorStore {
  exists(hostname: string): Promise<boolean>;
  lock(lockKey: string): Promise<void>;
}

export interface HostnameAllocatorExecutor {
  execute: typeof db.execute;
  select: typeof db.select;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readRoutingConfig(configJson: unknown): DomainRoutingConfigLike | null {
  const config = asRecord(configJson) as DomainConfigLike | null;
  const routing = asRecord(config?.routing);

  if (!routing) {
    return null;
  }

  return routing;
}

export function resolveProjectManagedHostnameBase(project: ManagedHostnameProjectLike): string {
  const routing = readRoutingConfig(project.configJson);
  const managedHostnameBase =
    typeof routing?.managedHostnameBase === 'string' ? routing.managedHostnameBase.trim() : '';
  const vanitySlug = typeof routing?.vanitySlug === 'string' ? routing.vanitySlug.trim() : '';

  return managedHostnameBase || vanitySlug || project.slug;
}

export function buildManagedEnvironmentHostname(
  managedHostnameBase: string,
  environment: ManagedHostnameEnvironmentLike
): string {
  if (isProductionEnvironment(environment)) {
    return buildPlatformHostname(managedHostnameBase);
  }

  return buildPlatformHostname(`${managedHostnameBase}-${environment.name}`);
}

function createDbHostnameAllocatorStore(
  executor: HostnameAllocatorExecutor
): HostnameAllocatorStore {
  return {
    async exists(hostname) {
      const existing = await executor
        .select({ id: domains.id })
        .from(domains)
        .where(eq(domains.hostname, hostname))
        .limit(1);

      return existing.length > 0;
    },
    async lock(lockKey) {
      await executor.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);
    },
  };
}

export async function allocateManagedHostnameBase(input: {
  preferredSlug: string;
  store: HostnameAllocatorStore;
  createSuffix?: () => string;
  maxAttempts?: number;
}): Promise<string> {
  const createSuffix = input.createSuffix ?? (() => nanoid(4).toLowerCase());
  const maxAttempts = input.maxAttempts ?? 24;
  const preferredHostname = buildPlatformHostname(input.preferredSlug);

  await input.store.lock(preferredHostname);

  if (!(await input.store.exists(preferredHostname))) {
    return input.preferredSlug;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = `${input.preferredSlug}-${createSuffix()}`;
    const candidateHostname = buildPlatformHostname(candidate);

    if (!(await input.store.exists(candidateHostname))) {
      return candidate;
    }
  }

  throw new Error('无法为项目分配可用的托管域名前缀');
}

export async function allocateManagedHostnameBaseWithDb(input: {
  executor: HostnameAllocatorExecutor;
  preferredSlug: string;
}): Promise<string> {
  return allocateManagedHostnameBase({
    preferredSlug: input.preferredSlug,
    store: createDbHostnameAllocatorStore(input.executor),
  });
}
