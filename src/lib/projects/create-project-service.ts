import { nanoid } from 'nanoid';
import type { DatabaseConfig, ServiceConfig } from '@/lib/config/parser';
import { encrypt } from '@/lib/crypto';
import { normalizeDatabaseCapabilities } from '@/lib/databases/capabilities';
import { inferDatabaseRuntime } from '@/lib/databases/model';
import {
  formatUnsupportedPreviewCloneDatabasesMessage,
  getDatabaseSelectionValidationIssues,
  getUnsupportedPreviewCloneDatabases,
  resolveDatabaseProvisionType,
} from '@/lib/databases/platform-support';
import { db } from '@/lib/db';
import {
  databases,
  deliveryRules,
  domains,
  environments,
  environmentVariables,
  projectInitSteps,
  projects,
  promotionFlows,
  services,
} from '@/lib/db/schema';
import {
  allocateManagedHostnameBaseWithDb,
  buildManagedEnvironmentHostname,
  type HostnameAllocatorExecutor,
} from '@/lib/domains/managed';
import { isPreviewEnvironment, isProductionEnvironment } from '@/lib/environments/model';
import { getTeamIntegrationSession } from '@/lib/integrations/service/integration-control-plane';
import { ensureRepository } from '@/lib/integrations/service/repository-service';
import { logger } from '@/lib/logger';
import type { CreateRuntimeProfile } from '@/lib/projects/create-defaults';
import {
  buildEnvironmentTopologyBlueprint,
  type CreateEnvironmentTemplate,
} from '@/lib/projects/environment-topology';
import { deleteCreatedProject, markProjectInitDispatchFailed } from '@/lib/projects/init-dispatch';
import { addProjectInitJob } from '@/lib/queue';
import { getRequiredCapabilitiesForProjectBootstrap } from '@/lib/queue/project-init-capabilities';
import { buildProjectInitStepSeeds } from '@/lib/queue/project-init-steps';

const createProjectServiceLogger = logger.child({ component: 'project-create-service' });

export interface CreateProjectInput {
  userId: string;
  mode: 'import' | 'create';
  repositoryId?: string;
  repositoryFullName?: string;
  isPrivate?: boolean;
  template?: string;
  name: string;
  slug: string;
  description?: string;
  teamId: string;
  services: ServiceConfig[];
  databases: DatabaseConfig[];
  domain?: string;
  useCustomDomain?: boolean;
  productionBranch: string;
  autoDeploy: boolean;
  productionDeploymentStrategy?: 'rolling' | 'controlled' | 'canary' | 'blue_green';
  previewDatabaseStrategy?: 'inherit' | 'isolated_clone';
  runtimeProfile?: CreateRuntimeProfile;
  environmentTemplate?: CreateEnvironmentTemplate;
  initialVariables?: CreateProjectInitialVariable[];
}

export interface CreateProjectInitialVariable {
  key: string;
  value: string;
  isSecret?: boolean;
}

type CreateProjectErrorCode =
  | 'project_create_failed'
  | 'team_scope_missing'
  | 'repo_bootstrap_capability_missing'
  | 'project_init_queue_failed';

export class CreateProjectError extends Error {
  constructor(
    readonly code: CreateProjectErrorCode,
    readonly status: number,
    message: string,
    readonly details?: string | null
  ) {
    super(message);
    this.name = 'CreateProjectError';
  }
}

export function isCreateProjectError(error: unknown): error is CreateProjectError {
  return error instanceof CreateProjectError;
}

function getCapabilityLabel(capability: string): string {
  switch (capability) {
    case 'read_repo':
      return '读取仓库';
    case 'write_repo':
      return '写入仓库';
    case 'write_workflow':
      return '触发或管理工作流';
    default:
      return capability;
  }
}

function buildBootstrapAccessErrorMessage(mode: 'import' | 'create', error: unknown): string {
  const actionLabel = mode === 'create' ? '创建项目' : '导入项目';
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'MISSING_CAPABILITY' &&
    'capability' in error &&
    typeof (error as { capability?: string }).capability === 'string'
  ) {
    return `当前团队缺少 ${getCapabilityLabel((error as { capability: string }).capability)} 授权，无法完成${actionLabel}链路`;
  }

  return `当前团队没有可用的仓库集成授权，无法完成${actionLabel}链路`;
}

function assertCreateProjectBasics(input: CreateProjectInput): void {
  if (!input.teamId || !input.name || !input.slug) {
    throw new CreateProjectError('project_create_failed', 400, '团队、名称和标识不能为空');
  }
}

function assertDatabaseSelections(input: CreateProjectInput): void {
  for (const databaseConfig of input.databases ?? []) {
    const issues = getDatabaseSelectionValidationIssues({
      ...databaseConfig,
      provisionType: resolveDatabaseProvisionType(
        databaseConfig.type,
        databaseConfig.provisionType
      ),
    });

    if (issues.length > 0) {
      throw new CreateProjectError(
        'project_create_failed',
        400,
        `数据库 "${databaseConfig.name}" 配置无效：${issues[0]?.message ?? '未知错误'}`
      );
    }
  }

  if (input.previewDatabaseStrategy === 'isolated_clone') {
    const unsupportedDatabases = getUnsupportedPreviewCloneDatabases(input.databases ?? []);
    if (unsupportedDatabases.length > 0) {
      throw new CreateProjectError(
        'project_create_failed',
        400,
        formatUnsupportedPreviewCloneDatabasesMessage(unsupportedDatabases)
      );
    }
  }
}

function normalizeInitialVariables(
  variables: CreateProjectInitialVariable[] | undefined
): CreateProjectInitialVariable[] {
  const normalized = (variables ?? [])
    .map((variable) => ({
      key: variable.key.trim(),
      value: variable.value,
      isSecret: variable.isSecret ?? true,
    }))
    .filter((variable) => variable.key.length > 0 || variable.value.length > 0);

  const seen = new Set<string>();
  for (const variable of normalized) {
    if (!/^[A-Z0-9_]+$/i.test(variable.key)) {
      throw new CreateProjectError(
        'project_create_failed',
        400,
        `环境变量 ${variable.key || '(空)'} 名称只能包含字母、数字和下划线`
      );
    }

    if (!variable.value) {
      throw new CreateProjectError(
        'project_create_failed',
        400,
        `环境变量 ${variable.key} 的值不能为空`
      );
    }

    const scopeKey = variable.key.toUpperCase();
    if (seen.has(scopeKey)) {
      throw new CreateProjectError('project_create_failed', 400, `环境变量 ${variable.key} 重复`);
    }
    seen.add(scopeKey);
  }

  return normalized;
}

async function buildInitialVariableRows(
  projectId: string,
  variables: CreateProjectInitialVariable[]
) {
  return Promise.all(
    variables.map(async (variable) => {
      if (variable.isSecret) {
        const encrypted = await encrypt(variable.value);
        return {
          projectId,
          environmentId: null,
          serviceId: null,
          key: variable.key,
          value: null,
          isSecret: true,
          injectionType: 'runtime',
          encryptedValue: encrypted.encryptedValue,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
        };
      }

      return {
        projectId,
        environmentId: null,
        serviceId: null,
        key: variable.key,
        value: variable.value,
        isSecret: false,
        injectionType: 'runtime',
        encryptedValue: null,
        iv: null,
        authTag: null,
      };
    })
  );
}

async function assertTeamCanCreateProject(teamId: string, userId: string): Promise<void> {
  const teamMember = await db.query.teamMembers.findFirst({
    where: (member, { and, eq }) => and(eq(member.teamId, teamId), eq(member.userId, userId)),
    columns: {
      role: true,
    },
  });

  if (!teamMember || !['owner', 'admin', 'member'].includes(teamMember.role)) {
    throw new CreateProjectError('team_scope_missing', 403, '当前团队不可用于创建项目');
  }
}

async function resolveBootstrapIntegrationSession(input: {
  teamId: string;
  userId: string;
  mode: 'import' | 'create';
}) {
  try {
    return await getTeamIntegrationSession({
      teamId: input.teamId,
      actingUserId: input.userId,
      requiredCapabilities: getRequiredCapabilitiesForProjectBootstrap(input.mode),
    });
  } catch (error) {
    throw new CreateProjectError(
      'repo_bootstrap_capability_missing',
      403,
      buildBootstrapAccessErrorMessage(input.mode, error)
    );
  }
}

async function ensureImportedRepositoryId(input: {
  mode: 'import' | 'create';
  repositoryId?: string;
  repositoryFullName?: string;
  integrationSession: Awaited<ReturnType<typeof getTeamIntegrationSession>>;
}): Promise<string | null> {
  if (
    input.mode !== 'import' ||
    !input.repositoryId ||
    !input.repositoryFullName ||
    !input.integrationSession
  ) {
    return null;
  }

  return ensureRepository(input.repositoryId, input.repositoryFullName, input.integrationSession);
}

async function createProjectAggregate(input: {
  createInput: CreateProjectInput;
  repositoryId: string | null;
  uniqueSlug: string;
}) {
  const {
    createInput: {
      autoDeploy,
      databases: databaseConfigs,
      description,
      domain,
      environmentTemplate,
      isPrivate,
      initialVariables,
      mode,
      name,
      previewDatabaseStrategy,
      productionBranch,
      productionDeploymentStrategy,
      runtimeProfile,
      services: serviceConfigs,
      slug,
      teamId,
      template,
      useCustomDomain,
    },
    repositoryId,
    uniqueSlug,
  } = input;

  const topology = buildEnvironmentTopologyBlueprint({
    template: environmentTemplate ?? 'staging_production_preview',
    productionBranch,
    autoDeploy,
    productionDeploymentStrategy: productionDeploymentStrategy ?? 'controlled',
    previewDatabaseStrategy: previewDatabaseStrategy ?? 'inherit',
  });
  const initStepsData = buildProjectInitStepSeeds(mode);
  const normalizedInitialVariables = normalizeInitialVariables(initialVariables);

  return db.transaction(async (tx) => {
    const managedHostnameBase = await allocateManagedHostnameBaseWithDb({
      executor: tx as unknown as HostnameAllocatorExecutor,
      preferredSlug: slug,
    });

    const [createdProject] = await tx
      .insert(projects)
      .values({
        teamId,
        name,
        slug: uniqueSlug,
        description,
        repositoryId,
        productionBranch,
        autoDeploy,
        configJson: {
          projectInit: {
            mode,
            template: template ?? null,
            isPrivate: Boolean(isPrivate),
          },
          creationDefaults: {
            runtimeProfile: runtimeProfile ?? 'standard',
            productionDeploymentStrategy: productionDeploymentStrategy ?? 'controlled',
            previewDatabaseStrategy: previewDatabaseStrategy ?? 'inherit',
            environmentTemplate: environmentTemplate ?? 'staging_production_preview',
          },
          routing: {
            vanitySlug: slug,
            managedHostnameBase,
          },
        },
        status: 'initializing',
      })
      .returning();

    if (!createdProject) {
      throw new Error('Failed to create project');
    }

    if (normalizedInitialVariables.length > 0) {
      await tx
        .insert(environmentVariables)
        .values(await buildInitialVariableRows(createdProject.id, normalizedInitialVariables));
    }

    const createdEnvironments = await tx
      .insert(environments)
      .values(
        topology.environments.map((environment) => ({
          projectId: createdProject.id,
          name: environment.name,
          kind: environment.kind,
          deliveryMode: environment.deliveryMode,
          branch: environment.branch,
          autoDeploy: environment.autoDeploy,
          isProduction: environment.isProduction,
          databaseStrategy: environment.databaseStrategy,
          deploymentStrategy: environment.deploymentStrategy,
          deploymentRuntime: environment.deploymentRuntime,
          autoSleepEnabled: !environment.isProduction,
        }))
      )
      .returning();

    const environmentByKey = new Map(
      topology.environments.map((environment, index) => [
        environment.key,
        createdEnvironments[index] ?? null,
      ])
    );
    const primaryEnvironment = environmentByKey.get(topology.primaryEnvironmentKey);
    const productionEnvironment =
      createdEnvironments.find((environment) => isProductionEnvironment(environment)) ?? null;

    if (!primaryEnvironment) {
      throw new Error('Failed to create primary environment');
    }
    if (!productionEnvironment) {
      throw new Error('Failed to create production environment');
    }

    await tx.insert(deliveryRules).values(
      topology.deliveryRules.map((rule) => {
        const environment = environmentByKey.get(rule.environmentKey);
        if (!environment) {
          throw new Error(`Failed to resolve environment for delivery rule ${rule.environmentKey}`);
        }

        return {
          projectId: createdProject.id,
          environmentId: environment.id,
          kind: rule.kind,
          pattern: rule.pattern,
          priority: rule.priority,
          autoCreateEnvironment: rule.autoCreateEnvironment,
        };
      })
    );

    await tx.insert(promotionFlows).values(
      topology.promotionFlows.map((flow) => {
        const sourceEnvironment = environmentByKey.get(flow.sourceEnvironmentKey);
        const targetEnvironment = environmentByKey.get(flow.targetEnvironmentKey);

        if (!sourceEnvironment || !targetEnvironment) {
          throw new Error('Failed to resolve promotion flow environments');
        }

        return {
          projectId: createdProject.id,
          sourceEnvironmentId: sourceEnvironment.id,
          targetEnvironmentId: targetEnvironment.id,
          requiresApproval: flow.requiresApproval,
          strategy: flow.strategy,
          isActive: flow.isActive,
        };
      })
    );

    const createdServices = new Map<string, string>();
    for (const serviceConfig of serviceConfigs) {
      const scaling = serviceConfig.scaling ?? null;
      const resources = serviceConfig.resources ?? null;
      const [service] = await tx
        .insert(services)
        .values({
          projectId: createdProject.id,
          name: serviceConfig.name,
          type: serviceConfig.type,
          buildCommand: serviceConfig.build?.command,
          dockerfile: serviceConfig.build?.dockerfile,
          dockerContext: serviceConfig.build?.context,
          startCommand: serviceConfig.run?.command,
          port: serviceConfig.run?.port,
          cronSchedule: serviceConfig.type === 'cron' ? serviceConfig.schedule : null,
          replicas: scaling?.min ?? 1,
          healthcheckPath: serviceConfig.healthcheck?.path ?? null,
          healthcheckInterval: serviceConfig.healthcheck?.interval ?? 30,
          cpuRequest: resources?.cpuRequest ?? '100m',
          cpuLimit: resources?.cpuLimit ?? '500m',
          memoryRequest: resources?.memoryRequest ?? '256Mi',
          memoryLimit: resources?.memoryLimit ?? '512Mi',
          autoscaling:
            scaling && ((scaling.max ?? 0) > (scaling.min ?? 0) || Boolean(scaling.cpu))
              ? {
                  min: scaling.min ?? 1,
                  max: scaling.max ?? scaling.min ?? 1,
                  cpu: scaling.cpu ?? 80,
                }
              : null,
          isPublic: serviceConfig.isPublic ?? true,
          status: 'pending',
        })
        .returning();

      if (!service) {
        throw new Error(`Failed to create service: ${serviceConfig.name}`);
      }

      createdServices.set(serviceConfig.name, service.id);
    }

    const runtimeEnvironments = createdEnvironments.filter(
      (environment) =>
        !isPreviewEnvironment(environment) && environment.databaseStrategy === 'direct'
    );

    for (const dbConfig of databaseConfigs) {
      const provisionType = resolveDatabaseProvisionType(dbConfig.type, dbConfig.provisionType);
      const targetEnvironments =
        runtimeEnvironments.length > 0 ? runtimeEnvironments : [primaryEnvironment];

      await tx.insert(databases).values(
        targetEnvironments.map((environment) => ({
          projectId: createdProject.id,
          environmentId: environment.id,
          serviceId: dbConfig.service ? (createdServices.get(dbConfig.service) ?? null) : null,
          name: dbConfig.name,
          type: dbConfig.type,
          plan: dbConfig.plan || 'starter',
          provisionType,
          runtime: inferDatabaseRuntime(dbConfig.type, provisionType),
          scope: dbConfig.scope || (dbConfig.service ? 'service' : 'project'),
          role: dbConfig.role || 'primary',
          capabilities: normalizeDatabaseCapabilities(dbConfig.capabilities),
          connectionString: provisionType === 'external' ? (dbConfig.externalUrl ?? null) : null,
          status: 'pending',
        }))
      );
    }

    await tx.insert(domains).values(
      createdEnvironments
        .filter((environment) => !isPreviewEnvironment(environment))
        .map((environment) => ({
          projectId: createdProject.id,
          environmentId: environment.id,
          hostname: buildManagedEnvironmentHostname(managedHostnameBase, {
            name: environment.name,
            kind: environment.kind,
            isProduction: environment.isProduction,
            isPreview: environment.isPreview,
          }),
          isCustom: false,
          isVerified: true,
        }))
    );

    if (useCustomDomain && domain) {
      await tx.insert(domains).values({
        projectId: createdProject.id,
        environmentId: productionEnvironment.id,
        hostname: domain,
        isCustom: true,
        isVerified: false,
      });
    }

    await tx.insert(projectInitSteps).values(
      initStepsData.map((step) => ({
        projectId: createdProject.id,
        step: step.step,
        status: step.status,
        progress: step.progress,
      }))
    );

    return createdProject;
  });
}

async function enqueueProjectInitializationOrRollback(input: {
  projectId: string;
  mode: 'import' | 'create';
  template?: string;
}): Promise<void> {
  try {
    await addProjectInitJob(input.projectId, input.mode, input.template);
  } catch (error) {
    createProjectServiceLogger.error('Failed to queue project initialization', error, {
      projectId: input.projectId,
      mode: input.mode,
    });

    const queueErrorMessage =
      error instanceof Error ? error.message : '初始化任务创建失败，请稍后重试';

    try {
      await deleteCreatedProject(input.projectId);
    } catch (rollbackError) {
      createProjectServiceLogger.error(
        'Failed to rollback project after queueing error',
        rollbackError,
        {
          projectId: input.projectId,
        }
      );
      await markProjectInitDispatchFailed({
        projectId: input.projectId,
        errorMessage: queueErrorMessage,
      });

      throw new CreateProjectError(
        'project_init_queue_failed',
        503,
        '初始化任务创建失败，项目已保留为失败状态，可稍后重试',
        queueErrorMessage
      );
    }

    throw new CreateProjectError(
      'project_init_queue_failed',
      503,
      '初始化任务创建失败，请稍后重试',
      queueErrorMessage
    );
  }
}

export async function createProjectWithBootstrap(input: CreateProjectInput) {
  assertCreateProjectBasics(input);
  assertDatabaseSelections(input);
  await assertTeamCanCreateProject(input.teamId, input.userId);

  const integrationSession = await resolveBootstrapIntegrationSession({
    teamId: input.teamId,
    userId: input.userId,
    mode: input.mode,
  });
  const repositoryId = await ensureImportedRepositoryId({
    mode: input.mode,
    repositoryId: input.repositoryId,
    repositoryFullName: input.repositoryFullName,
    integrationSession,
  });
  const project = await createProjectAggregate({
    createInput: {
      ...input,
      services: input.services ?? [],
      databases: input.databases ?? [],
    },
    repositoryId,
    uniqueSlug: `${input.slug}-${nanoid(6).toLowerCase()}`,
  });

  await enqueueProjectInitializationOrRollback({
    projectId: project.id,
    mode: input.mode,
    template: input.template,
  });

  return { project };
}
