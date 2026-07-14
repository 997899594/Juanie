import type { DeliveryGraph } from '@/lib/delivery-graph/model';
import type {
  PackageManager,
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

export function getManagedBuildFileStem(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
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
      strategy: 'dockerfile',
      command: artifact.buildCommand,
      dockerfile: `.juanie/build-targets/${getManagedBuildFileStem(artifact.name)}.Dockerfile`,
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

function installCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case 'bun':
      return 'bun install --frozen-lockfile';
    case 'pnpm':
      return 'corepack enable && pnpm install --frozen-lockfile';
    case 'yarn':
      return 'corepack enable && yarn install --immutable';
    case 'npm':
      return 'npm ci';
  }
}

function buildBaseImage(packageManager: PackageManager): string {
  return packageManager === 'bun' ? 'oven/bun:1.3.11' : 'node:24-bookworm-slim';
}

function renderSecretInstall(packageManager: PackageManager, secretNames: string[]): string {
  const command = installCommand(packageManager);
  if (secretNames.length === 0) return `RUN ${command}`;

  const mounts = secretNames
    .map((name) => `--mount=type=secret,id=${name},required=true`)
    .join(' \\\n    ');
  const environment = secretNames
    .map((name) => `${name}="$(cat /run/secrets/${name})"`)
    .join(' \\\n    ');
  return `RUN ${mounts} \\\n    ${environment} \\\n    ${command}`;
}

function replaceTemplate(template: string, replacements: Record<string, string>): string {
  return Object.entries(replacements).reduce(
    (content, [name, value]) => content.replaceAll(`{{${name}}}`, value),
    template
  );
}

export function renderManagedRuntimeDockerfile(input: {
  template: string;
  packageManager: PackageManager;
  appDir: string;
  buildCommand: string;
  startCommand: string;
  port: number;
  outputPath?: string;
  secretNames: string[];
}): string {
  return replaceTemplate(input.template, {
    BUILD_IMAGE: buildBaseImage(input.packageManager),
    INSTALL: renderSecretInstall(input.packageManager, input.secretNames),
    BUILD_COMMAND: input.buildCommand,
    APP_DIR: input.appDir,
    START_COMMAND_JSON: JSON.stringify(input.startCommand),
    PORT: String(input.port),
    OUTPUT_PATH: input.outputPath ?? `${input.appDir}/dist`,
  });
}

export function renderManagedBuildTargetDockerfile(input: {
  template: string;
  packageManager: PackageManager;
  buildCommand: string;
  outputPath: string;
  secretNames: string[];
}): string {
  return replaceTemplate(input.template, {
    BUILD_IMAGE: buildBaseImage(input.packageManager),
    INSTALL: renderSecretInstall(input.packageManager, input.secretNames),
    BUILD_COMMAND: input.buildCommand,
    OUTPUT_PATH: input.outputPath,
  });
}
