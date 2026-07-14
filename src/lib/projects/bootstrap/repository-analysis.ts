import {
  type DatabaseCapability,
  normalizeDatabaseCapabilities,
} from '@/lib/databases/capabilities';
import { supportsDatabaseAutomatedMigrations } from '@/lib/databases/platform-support';
import { databases, projects, services } from '@/lib/db/schema';
import { isPlatformManagedMigrationTool } from '@/lib/migrations/platform-managed';
import {
  getDefaultSchemaConfigPath,
  getSchemaConfigCandidates,
  resolveExecutionToolForSchemaSource,
} from '@/lib/migrations/schema-source';
import type { MonorepoType } from '@/lib/monorepo';

export function parseCommandString(command: string): string[] {
  const args: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escapeNext = false;

  for (const char of command) {
    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current || args.length > 0) {
        args.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current || args.length > 0) {
    args.push(current);
  }

  return args;
}

// ============================================
// CI/CD Config Functions
// ============================================

export interface ProjectInitRenderContext {
  services: Array<typeof services.$inferSelect>;
  databases: Array<typeof databases.$inferSelect>;
}

export type PackageManager = 'bun' | 'pnpm' | 'yarn' | 'npm';

export interface RepoAutomationContext {
  monorepoType: MonorepoType;
  rootFiles: string[];
  packageManager: PackageManager;
  bakeDefinition: string | null;
  bakeTargets: string[];
  atlasConfigPath: string | null;
  atlasConfigContent: string | null;
  atlasSchemaContents: Record<string, string>;
  migrationScriptContents: Record<string, string>;
  packageJson: {
    packageManager?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } | null;
}

export type RepoAutomationContextLike = Pick<
  RepoAutomationContext,
  'monorepoType' | 'rootFiles' | 'packageManager' | 'bakeDefinition' | 'bakeTargets' | 'packageJson'
> &
  Partial<
    Pick<
      RepoAutomationContext,
      'atlasConfigPath' | 'atlasConfigContent' | 'atlasSchemaContents' | 'migrationScriptContents'
    >
  >;

export type ProjectConfigServiceEntry = {
  monorepo?: {
    appDir?: string;
    packageName?: string;
  };
  runtime?: {
    language?: 'node' | 'bun' | 'static' | 'custom';
    framework?: string;
    nodeVersion?: string;
  };
  build?: {
    strategy?: 'auto' | 'dockerfile' | 'bake' | 'buildpacks';
    command?: string;
    dockerfile?: string;
    context?: string;
    target?: string;
    definition?: string;
    package?: {
      strategy: 'pnpm-deploy' | 'pnpm-pack' | 'npm-pack' | 'copy' | 'custom';
    };
  };
};

export type ProjectConfigMonorepoEntry = {
  enabled?: boolean;
  type?: MonorepoType;
  packageManager?: PackageManager;
  affected?: MonorepoAffectedRules;
};

export type ProjectConfigDeliverableEntry = {
  name: string;
  type: 'package' | 'baremetal' | 'archive';
  monorepo?: {
    appDir?: string;
  };
  source?: {
    service: string;
  };
  variants: Array<{
    name: string;
    platform?: string;
    extract: {
      from: string;
      to?: string;
    };
    package: {
      format: 'tgz' | 'zip' | 'tar.gz' | 'directory';
      platform?: string;
      platforms?: string[];
    };
    checks?: Array<{
      command: string;
    }>;
  }>;
};

export interface MonorepoAffectedRules {
  strategy?: 'turbo' | 'all' | 'manual';
  task?: string;
  useTaskInputs?: boolean;
  global?: string[];
  inputs?: string[];
}

export type MonorepoCiAffectedRules = Required<MonorepoAffectedRules> & {
  packageManager?: PackageManager;
};

export function supportsGeneratedMigration(dbType: typeof databases.$inferSelect.type): boolean {
  return supportsDatabaseAutomatedMigrations(dbType);
}

export function getProjectConfigJson(
  project: Pick<typeof projects.$inferSelect, 'configJson'>
): Record<string, unknown> {
  return project.configJson && typeof project.configJson === 'object'
    ? (project.configJson as Record<string, unknown>)
    : {};
}

export function getProjectServiceConfigMap(
  project: Pick<typeof projects.$inferSelect, 'configJson'>
): Record<string, ProjectConfigServiceEntry> {
  const config = getProjectConfigJson(project);
  const servicesConfig = config.services;

  return servicesConfig && typeof servicesConfig === 'object'
    ? (servicesConfig as Record<string, ProjectConfigServiceEntry>)
    : {};
}

export function getProjectMonorepoConfig(
  project: Pick<typeof projects.$inferSelect, 'configJson'>
): ProjectConfigMonorepoEntry | null {
  const config = getProjectConfigJson(project);
  const monorepo = config.monorepo;

  return monorepo && typeof monorepo === 'object' ? (monorepo as ProjectConfigMonorepoEntry) : null;
}

export function getProjectDeliverablesConfig(
  project: Pick<typeof projects.$inferSelect, 'configJson'>
): ProjectConfigDeliverableEntry[] {
  const config = getProjectConfigJson(project);
  return Array.isArray(config.deliverables)
    ? (config.deliverables as ProjectConfigDeliverableEntry[])
    : [];
}

export function getProjectServiceAppDir(
  project: Pick<typeof projects.$inferSelect, 'configJson'>,
  serviceName: string
): string | null {
  return getProjectServiceConfigMap(project)[serviceName]?.monorepo?.appDir ?? null;
}

export function detectPackageManager(
  rootFiles: string[],
  packageJson: RepoAutomationContext['packageJson']
): PackageManager {
  const packageManager = packageJson?.packageManager;

  if (typeof packageManager === 'string') {
    if (packageManager.startsWith('bun@')) return 'bun';
    if (packageManager.startsWith('pnpm@')) return 'pnpm';
    if (packageManager.startsWith('yarn@')) return 'yarn';
    if (packageManager.startsWith('npm@')) return 'npm';
  }

  if (rootFiles.includes('bun.lockb') || rootFiles.includes('bun.lock')) return 'bun';
  if (rootFiles.includes('pnpm-lock.yaml')) return 'pnpm';
  if (rootFiles.includes('yarn.lock')) return 'yarn';
  return 'npm';
}

export function buildRunScriptCommand(packageManager: PackageManager, script: string): string {
  if (packageManager === 'yarn') {
    return `yarn ${script}`;
  }

  return `${packageManager} run ${script}`;
}

export function resolvePackageScriptCommand(
  packageJson: RepoAutomationContext['packageJson'],
  packageManager: PackageManager,
  script: string
): string {
  const declared = packageJson?.scripts?.[script]?.trim();
  if (declared) {
    return declared;
  }

  return buildRunScriptCommand(packageManager, script);
}

const managedMigrationScriptNames = ['db:push', 'db:migrate', 'db:deploy'] as const;

export function detectMigrationToolFromText(
  text: string
): 'atlas' | 'drizzle' | 'prisma' | 'knex' | 'typeorm' | null {
  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  if (/\batlas\b/i.test(normalized)) return 'atlas';
  if (/\bprisma\b/i.test(normalized)) return 'prisma';
  if (/\bdrizzle-kit\b|\bdrizzle-orm\b/i.test(normalized)) return 'drizzle';
  if (/\bknex\b/i.test(normalized)) return 'knex';
  if (/\btypeorm\b/i.test(normalized)) return 'typeorm';
  return null;
}

export function resolveMigrationScriptFilePaths(command: string): string[] {
  const args = parseCommandString(command);
  const paths = new Set<string>();

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]?.trim();
    if (!value || value.startsWith('-')) {
      continue;
    }

    const next = args[index + 1]?.trim();
    if (
      ['node', 'bun', 'tsx', 'ts-node', 'bash', 'sh'].includes(value) &&
      next &&
      !next.startsWith('-')
    ) {
      paths.add(next.replace(/^\.\//u, ''));
      continue;
    }

    if (
      value.startsWith('./scripts/') ||
      value.startsWith('scripts/') ||
      /\.(?:mjs|cjs|js|ts|tsx|sh)$/u.test(value)
    ) {
      paths.add(value.replace(/^\.\//u, ''));
    }
  }

  return [...paths];
}

export function resolveManagedMigrationScriptPaths(
  packageJson: RepoAutomationContext['packageJson']
): string[] {
  const scripts = packageJson?.scripts ?? {};
  const paths = new Set<string>();

  for (const scriptName of managedMigrationScriptNames) {
    const command = scripts[scriptName]?.trim();
    if (!command) {
      continue;
    }

    for (const scriptPath of resolveMigrationScriptFilePaths(command)) {
      paths.add(scriptPath);
    }
  }

  return [...paths];
}

export function detectMigrationTool(
  automation: Pick<RepoAutomationContextLike, 'packageJson' | 'rootFiles'> &
    Partial<Pick<RepoAutomationContextLike, 'atlasConfigContent' | 'migrationScriptContents'>>
) {
  const scripts = automation.packageJson?.scripts ?? {};

  for (const scriptName of managedMigrationScriptNames) {
    const detected = detectMigrationToolFromText(scripts[scriptName]?.trim() ?? '');
    if (detected) {
      return detected;
    }
  }

  for (const content of Object.values(automation.migrationScriptContents ?? {})) {
    const detected = detectMigrationToolFromText(content);
    if (detected) {
      return detected;
    }
  }

  const dependencies = {
    ...(automation.packageJson?.dependencies ?? {}),
    ...(automation.packageJson?.devDependencies ?? {}),
  };

  if (dependencies.prisma || dependencies['@prisma/client']) return 'prisma';
  if (dependencies['drizzle-kit'] || dependencies['drizzle-orm']) return 'drizzle';
  if (dependencies.knex) return 'knex';
  if (dependencies.typeorm) return 'typeorm';
  if (automation.atlasConfigContent || automation.rootFiles.includes('atlas.hcl')) return 'atlas';
  return 'custom';
}

export function inferSchemaConfigPath(
  automation: RepoAutomationContextLike,
  source: ReturnType<typeof detectMigrationTool>
): string | null {
  if (source === 'atlas') {
    return automation.atlasConfigPath ?? 'atlas.hcl';
  }

  if (source === 'drizzle') {
    const candidates = getSchemaConfigCandidates(source);
    return candidates.find((candidate) => automation.rootFiles.includes(candidate)) ?? null;
  }

  return getDefaultSchemaConfigPath(source);
}

export function extractAtlasSchemaSourcePaths(content: string): string[] {
  const paths = new Set<string>();
  const regex = /src\s*=\s*["']file:\/\/([^"']+)["']/g;
  let match: RegExpExecArray | null = regex.exec(content);

  while (match !== null) {
    const rawPath = match[1]?.trim();
    if (rawPath) {
      paths.add(rawPath.replace(/^\.\//u, ''));
    }
    match = regex.exec(content);
  }

  return [...paths];
}

export function inferDatabaseCapabilities(
  automation: RepoAutomationContextLike,
  database: Pick<typeof databases.$inferSelect, 'type' | 'capabilities'>
): DatabaseCapability[] {
  const declared = normalizeDatabaseCapabilities(database.capabilities ?? []);

  if (database.type !== 'postgresql') {
    return declared;
  }

  const inspectionText = [
    automation.atlasConfigContent ?? '',
    ...Object.values(automation.atlasSchemaContents ?? {}),
    ...Object.values(automation.migrationScriptContents ?? {}),
  ]
    .filter(Boolean)
    .join('\n');

  if (!inspectionText.trim()) {
    return declared;
  }

  const inferred: DatabaseCapability[] = [...declared];
  const detectors: Array<{
    capability: DatabaseCapability;
    patterns: RegExp[];
  }> = [
    {
      capability: 'vector',
      patterns: [
        /\bensurePgvector\b/i,
        /\bpgvector\b/i,
        /create\s+extension\s+if\s+not\s+exists\s+["']?vector["']?/i,
        /\bvector\s*\(/i,
        /::vector\b/i,
      ],
    },
    {
      capability: 'pg_trgm',
      patterns: [
        /create\s+extension\s+if\s+not\s+exists\s+["']?pg_trgm["']?/i,
        /\bgin_trgm_ops\b/i,
        /\bsimilarity\s*\(/i,
      ],
    },
  ];

  for (const detector of detectors) {
    if (
      !inferred.includes(detector.capability) &&
      detector.patterns.some((pattern) => pattern.test(inspectionText))
    ) {
      inferred.push(detector.capability);
    }
  }

  return normalizeDatabaseCapabilities(inferred);
}

export function inferSchemaConfig(
  automation: RepoAutomationContextLike,
  databaseType: typeof databases.$inferSelect.type
): {
  comment: string;
  source: 'atlas' | 'drizzle' | 'prisma' | 'knex' | 'typeorm' | 'custom';
  config?: string;
  executionMode: 'automatic' | 'external';
  approvalPolicy?: 'manual_in_production';
} | null {
  if (!supportsGeneratedMigration(databaseType) || automation.monorepoType !== 'none') {
    return null;
  }

  const scripts = automation.packageJson?.scripts ?? {};
  const source = detectMigrationTool(automation);
  const configPath = inferSchemaConfigPath(automation, source);
  const executionTool = resolveExecutionToolForSchemaSource(source, databaseType);
  const canPlatformManage = isPlatformManagedMigrationTool(executionTool, databaseType);
  const hasAtlasConfig =
    source === 'atlas' && Boolean(automation.atlasConfigPath || automation.atlasConfigContent);
  const inferredScriptName = managedMigrationScriptNames.find((scriptName) =>
    Boolean(scripts[scriptName]?.trim())
  );

  if (hasAtlasConfig) {
    return {
      comment: canPlatformManage
        ? 'Auto-detected from atlas.hcl'
        : 'Auto-detected from atlas.hcl; platform keeps this schema source in external mode',
      source,
      ...(configPath ? { config: configPath } : {}),
      executionMode: canPlatformManage ? 'automatic' : 'external',
      ...(canPlatformManage ? { approvalPolicy: 'manual_in_production' as const } : {}),
    };
  }

  if (inferredScriptName) {
    return {
      comment: canPlatformManage
        ? `Auto-generated from package.json script ${inferredScriptName}`
        : `Auto-detected from package.json script ${inferredScriptName}; platform keeps this schema source in external mode`,
      source,
      ...(configPath ? { config: configPath } : {}),
      executionMode: canPlatformManage ? 'automatic' : 'external',
      ...(canPlatformManage ? { approvalPolicy: 'manual_in_production' as const } : {}),
    };
  }

  return null;
}
