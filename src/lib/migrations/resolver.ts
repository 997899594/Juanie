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
import {
  gateway,
  getTeamIntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';
import type { ResolvedMigrationSpec } from './types';

interface ServiceDatabaseBindingConfig {
  binding: string;
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
    db.query.databases.findMany({
      where: and(eq(databases.projectId, projectId), eq(databases.environmentId, environmentId)),
    }),
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

  for (const serviceRecord of serviceList) {
    const serviceConfig = configServices.get(serviceRecord.name);
    const bindings = (serviceConfig?.databases ?? []) as ServiceDatabaseBindingConfig[];

    for (const binding of bindings) {
      const databaseRecord = databaseList.find(
        (candidate) =>
          candidate.name === binding.binding &&
          (candidate.serviceId === serviceRecord.id ||
            candidate.serviceId === null ||
            candidate.serviceId === undefined)
      );

      if (!databaseRecord) {
        continue;
      }

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
  await syncMigrationSpecificationsFromRepo(projectId, environmentId, options);

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
  }));
}
