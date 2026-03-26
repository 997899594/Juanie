import { and, eq, inArray } from 'drizzle-orm';
import { parseJuanieConfig } from '@/lib/config/parser';
import { db } from '@/lib/db';
import {
  databases,
  environments,
  migrationSpecifications,
  projects,
  repositories,
  services,
} from '@/lib/db/schema';
import { getDatabasesForEnvironment } from '@/lib/environments/inheritance';
import {
  gateway,
  getTeamIntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';
import type { ResolvedMigrationSpec } from './types';

interface ServiceDatabaseBindingConfig {
  binding?: string;
  role?: 'primary' | 'readonly' | 'cache' | 'queue' | 'analytics';
  type?: 'postgresql' | 'mysql' | 'redis' | 'mongodb';
  migrate: {
    tool: 'drizzle' | 'prisma' | 'knex' | 'typeorm' | 'sql' | 'custom';
    workingDirectory: string;
    path?: string;
    command: string;
    phase?: 'preDeploy' | 'postDeploy' | 'manual';
    autoRun?: boolean;
    lockStrategy?: 'platform' | 'db_advisory';
    compatibility?: 'backward_compatible' | 'breaking';
    approvalPolicy?: 'auto' | 'manual_in_production';
  };
}

function getImplicitDatabaseTypesForMigrationTool(
  tool: ServiceDatabaseBindingConfig['migrate']['tool']
): Array<ServiceDatabaseBindingConfig['type']> | null {
  switch (tool) {
    case 'drizzle':
    case 'prisma':
    case 'knex':
    case 'sql':
      return ['postgresql', 'mysql'];
    case 'typeorm':
      return ['postgresql', 'mysql', 'mongodb'];
    default:
      return null;
  }
}

export function getServiceBindingConfigs(serviceConfig?: {
  migrate?: ServiceDatabaseBindingConfig['migrate'];
  databases?: ServiceDatabaseBindingConfig[];
}): ServiceDatabaseBindingConfig[] {
  if (!serviceConfig) {
    return [];
  }

  if ((serviceConfig.databases?.length ?? 0) > 0) {
    return serviceConfig.databases ?? [];
  }

  if (serviceConfig.migrate) {
    return [{ migrate: serviceConfig.migrate }];
  }

  return [];
}

function getSelectorSnapshot(binding: ServiceDatabaseBindingConfig) {
  return {
    bindingName: binding.binding ?? null,
    bindingRole: binding.role ?? null,
    bindingDatabaseType: binding.type ?? null,
  };
}

function getFallbackResolution() {
  return {
    strategy: 'unknown',
    selector: {
      bindingName: null,
      bindingRole: null,
      bindingDatabaseType: null,
    },
  };
}

export function resolveDatabaseForBinding(
  binding: ServiceDatabaseBindingConfig,
  serviceId: string,
  databaseList: Array<typeof databases.$inferSelect>
) {
  const baseCandidates = databaseList.filter(
    (candidate) =>
      candidate.serviceId === serviceId ||
      candidate.serviceId === null ||
      candidate.serviceId === undefined
  );

  const serviceCandidates = baseCandidates.filter((candidate) => candidate.serviceId === serviceId);
  const selector = getSelectorSnapshot(binding);

  if (binding.binding) {
    const exactMatches = baseCandidates.filter((candidate) => candidate.name === binding.binding);
    const exactServiceMatches = exactMatches.filter(
      (candidate) => candidate.serviceId === serviceId
    );

    if (exactServiceMatches.length === 1) {
      return {
        database: exactServiceMatches[0],
        resolution: { strategy: 'binding_name', selector },
      };
    }
    if (exactMatches.length === 1) {
      return { database: exactMatches[0], resolution: { strategy: 'binding_name', selector } };
    }

    return null;
  }

  let filtered = baseCandidates;

  if (!binding.binding && !binding.role && !binding.type) {
    const implicitDatabaseTypes = getImplicitDatabaseTypesForMigrationTool(binding.migrate.tool);
    if (implicitDatabaseTypes) {
      const implicitlyTypedCandidates = filtered.filter((candidate) =>
        implicitDatabaseTypes.includes(candidate.type as ServiceDatabaseBindingConfig['type'])
      );

      if (implicitlyTypedCandidates.length > 0) {
        filtered = implicitlyTypedCandidates;
      }
    }
  }

  if (binding.role) {
    filtered = filtered.filter((candidate) => candidate.role === binding.role);
  }
  if (binding.type) {
    filtered = filtered.filter((candidate) => candidate.type === binding.type);
  }

  const filteredServiceCandidates = filtered.filter(
    (candidate) => candidate.serviceId === serviceId
  );
  if ((binding.role || binding.type) && filteredServiceCandidates.length === 1) {
    return {
      database: filteredServiceCandidates[0],
      resolution: { strategy: 'selector_match', selector },
    };
  }
  if ((binding.role || binding.type) && filtered.length === 1) {
    return {
      database: filtered[0],
      resolution: { strategy: 'selector_match', selector },
    };
  }

  if (!binding.role && !binding.type) {
    if (serviceCandidates.length === 1) {
      return {
        database: serviceCandidates[0],
        resolution: { strategy: 'service_single', selector },
      };
    }

    const servicePrimaryCandidates = serviceCandidates.filter(
      (candidate) => candidate.role === 'primary'
    );
    if (servicePrimaryCandidates.length === 1) {
      return {
        database: servicePrimaryCandidates[0],
        resolution: { strategy: 'service_primary', selector },
      };
    }
  }

  const primaryCandidates = filtered.filter((candidate) => candidate.role === 'primary');
  if (primaryCandidates.length === 1) {
    return {
      database: primaryCandidates[0],
      resolution: { strategy: 'implicit_primary', selector },
    };
  }

  if (filtered.length === 1) {
    return {
      database: filtered[0],
      resolution: { strategy: 'implicit_single', selector },
    };
  }

  return null;
}

export async function syncMigrationSpecificationsFromRepo(
  projectId: string,
  environmentId: string,
  options?: {
    sourceRef?: string | null;
    sourceCommitSha?: string | null;
  }
): Promise<ResolvedMigrationSpec[]> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project?.repositoryId) {
    return [];
  }

  const [environment, repository, serviceList, databaseList] = await Promise.all([
    db.query.environments.findFirst({ where: eq(environments.id, environmentId) }),
    db.query.repositories.findFirst({ where: eq(repositories.id, project.repositoryId) }),
    db.query.services.findMany({ where: eq(services.projectId, projectId) }),
    getDatabasesForEnvironment({ projectId, environmentId }),
  ]);

  if (!environment || !repository) {
    return [];
  }

  const session = await getTeamIntegrationSession({
    teamId: project.teamId,
    requiredCapabilities: ['read_repo'],
  });

  const configPaths = ['juanie.yaml', 'juanie.yml'];
  let configContent: string | null = null;
  const configRef =
    options?.sourceCommitSha || options?.sourceRef || repository.defaultBranch || 'main';

  for (const configPath of configPaths) {
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
      // Ignore missing config path and try the next candidate.
    }
  }

  if (!configContent) {
    return [];
  }

  const parsed = parseJuanieConfig(configContent);
  if (!parsed.isValid) {
    throw new Error(`Invalid juanie.yaml: ${parsed.errors.join('; ')}`);
  }

  const configServices = new Map(parsed.services.map((service) => [service.name, service]));
  const upsertedIds: string[] = [];
  const resolutionBySpecId = new Map<string, ResolvedMigrationSpec['resolution']>();

  for (const serviceRecord of serviceList) {
    const serviceConfig = configServices.get(serviceRecord.name);
    const bindings = getServiceBindingConfigs(
      serviceConfig as
        | {
            migrate?: ServiceDatabaseBindingConfig['migrate'];
            databases?: ServiceDatabaseBindingConfig[];
          }
        | undefined
    );

    for (const binding of bindings) {
      const resolved = resolveDatabaseForBinding(binding, serviceRecord.id, databaseList);
      if (!resolved) {
        continue;
      }

      const databaseRecord = resolved.database;
      const [specification] = await db
        .insert(migrationSpecifications)
        .values({
          projectId,
          serviceId: serviceRecord.id,
          environmentId,
          databaseId: databaseRecord.id,
          tool: binding.migrate.tool,
          phase: binding.migrate.phase ?? 'preDeploy',
          autoRun: binding.migrate.autoRun ?? true,
          workingDirectory: binding.migrate.workingDirectory,
          migrationPath: binding.migrate.path,
          command: binding.migrate.command,
          lockStrategy: binding.migrate.lockStrategy ?? 'platform',
          compatibility: binding.migrate.compatibility ?? 'backward_compatible',
          approvalPolicy: binding.migrate.approvalPolicy ?? 'auto',
        })
        .onConflictDoUpdate({
          target: [
            migrationSpecifications.serviceId,
            migrationSpecifications.environmentId,
            migrationSpecifications.databaseId,
          ],
          set: {
            tool: binding.migrate.tool,
            phase: binding.migrate.phase ?? 'preDeploy',
            autoRun: binding.migrate.autoRun ?? true,
            workingDirectory: binding.migrate.workingDirectory,
            migrationPath: binding.migrate.path ?? null,
            command: binding.migrate.command,
            lockStrategy: binding.migrate.lockStrategy ?? 'platform',
            compatibility: binding.migrate.compatibility ?? 'backward_compatible',
            approvalPolicy: binding.migrate.approvalPolicy ?? 'auto',
            updatedAt: new Date(),
          },
        })
        .returning();

      upsertedIds.push(specification.id);
      resolutionBySpecId.set(specification.id, resolved.resolution);
    }
  }

  if (upsertedIds.length === 0) {
    return [];
  }

  const specList = await db.query.migrationSpecifications.findMany({
    where: inArray(migrationSpecifications.id, upsertedIds),
    with: {
      service: true,
      database: true,
      environment: true,
    },
  });

  return specList.map((specification) => ({
    specification,
    service: specification.service,
    database: specification.database,
    environment: specification.environment,
    resolution: resolutionBySpecId.get(specification.id) ?? getFallbackResolution(),
  }));
}

export async function resolveMigrationSpecifications(
  projectId: string,
  environmentId: string,
  phase: 'preDeploy' | 'postDeploy' | 'manual',
  options?: {
    serviceIds?: string[];
    sourceRef?: string | null;
    sourceCommitSha?: string | null;
  }
): Promise<ResolvedMigrationSpec[]> {
  const syncedSpecs = await syncMigrationSpecificationsFromRepo(projectId, environmentId, options);
  const syncedResolutionBySpecId = new Map(
    syncedSpecs.map((spec) => [spec.specification.id, spec.resolution])
  );

  const specList = await db.query.migrationSpecifications.findMany({
    where: options?.serviceIds?.length
      ? and(
          eq(migrationSpecifications.projectId, projectId),
          eq(migrationSpecifications.environmentId, environmentId),
          eq(migrationSpecifications.phase, phase),
          inArray(migrationSpecifications.serviceId, options.serviceIds)
        )
      : and(
          eq(migrationSpecifications.projectId, projectId),
          eq(migrationSpecifications.environmentId, environmentId),
          eq(migrationSpecifications.phase, phase)
        ),
    with: {
      service: true,
      database: true,
      environment: true,
    },
  });

  return specList.map((specification) => ({
    specification,
    service: specification.service,
    database: specification.database,
    environment: specification.environment,
    resolution: syncedResolutionBySpecId.get(specification.id) ?? getFallbackResolution(),
  }));
}
