import { describe, expect, it } from 'bun:test';
import type { DeliveryGraph } from '@/lib/delivery-graph/model';
import {
  buildDeliveryBuildTargets,
  buildDeliveryDeliverables,
  getDeliveryBuildSecretNames,
} from '@/lib/projects/bootstrap/delivery-build';

const graph: DeliveryGraph = {
  version: 1,
  workloads: [],
  artifacts: [
    {
      id: 'artifact:packages/sdk',
      name: 'sdk',
      packageName: '@acme/sdk',
      appDir: 'packages/sdk',
      kind: 'package',
      buildCommand: 'bunx turbo run build --filter=@acme/sdk',
      outputPath: 'packages/sdk/dist',
    },
  ],
  libraries: [],
  resources: [
    {
      id: 'resource:artifact-source:oss',
      name: 'Build artifact source',
      kind: 'artifact_source',
      management: 'external',
      consumers: ['repository'],
      requiredEnvironmentKeys: ['OSS_REGION'],
      secretEnvironmentKeys: ['OSS_ACCESS_KEY_SECRET'],
      injection: 'build',
    },
  ],
  warnings: [],
};

describe('delivery build projection', () => {
  it('projects artifacts into first-class targets and target-backed deliverables', () => {
    const secretNames = getDeliveryBuildSecretNames(graph);
    const targets = buildDeliveryBuildTargets({ graph, secretNames });
    const deliverables = buildDeliveryDeliverables(graph);

    expect(secretNames).toEqual(['OSS_ACCESS_KEY_SECRET', 'OSS_REGION']);
    expect(targets[0]?.build.strategy).toBe('managed');
    expect(targets[0]?.build.dockerfile).toBeUndefined();
    expect(targets[0]?.output.path).toBe('packages/sdk/dist');
    expect(deliverables[0]?.source.target).toBe('sdk');
    expect(deliverables[0]?.variants[0]?.extract.from).toBe('/juanie/output');
  });
});
