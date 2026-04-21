import { and, eq, isNull } from 'drizzle-orm';
import type { DatabaseConfig, ParsedConfig } from '@/lib/config/parser';
import { parseJuanieConfig } from '@/lib/config/parser';
import { normalizeDatabaseCapabilities } from '@/lib/databases/capabilities';
import { inferDatabaseRuntime } from '@/lib/databases/model';
import {
  getDatabaseProvisionTypeLabel,
  getDatabaseTypeLabel,
  resolveDatabaseProvisionType,
  supportsDatabaseProvisionType,
  toPlatformDatabaseProvisionType,
} from '@/lib/databases/platform-support';
import { db } from '@/lib/db';
import { databases, projects, repositories, services } from '@/lib/db/schema';
import {
  gateway,
  getTeamIntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';
import { logger } from '@/lib/logger';

interface RuntimeContractSyncInput {
  projectId: string;
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
  strict?: boolean;
}

interface RuntimeDatabaseInfrastructureSnapshot {
  name: string;
  type: typeof databases.$inferSelect.type;
  provisionType: ReturnType<typeof resolveDatabaseProvisionType>;
  provisionTypeWasSupported: boolean;
}

interface RuntimeDatabaseInfrastructureChange {
  databaseName: string;
  message: string;
}

const runtimeContractLogger = logger.child({ component: 'runtime-contract' });

export class RuntimeDatabaseContractSyncBlockedError extends Error {
  constructor(readonly changes: RuntimeDatabaseInfrastructureChange[]) {
    super(changes.map((change) => change.message).join('；'));
    this.name = 'RuntimeDatabaseContractSyncBlockedError';
  }
}

function getRuntimeDatabaseInfrastructureSnapshot(
  databaseRecord: typeof databases.$inferSelect
): RuntimeDatabaseInfrastructureSnapshot {
  const storedProvisionType = toPlatformDatabaseProvisionType(databaseRecord.provisionType);
  const provisionType = resolveDatabaseProvisionType(databaseRecord.type, storedProvisionType);
  const provisionTypeWasSupported =
    storedProvisionType !== null &&
    supportsDatabaseProvisionType(databaseRecord.type, storedProvisionType);

  return {
    name: databaseRecord.name,
    type: databaseRecord.type,
    provisionType,
    provisionTypeWasSupported,
  };
}

export function getUnsafeRuntimeDatabaseInfrastructureChange(
  databaseRecord: Pick<typeof databases.$inferSelect, 'name' | 'type' | 'provisionType'>,
  config: Pick<DatabaseConfig, 'name' | 'type' | 'provisionType'>
): RuntimeDatabaseInfrastructureChange | null {
  const current = getRuntimeDatabaseInfrastructureSnapshot(
    databaseRecord as typeof databases.$inferSelect
  );
  const nextProvisionType = resolveDatabaseProvisionType(config.type, config.provisionType);

  if (config.type !== current.type) {
    return {
      databaseName: config.name,
      message: `数据库 "${config.name}" 的基础设施类型不能通过 juanie.yaml 直接从 ${getDatabaseTypeLabel(current.type)} 改成 ${getDatabaseTypeLabel(config.type)}，请走显式迁移流程`,
    };
  }

  if (current.provisionTypeWasSupported && nextProvisionType !== current.provisionType) {
    return {
      databaseName: config.name,
      message: `数据库 "${config.name}" 的供应方式不能通过 juanie.yaml 直接从 ${getDatabaseProvisionTypeLabel(current.provisionType)} 改成 ${getDatabaseProvisionTypeLabel(nextProvisionType)}，请走显式迁移流程`,
    };
  }

  return null;
}

async function loadProjectConfigFromRepo(input: RuntimeContractSyncInput): Promise<{
  parsed: ParsedConfig;
  currentServices: Awaited<ReturnType<typeof db.query.services.findMany>>;
  currentDatabases: Awaited<ReturnType<typeof db.query.databases.findMany>>;
}> {
  const [currentServices, currentDatabases] = await Promise.all([
    db.query.services.findMany({
      where: eq(services.projectId, input.projectId),
    }),
    db.query.databases.findMany({
      where: and(eq(databases.projectId, input.projectId), isNull(databases.sourceDatabaseId)),
    }),
  ]);

  if (currentServices.length === 0 && currentDatabases.length === 0) {
    throw new Error('No runtime contracts to sync');
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
    columns: {
      id: true,
      teamId: true,
      repositoryId: true,
    },
  });

  if (!project?.repositoryId) {
    throw new Error('Project has no repository');
  }

  const repository = await db.query.repositories.findFirst({
    where: eq(repositories.id, project.repositoryId),
  });

  if (!repository) {
    throw new Error('Repository not found');
  }

  let session: Awaited<ReturnType<typeof getTeamIntegrationSession>>;
  try {
    session = await getTeamIntegrationSession({
      teamId: project.teamId,
      requiredCapabilities: ['read_repo'],
    });
  } catch (error) {
    runtimeContractLogger.warn('Could not load integration session for runtime contract sync', {
      projectId: input.projectId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const configRef = input.sourceCommitSha || input.sourceRef || repository.defaultBranch || 'main';
  let configContent: string | null = null;

  for (const configPath of ['juanie.yaml', 'juanie.yml']) {
    try {
      const content = await gateway.getFileContent(
        session,
        repository.fullName,
        configPath,
        configRef
      );
      if (content) {
        configContent = content;
        break;
      }
    } catch (_error) {
      // Ignore missing config files and keep the last persisted contract.
    }
  }

  if (!configContent) {
    throw new Error('Config not found');
  }

  const parsed = parseJuanieConfig(configContent);
  if (!parsed.isValid) {
    throw new Error(`Invalid juanie.yaml: ${parsed.errors.join('; ')}`);
  }

  return {
    parsed,
    currentServices,
    currentDatabases,
  };
}

function buildDatabaseContractKey(input: {
  name: string;
  scope?: string | null;
  serviceName?: string | null;
}) {
  return `${input.scope ?? 'project'}:${input.serviceName ?? '-'}:${input.name}`;
}

export async function syncProjectServiceRuntimeContractsFromRepo(input: RuntimeContractSyncInput) {
  let loaded: Awaited<ReturnType<typeof loadProjectConfigFromRepo>> | null = null;

  try {
    loaded = await loadProjectConfigFromRepo(input);
  } catch (error) {
    if (input.strict) {
      throw error;
    }
    return db.query.services.findMany({
      where: eq(services.projectId, input.projectId),
    });
  }

  const { parsed, currentServices } = loaded;

  const configServices = new Map(parsed.services.map((service) => [service.name, service]));
  const byId = new Map(currentServices.map((service) => [service.id, service]));

  for (const serviceRecord of currentServices) {
    const serviceConfig = configServices.get(serviceRecord.name);
    if (!serviceConfig) {
      continue;
    }

    const scaling = serviceConfig.scaling ?? null;
    const resources = serviceConfig.resources ?? null;
    const [updated] = await db
      .update(services)
      .set({
        type: serviceConfig.type,
        buildCommand: serviceConfig.build?.command ?? serviceRecord.buildCommand,
        dockerfile: serviceConfig.build?.dockerfile ?? serviceRecord.dockerfile,
        dockerContext: serviceConfig.build?.context ?? serviceRecord.dockerContext,
        startCommand: serviceConfig.run.command,
        port: serviceConfig.run.port ?? serviceRecord.port,
        cronSchedule:
          serviceConfig.type === 'cron'
            ? (serviceConfig.schedule ?? serviceRecord.cronSchedule)
            : null,
        replicas: scaling?.min ?? serviceRecord.replicas ?? 1,
        healthcheckPath: serviceConfig.healthcheck?.path ?? null,
        healthcheckInterval: serviceConfig.healthcheck?.interval ?? 30,
        cpuRequest: resources?.cpuRequest ?? serviceRecord.cpuRequest,
        cpuLimit: resources?.cpuLimit ?? serviceRecord.cpuLimit,
        memoryRequest: resources?.memoryRequest ?? serviceRecord.memoryRequest,
        memoryLimit: resources?.memoryLimit ?? serviceRecord.memoryLimit,
        autoscaling:
          scaling && ((scaling.max ?? 0) > (scaling.min ?? 0) || Boolean(scaling.cpu))
            ? {
                min: scaling.min ?? 1,
                max: scaling.max ?? scaling.min ?? 1,
                cpu: scaling.cpu ?? 80,
              }
            : serviceRecord.autoscaling,
        isPublic: serviceConfig.isPublic ?? serviceRecord.isPublic,
        updatedAt: new Date(),
      })
      .where(eq(services.id, serviceRecord.id))
      .returning();

    byId.set(serviceRecord.id, updated);
  }

  return currentServices.map((service) => byId.get(service.id) ?? service);
}

export async function syncProjectDatabaseRuntimeContractsFromRepo(input: RuntimeContractSyncInput) {
  let loaded: Awaited<ReturnType<typeof loadProjectConfigFromRepo>> | null = null;

  try {
    loaded = await loadProjectConfigFromRepo(input);
  } catch (error) {
    if (input.strict) {
      throw error;
    }
    return db.query.databases.findMany({
      where: and(eq(databases.projectId, input.projectId), isNull(databases.sourceDatabaseId)),
    });
  }

  const { parsed, currentServices, currentDatabases } = loaded;
  const configDatabases = parsed.databases ?? [];
  if (configDatabases.length === 0 || currentDatabases.length === 0) {
    return currentDatabases;
  }

  const serviceById = new Map(currentServices.map((service) => [service.id, service]));
  const serviceByName = new Map(currentServices.map((service) => [service.name, service]));
  const configByKey = new Map<string, DatabaseConfig>();
  const configByName = new Map<string, DatabaseConfig[]>();

  for (const config of configDatabases) {
    const scope = config.scope ?? (config.service ? 'service' : 'project');
    const key = buildDatabaseContractKey({
      name: config.name,
      scope,
      serviceName: config.service ?? null,
    });
    configByKey.set(key, config);
    configByName.set(config.name, [...(configByName.get(config.name) ?? []), config]);
  }

  const byId = new Map(currentDatabases.map((database) => [database.id, database]));

  for (const databaseRecord of currentDatabases) {
    const currentServiceName = databaseRecord.serviceId
      ? (serviceById.get(databaseRecord.serviceId)?.name ?? null)
      : null;
    const exact = configByKey.get(
      buildDatabaseContractKey({
        name: databaseRecord.name,
        scope: databaseRecord.scope,
        serviceName: currentServiceName,
      })
    );
    const fallbackCandidates = configByName.get(databaseRecord.name) ?? [];
    const config =
      exact ?? (fallbackCandidates.length === 1 ? (fallbackCandidates[0] ?? null) : null);

    if (!config) {
      continue;
    }

    const unsafeInfrastructureChange = getUnsafeRuntimeDatabaseInfrastructureChange(
      databaseRecord,
      config
    );
    if (unsafeInfrastructureChange) {
      if (input.strict) {
        throw new RuntimeDatabaseContractSyncBlockedError([unsafeInfrastructureChange]);
      }

      runtimeContractLogger.warn('Skipping unsafe database infrastructure change', {
        projectId: input.projectId,
        databaseName: databaseRecord.name,
        reason: unsafeInfrastructureChange.message,
      });
      continue;
    }

    const nextScope = config.scope ?? (config.service ? 'service' : 'project');
    const nextServiceId =
      nextScope === 'service' && config.service
        ? (serviceByName.get(config.service)?.id ?? databaseRecord.serviceId)
        : null;
    const nextProvisionType = resolveDatabaseProvisionType(config.type, config.provisionType);

    const [updated] = await db
      .update(databases)
      .set({
        type: config.type,
        plan: config.plan ?? databaseRecord.plan,
        provisionType: nextProvisionType,
        runtime: inferDatabaseRuntime(config.type, nextProvisionType),
        scope: nextScope,
        role: config.role ?? databaseRecord.role,
        serviceId: nextServiceId,
        connectionString:
          nextProvisionType === 'external'
            ? (config.externalUrl?.trim() ?? databaseRecord.connectionString)
            : databaseRecord.connectionString,
        capabilities: normalizeDatabaseCapabilities(config.capabilities),
        updatedAt: new Date(),
      })
      .where(eq(databases.id, databaseRecord.id))
      .returning();

    byId.set(databaseRecord.id, updated);
  }

  return currentDatabases.map((database) => byId.get(database.id) ?? database);
}
