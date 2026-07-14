import { describe, expect, it } from 'bun:test';
import type { DeliveryGraph } from '@/lib/delivery-graph/model';
import { findUnresolvedRuntimeResources } from '@/lib/delivery-graph/resources';

const graph: DeliveryGraph = {
  version: 1,
  workloads: [
    {
      id: 'workload:apps/server',
      name: 'server',
      appDir: 'apps/server',
      type: 'web',
      runtimeKind: 'server',
      runtimeCapabilities: ['http'],
      startCommand: 'bun run start',
      hasDockerfile: false,
      confidence: 'high',
    },
  ],
  artifacts: [],
  libraries: [],
  resources: [
    {
      id: 'resource:database:dameng',
      name: 'Dameng',
      kind: 'database',
      management: 'external',
      engine: 'dameng',
      consumers: ['workload:apps/server'],
      requiredEnvironmentKeys: ['DB_HOST'],
      secretEnvironmentKeys: ['DB_PASSWORD'],
      injection: 'runtime',
    },
  ],
  warnings: [],
};

describe('delivery graph resource admission', () => {
  it('requires every external runtime key for the consuming workload', () => {
    const unresolved = findUnresolvedRuntimeResources(graph, {
      projectKeys: new Set(['DB_HOST']),
      serviceKeysByName: new Map(),
    });
    expect(unresolved[0]?.missingKeys).toEqual(['DB_PASSWORD']);
  });

  it('accepts project and service-scoped bindings as one effective contract', () => {
    const unresolved = findUnresolvedRuntimeResources(graph, {
      projectKeys: new Set(['DB_HOST']),
      serviceKeysByName: new Map([['server', new Set(['DB_PASSWORD'])]]),
    });
    expect(unresolved).toEqual([]);
  });
});
