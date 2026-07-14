import { describe, expect, it } from 'bun:test';
import type { DeliveryGraph } from '@/lib/delivery-graph/model';
import { mergeDetectedDatabases, toImportServiceConfig } from '@/lib/projects/import-delivery';

describe('project import delivery projection', () => {
  it('以仓库识别结果作为运行契约并只保留用户的资源调优', () => {
    const service = toImportServiceConfig(
      {
        name: 'web',
        type: 'web',
        appDir: 'apps/web',
        packageName: '@data-fuser/web',
        startCommand: 'nginx -g "daemon off;"',
        port: 8080,
        build: { command: 'turbo run build --filter=@data-fuser/web' },
        run: { command: 'nginx -g "daemon off;"', port: 8080 },
        runtime: { language: 'static', framework: 'static' },
        scaling: { min: 1 },
        isPublic: true,
      },
      {
        name: 'web',
        type: 'web',
        run: { command: 'untrusted client command', port: 9999 },
        scaling: { min: 2, max: 5, cpu: 70 },
        resources: { cpuRequest: '200m' },
        isPublic: false,
      }
    );

    expect(service.run).toEqual({ command: 'nginx -g "daemon off;"', port: 8080 });
    expect(service.monorepo).toEqual({ appDir: 'apps/web', packageName: '@data-fuser/web' });
    expect(service.runtime).toEqual({ language: 'static', framework: 'static' });
    expect(service.scaling).toEqual({ min: 2, max: 5, cpu: 70 });
    expect(service.resources).toEqual({ cpuRequest: '200m' });
    expect(service.isPublic).toBe(false);
  });

  it('自动把 managed Redis 资源投影成服务级队列数据库', () => {
    const graph: DeliveryGraph = {
      version: 1,
      workloads: [],
      artifacts: [],
      libraries: [],
      resources: [
        {
          id: 'resource:queue:redis',
          name: 'Redis',
          kind: 'queue',
          management: 'managed',
          engine: 'redis',
          consumers: ['workload:apps/server'],
          requiredEnvironmentKeys: ['REDIS_HOST', 'REDIS_PORT'],
          secretEnvironmentKeys: ['REDIS_PASSWORD'],
          injection: 'runtime',
        },
      ],
      warnings: [],
    };

    const databases = mergeDetectedDatabases([], graph);

    expect(databases.length).toBe(1);
    expect(databases[0]).toEqual({
      name: 'redis',
      type: 'redis',
      scope: 'service',
      service: 'server',
      role: 'queue',
      plan: 'starter',
      provisionType: 'shared',
      capabilities: [],
    });
  });
});
