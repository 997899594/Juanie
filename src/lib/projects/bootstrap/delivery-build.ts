import type { DeliveryGraph } from '@/lib/delivery-graph/model';
import type {
  ProjectConfigBuildTargetEntry,
  ProjectConfigDeliverableEntry,
} from '@/lib/projects/bootstrap/repository-analysis';

export function getDeliveryBuildSecretNames(graph: DeliveryGraph | null): string[] {
  if (!graph) return [];
  return [
    ...new Set(
      graph.resources
        .filter((resource) => resource.injection === 'build')
        .flatMap((resource) => [
          ...resource.requiredEnvironmentKeys,
          ...resource.secretEnvironmentKeys,
        ])
    ),
  ].sort();
}

export function buildDeliveryBuildTargets(input: {
  graph: DeliveryGraph | null;
  secretNames: string[];
}): ProjectConfigBuildTargetEntry[] {
  return (input.graph?.artifacts ?? []).map((artifact) => ({
    name: artifact.name,
    kind: artifact.kind,
    monorepo: {
      appDir: artifact.appDir,
      ...(artifact.packageName ? { packageName: artifact.packageName } : {}),
    },
    build: {
      strategy: 'managed',
      command: artifact.buildCommand,
      context: '.',
      secrets: input.secretNames,
    },
    output: {
      path: artifact.outputPath,
    },
  }));
}

export function buildDeliveryDeliverables(
  graph: DeliveryGraph | null
): ProjectConfigDeliverableEntry[] {
  return (graph?.artifacts ?? []).map((artifact) => ({
    name: artifact.name,
    type: artifact.kind === 'package' ? 'package' : 'archive',
    monorepo: { appDir: artifact.appDir },
    source: { target: artifact.name },
    variants: [
      {
        name: 'default',
        platform: 'any',
        extract: { from: '/juanie/output', to: '.' },
        package: { format: 'tar.gz', platform: 'any' },
        checks: [
          {
            command: 'test -n "$(find "$JUANIE_ARTIFACT_STAGE" -mindepth 1 -print -quit)"',
          },
        ],
      },
    ],
  }));
}
