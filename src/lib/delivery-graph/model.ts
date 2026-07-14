export const deliveryGraphVersion = 1 as const;

export type DeliveryGraphWorkspaceZone = 'app' | 'package';
export type DeliveryGraphWorkloadType = 'web' | 'worker' | 'cron';
export type DeliveryGraphRuntimeKind = 'server' | 'static';
export type DeliveryGraphResourceKind = 'database' | 'queue' | 'service' | 'artifact_source';

export interface DeliveryGraphPackage {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  juanie?: { schedule?: string };
  config?: { schedule?: string };
}

export interface DeliveryGraphWorkspaceInput {
  path: string;
  zone: DeliveryGraphWorkspaceZone;
  packageJson: DeliveryGraphPackage;
  hasDockerfile: boolean;
  environmentKeys?: string[];
}

export interface DeliveryGraphInferenceInput {
  packageManager: 'bun' | 'pnpm' | 'yarn' | 'npm';
  rootPackageJson: DeliveryGraphPackage | null;
  rootEnvironmentKeys?: string[];
  workspaces: DeliveryGraphWorkspaceInput[];
}

export interface DeliveryGraphWorkload {
  id: string;
  name: string;
  packageName?: string;
  appDir: string;
  type: DeliveryGraphWorkloadType;
  runtimeKind: DeliveryGraphRuntimeKind;
  runtimeCapabilities: Array<'http' | 'worker' | 'scheduler'>;
  buildCommand?: string;
  startCommand: string;
  port?: number;
  schedule?: string;
  hasDockerfile: boolean;
  confidence: 'declared' | 'high';
}

export interface DeliveryGraphArtifact {
  id: string;
  name: string;
  packageName?: string;
  appDir: string;
  kind: 'package' | 'documentation' | 'bundle';
  buildCommand?: string;
  outputPath: string;
}

export interface DeliveryGraphLibrary {
  id: string;
  name: string;
  packageName?: string;
  appDir: string;
}

export interface DeliveryGraphResource {
  id: string;
  name: string;
  kind: DeliveryGraphResourceKind;
  management: 'managed' | 'external';
  engine?: string;
  consumers: string[];
  requiredEnvironmentKeys: string[];
  secretEnvironmentKeys: string[];
  injection: 'runtime' | 'build';
}

export interface DeliveryGraphWarning {
  code: 'mixed_runtime' | 'missing_runtime' | 'external_resource';
  nodeId: string;
  message: string;
}

export interface DeliveryGraph {
  version: typeof deliveryGraphVersion;
  workloads: DeliveryGraphWorkload[];
  artifacts: DeliveryGraphArtifact[];
  libraries: DeliveryGraphLibrary[];
  resources: DeliveryGraphResource[];
  warnings: DeliveryGraphWarning[];
}

export interface DeliveryGraphSummary {
  workloadCount: number;
  artifactCount: number;
  libraryCount: number;
  managedResourceCount: number;
  externalResourceCount: number;
  requiresInput: boolean;
}

export function summarizeDeliveryGraph(graph: DeliveryGraph): DeliveryGraphSummary {
  const externalResourceCount = graph.resources.filter(
    (resource) => resource.management === 'external'
  ).length;

  return {
    workloadCount: graph.workloads.length,
    artifactCount: graph.artifacts.length,
    libraryCount: graph.libraries.length,
    managedResourceCount: graph.resources.length - externalResourceCount,
    externalResourceCount,
    requiresInput: graph.resources.some(
      (resource) =>
        resource.management === 'external' && resource.requiredEnvironmentKeys.length > 0
    ),
  };
}
