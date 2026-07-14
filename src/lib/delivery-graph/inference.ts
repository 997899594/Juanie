import {
  type DeliveryGraph,
  type DeliveryGraphArtifact,
  type DeliveryGraphInferenceInput,
  type DeliveryGraphLibrary,
  type DeliveryGraphPackage,
  type DeliveryGraphResource,
  type DeliveryGraphRuntimeKind,
  type DeliveryGraphWorkload,
  type DeliveryGraphWorkloadType,
  type DeliveryGraphWorkspaceInput,
  deliveryGraphVersion,
} from '@/lib/delivery-graph/model';

const runtimeScriptNames = [
  'start:prod',
  'start',
  'serve',
  'worker',
  'queue',
  'consumer',
  'processor',
  'cron',
  'scheduler',
  'schedule',
  'job',
] as const;
const secretKeyPattern = /(PASSWORD|SECRET|TOKEN|PRIVATE|ACCESS_KEY|API_KEY|CREDENTIAL)/iu;

function workspaceName(workspace: DeliveryGraphWorkspaceInput): string {
  const segments = workspace.path.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? workspace.path;
}

function allDependencies(packageJson: DeliveryGraphPackage): Record<string, string> {
  return { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
}

function findScript(
  packageJson: DeliveryGraphPackage,
  candidates: readonly string[]
): { name: string; command: string } | null {
  const scripts = packageJson.scripts ?? {};
  for (const candidate of candidates) {
    const command = scripts[candidate]?.trim();
    if (command) return { name: candidate, command };
  }
  return null;
}

function hasRuntimeScript(packageJson: DeliveryGraphPackage): boolean {
  return runtimeScriptNames.some((name) => Boolean(packageJson.scripts?.[name]?.trim()));
}

function isDocumentationWorkspace(workspace: DeliveryGraphWorkspaceInput): boolean {
  const dependencies = allDependencies(workspace.packageJson);
  const name = `${workspaceName(workspace)} ${workspace.packageJson.name ?? ''}`.toLowerCase();
  const scripts = Object.keys(workspace.packageJson.scripts ?? {})
    .join(' ')
    .toLowerCase();
  return (
    /(^|[\s/@-])docs?($|[\s/@-])/u.test(name) &&
    (Boolean(dependencies.vocs) || /docs|typedoc|demos/u.test(scripts))
  );
}

function hasArtifactBuild(packageJson: DeliveryGraphPackage): boolean {
  return Object.entries(packageJson.scripts ?? {}).some(
    ([name, command]) =>
      Boolean(command.trim()) &&
      (name === 'build' ||
        name.startsWith('build:') ||
        name.startsWith('pack') ||
        name.startsWith('bundle') ||
        name.startsWith('docs:'))
  );
}

function inferArtifactKind(workspace: DeliveryGraphWorkspaceInput): DeliveryGraphArtifact['kind'] {
  if (isDocumentationWorkspace(workspace)) return 'documentation';
  const scripts = Object.keys(workspace.packageJson.scripts ?? {});
  if (scripts.some((name) => name.startsWith('pack'))) return 'package';
  return 'bundle';
}

function inferArtifactBuildCommand(
  workspace: DeliveryGraphWorkspaceInput,
  packageManager: DeliveryGraphInferenceInput['packageManager']
): string {
  const packageName = workspace.packageJson.name ?? workspaceName(workspace);
  const preferred = isDocumentationWorkspace(workspace)
    ? findScript(workspace.packageJson, ['build', 'docs:build', 'demos:build'])
    : findScript(workspace.packageJson, ['pack-zip', 'pack', 'build']);

  if (preferred) {
    return packageManager === 'bun'
      ? `bunx turbo run ${preferred.name} --filter=${packageName}`
      : `${packageManager} exec turbo run ${preferred.name} --filter=${packageName}`;
  }
  return packageManager === 'yarn'
    ? `yarn workspace ${packageName} build`
    : `${packageManager} run --filter ${packageName} build`;
}

function inferArtifactOutputPath(workspace: DeliveryGraphWorkspaceInput): string {
  const dependencies = allDependencies(workspace.packageJson);
  if (dependencies.vocs) return `${workspace.path}/.vocs/dist`;
  return `${workspace.path}/dist`;
}

function inferWorkloadType(packageJson: DeliveryGraphPackage): DeliveryGraphWorkloadType {
  const scripts = packageJson.scripts ?? {};
  if (['cron', 'scheduler', 'schedule', 'job'].some((name) => Boolean(scripts[name]?.trim()))) {
    return 'cron';
  }
  if (['worker', 'queue', 'consumer', 'processor'].some((name) => Boolean(scripts[name]?.trim()))) {
    return 'worker';
  }
  return 'web';
}

function inferRuntimeCapabilities(
  packageJson: DeliveryGraphPackage
): Array<'http' | 'worker' | 'scheduler'> {
  const dependencies = allDependencies(packageJson);
  const scripts = packageJson.scripts ?? {};
  const capabilities: Array<'http' | 'worker' | 'scheduler'> = [];

  if (
    scripts.start?.trim() ||
    scripts['start:prod']?.trim() ||
    scripts.serve?.trim() ||
    ['@nestjs/core', 'express', 'fastify', 'hono', 'next'].some((name) =>
      Boolean(dependencies[name])
    )
  ) {
    capabilities.push('http');
  }
  if (
    ['worker', 'queue', 'consumer', 'processor'].some((name) => Boolean(scripts[name]?.trim())) ||
    dependencies.bullmq ||
    dependencies['@nestjs/bullmq']
  ) {
    capabilities.push('worker');
  }
  if (
    ['cron', 'scheduler', 'schedule', 'job'].some((name) => Boolean(scripts[name]?.trim())) ||
    dependencies['@nestjs/schedule']
  ) {
    capabilities.push('scheduler');
  }
  return capabilities;
}

function inferRuntimeKind(workspace: DeliveryGraphWorkspaceInput): DeliveryGraphRuntimeKind {
  return hasRuntimeScript(workspace.packageJson) || workspace.hasDockerfile ? 'server' : 'static';
}

function inferPort(command: string): number | undefined {
  const match =
    command.match(/(?:--port|-p)\s+(\d{2,5})/u) ??
    command.match(/PORT=(\d{2,5})/u) ??
    command.match(/:(\d{2,5})/u);
  if (!match) return undefined;
  const port = Number.parseInt(match[1] ?? '', 10);
  return Number.isSafeInteger(port) ? port : undefined;
}

function toWorkload(
  workspace: DeliveryGraphWorkspaceInput,
  packageManager: DeliveryGraphInferenceInput['packageManager']
): DeliveryGraphWorkload {
  const name = workspaceName(workspace);
  const type = inferWorkloadType(workspace.packageJson);
  const runtimeKind = inferRuntimeKind(workspace);
  const runtimeScript = findScript(
    workspace.packageJson,
    type === 'cron'
      ? ['cron', 'scheduler', 'schedule', 'job', 'start:prod', 'start']
      : type === 'worker'
        ? ['worker', 'queue', 'consumer', 'processor', 'start:prod', 'start']
        : ['start:prod', 'start', 'serve']
  );
  const packageName = workspace.packageJson.name ?? name;
  const startCommand =
    runtimeKind === 'static'
      ? 'nginx -g "daemon off;"'
      : (runtimeScript?.command ??
        (packageManager === 'yarn'
          ? `yarn workspace ${packageName} start`
          : `${packageManager} run start`));

  return {
    id: `workload:${workspace.path}`,
    name,
    ...(workspace.packageJson.name ? { packageName: workspace.packageJson.name } : {}),
    appDir: workspace.path,
    type,
    runtimeKind,
    runtimeCapabilities: inferRuntimeCapabilities(workspace.packageJson),
    ...(workspace.packageJson.scripts?.build
      ? {
          buildCommand:
            packageManager === 'bun'
              ? `bunx turbo run build --filter=${packageName}`
              : `${packageManager} exec turbo run build --filter=${packageName}`,
        }
      : {}),
    startCommand,
    ...(type === 'web'
      ? { port: inferPort(startCommand) ?? (runtimeKind === 'static' ? 8080 : 3000) }
      : {}),
    ...(type === 'cron'
      ? {
          schedule:
            workspace.packageJson.juanie?.schedule ?? workspace.packageJson.config?.schedule,
        }
      : {}),
    hasDockerfile: workspace.hasDockerfile,
    confidence: 'high',
  };
}

function toArtifact(
  workspace: DeliveryGraphWorkspaceInput,
  packageManager: DeliveryGraphInferenceInput['packageManager']
): DeliveryGraphArtifact {
  const name = workspaceName(workspace);
  return {
    id: `artifact:${workspace.path}`,
    name,
    ...(workspace.packageJson.name ? { packageName: workspace.packageJson.name } : {}),
    appDir: workspace.path,
    kind: inferArtifactKind(workspace),
    buildCommand: inferArtifactBuildCommand(workspace, packageManager),
    outputPath: inferArtifactOutputPath(workspace),
  };
}

function toLibrary(workspace: DeliveryGraphWorkspaceInput): DeliveryGraphLibrary {
  const name = workspaceName(workspace);
  return {
    id: `library:${workspace.path}`,
    name,
    ...(workspace.packageJson.name ? { packageName: workspace.packageJson.name } : {}),
    appDir: workspace.path,
  };
}

function environmentKeysFor(workspace: DeliveryGraphWorkspaceInput, prefix: string): string[] {
  return (workspace.environmentKeys ?? []).filter((key) => key.startsWith(prefix));
}

function splitEnvironmentKeys(keys: string[]): { required: string[]; secrets: string[] } {
  return {
    required: keys.filter((key) => !secretKeyPattern.test(key)),
    secrets: keys.filter((key) => secretKeyPattern.test(key)),
  };
}

function inferWorkspaceResources(workspace: DeliveryGraphWorkspaceInput): DeliveryGraphResource[] {
  const dependencies = allDependencies(workspace.packageJson);
  const resources: DeliveryGraphResource[] = [];
  const consumer = `workload:${workspace.path}`;

  if (dependencies['typeorm-dm']) {
    const keys = splitEnvironmentKeys(environmentKeysFor(workspace, 'DB_'));
    resources.push({
      id: 'resource:database:dameng',
      name: 'Dameng',
      kind: 'database',
      management: 'external',
      engine: 'dameng',
      consumers: [consumer],
      requiredEnvironmentKeys: keys.required,
      secretEnvironmentKeys: keys.secrets,
      injection: 'runtime',
    });
  }

  if (dependencies.bullmq || dependencies.ioredis || dependencies['@nestjs/bullmq']) {
    const keys = splitEnvironmentKeys(environmentKeysFor(workspace, 'REDIS_'));
    resources.push({
      id: 'resource:queue:redis',
      name: 'Redis',
      kind: 'queue',
      management: 'managed',
      engine: 'redis',
      consumers: [consumer],
      requiredEnvironmentKeys: keys.required,
      secretEnvironmentKeys: keys.secrets,
      injection: 'runtime',
    });
  }

  if ((workspace.environmentKeys ?? []).includes('AUTH_SERVICE_URL')) {
    resources.push({
      id: 'resource:service:auth',
      name: 'Auth service',
      kind: 'service',
      management: 'external',
      consumers: [consumer],
      requiredEnvironmentKeys: ['AUTH_SERVICE_URL'],
      secretEnvironmentKeys: [],
      injection: 'runtime',
    });
  }
  return resources;
}

function mergeResources(resources: DeliveryGraphResource[]): DeliveryGraphResource[] {
  const merged = new Map<string, DeliveryGraphResource>();
  for (const resource of resources) {
    const current = merged.get(resource.id);
    if (!current) {
      merged.set(resource.id, resource);
      continue;
    }
    merged.set(resource.id, {
      ...current,
      consumers: [...new Set([...current.consumers, ...resource.consumers])],
      requiredEnvironmentKeys: [
        ...new Set([...current.requiredEnvironmentKeys, ...resource.requiredEnvironmentKeys]),
      ],
      secretEnvironmentKeys: [
        ...new Set([...current.secretEnvironmentKeys, ...resource.secretEnvironmentKeys]),
      ],
    });
  }
  return [...merged.values()];
}

function inferRootResources(input: DeliveryGraphInferenceInput): DeliveryGraphResource[] {
  const postinstall = input.rootPackageJson?.scripts?.postinstall ?? '';
  const ossKeys = (input.rootEnvironmentKeys ?? []).filter((key) => key.startsWith('OSS_'));
  if (!postinstall || ossKeys.length === 0) return [];
  const keys = splitEnvironmentKeys(ossKeys);
  return [
    {
      id: 'resource:artifact-source:oss',
      name: 'Build artifact source',
      kind: 'artifact_source',
      management: 'external',
      engine: 's3-compatible',
      consumers: ['repository'],
      requiredEnvironmentKeys: keys.required,
      secretEnvironmentKeys: keys.secrets,
      injection: 'build',
    },
  ];
}

export function inferDeliveryGraph(input: DeliveryGraphInferenceInput): DeliveryGraph {
  const workloads: DeliveryGraphWorkload[] = [];
  const artifacts: DeliveryGraphArtifact[] = [];
  const libraries: DeliveryGraphLibrary[] = [];

  for (const workspace of input.workspaces) {
    const runtime = hasRuntimeScript(workspace.packageJson) || workspace.hasDockerfile;
    const documentation = isDocumentationWorkspace(workspace);
    if ((workspace.zone === 'app' && !documentation) || runtime) {
      workloads.push(toWorkload(workspace, input.packageManager));
    } else if (documentation || hasArtifactBuild(workspace.packageJson)) {
      artifacts.push(toArtifact(workspace, input.packageManager));
    } else {
      libraries.push(toLibrary(workspace));
    }
  }

  const resources = mergeResources([
    ...input.workspaces.flatMap(inferWorkspaceResources),
    ...inferRootResources(input),
  ]);
  const warnings = workloads.flatMap((workload) =>
    workload.runtimeCapabilities.length > 1
      ? [
          {
            code: 'mixed_runtime' as const,
            nodeId: workload.id,
            message: `${workload.name} 同时包含 HTTP、队列或调度职责，平台会保持单一工作负载，拆分入口后可独立扩缩容`,
          },
        ]
      : []
  );

  return {
    version: deliveryGraphVersion,
    workloads,
    artifacts,
    libraries,
    resources,
    warnings,
  };
}
