import { describe, expect, it } from 'bun:test';
import type { DeliveryGraph } from '@/lib/delivery-graph/model';
import {
  buildDeliveryBuildTargets,
  buildDeliveryDeliverables,
  getDeliveryBuildSecretNames,
  renderManagedRuntimeDockerfile,
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
    expect(targets[0]?.build.dockerfile).toBe('.juanie/build-targets/sdk.Dockerfile');
    expect(targets[0]?.output.path).toBe('packages/sdk/dist');
    expect(deliverables[0]?.source.target).toBe('sdk');
    expect(deliverables[0]?.variants[0]?.extract.from).toBe('/juanie/output');
  });

  it('renders required BuildKit mounts without persisting secret values', () => {
    const dockerfile = renderManagedRuntimeDockerfile({
      template: '{{INSTALL}}\nRUN {{BUILD_COMMAND}}\nCMD ["sh", "-c", {{START_COMMAND_JSON}}]\n',
      packageManager: 'bun',
      appDir: 'apps/web',
      buildCommand: 'bunx turbo run build --filter=@acme/web',
      startCommand: 'nginx -g "daemon off;"',
      port: 8080,
      secretNames: ['OSS_ACCESS_KEY_SECRET'],
    });

    expect(dockerfile).toContain('--mount=type=secret,id=OSS_ACCESS_KEY_SECRET,required=true');
    expect(dockerfile).toContain(
      'OSS_ACCESS_KEY_SECRET="$(cat /run/secrets/OSS_ACCESS_KEY_SECRET)"'
    );
    expect(dockerfile).not.toContain('secret-value');
  });
});
