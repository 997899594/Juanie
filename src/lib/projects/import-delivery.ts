import type { DatabaseConfig, ServiceConfig } from '@/lib/config/parser';
import { resolveDatabaseProvisionType } from '@/lib/databases/platform-support';
import type { DeliveryGraph } from '@/lib/delivery-graph/model';
import type { RepositoryTopologyService } from '@/lib/monorepo';

export function toImportServiceConfig(
  detected: RepositoryTopologyService,
  requested: ServiceConfig | undefined
): ServiceConfig {
  return {
    name: detected.name,
    type: detected.type,
    ...(detected.appDir !== '.' || detected.packageName
      ? {
          monorepo: {
            ...(detected.appDir !== '.' ? { appDir: detected.appDir } : {}),
            ...(detected.packageName ? { packageName: detected.packageName } : {}),
          },
        }
      : {}),
    ...(detected.runtime ? { runtime: detected.runtime } : {}),
    ...(detected.build ? { build: detected.build } : {}),
    run: detected.run,
    ...(detected.healthcheck ? { healthcheck: detected.healthcheck } : {}),
    ...((requested?.scaling ?? detected.scaling)
      ? { scaling: requested?.scaling ?? detected.scaling }
      : {}),
    ...(requested?.resources ? { resources: requested.resources } : {}),
    ...(detected.type === 'cron' && detected.schedule ? { schedule: detected.schedule } : {}),
    isPublic: requested?.isPublic ?? detected.isPublic ?? detected.type === 'web',
  };
}

export function mergeDetectedDatabases(
  requested: DatabaseConfig[],
  graph: DeliveryGraph
): DatabaseConfig[] {
  const databases = [...requested];
  const hasRedis = databases.some((database) => database.type === 'redis');
  const redisResource = graph.resources.find(
    (resource) => resource.management === 'managed' && resource.engine === 'redis'
  );

  if (!hasRedis && redisResource) {
    const consumerPath = redisResource.consumers[0]?.replace(/^workload:/u, '') ?? '';
    const service = consumerPath.split('/').filter(Boolean).at(-1);
    databases.push({
      name: 'redis',
      type: 'redis',
      scope: service ? 'service' : 'project',
      ...(service ? { service } : {}),
      role: 'queue',
      plan: 'starter',
      provisionType: resolveDatabaseProvisionType('redis'),
      capabilities: [],
    });
  }

  return databases;
}
