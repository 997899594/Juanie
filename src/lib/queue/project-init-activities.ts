import { eq } from 'drizzle-orm';
import { injectDatabaseEnvVars, provisionDatabase } from '@/lib/databases/provisioning';
import { db } from '@/lib/db';
import {
  databases,
  domains,
  environments,
  projects,
  repositories,
  services,
} from '@/lib/db/schema';
import type { DeliveryGraph } from '@/lib/delivery-graph/model';
import { resolveDeployImageRepository } from '@/lib/deploy-images';
import { syncEnvVarsToK8s } from '@/lib/env-sync';
import { ensureEnvironmentNamespace, reconcileEnvironmentState } from '@/lib/environments/service';
import { setEnvironmentSourceBuildState } from '@/lib/environments/source-build-state';
import {
  gateway,
  getTeamIntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';
import { insertRepositoryRecord } from '@/lib/integrations/service/repository-service';
import { logger } from '@/lib/logger';
import {
  inspectRepositoryTopology,
  type MonorepoType,
  parseDockerBakeTargets,
  type RepositoryTopologyService,
} from '@/lib/monorepo';
import {
  buildDeliveryBuildTargets,
  buildDeliveryDeliverables,
  getDeliveryBuildSecretNames,
  getManagedBuildFileStem,
} from '@/lib/projects/bootstrap/delivery-build';
import {
  detectPackageManager,
  extractAtlasSchemaSourcePaths,
  getProjectConfigJson,
  getProjectServiceConfigMap,
  JUANIE_AFFECTED_WORKSPACE_SCRIPT_PATH,
  JUANIE_BUILD_RUN_SCRIPT_PATH,
  JUANIE_DELIVERY_SCRIPT_PATH,
  JUANIE_MANAGED_DOC_PATH,
  JUANIE_WORKLOAD_IDENTITY_SCRIPT_PATH,
  type ProjectConfigBuildTargetEntry,
  type ProjectConfigDeliverableEntry,
  type ProjectConfigMonorepoEntry,
  type ProjectInitRenderContext,
  type RepoAutomationContext,
  renderAffectedWorkspaceScript,
  renderBuildRunScript,
  renderDeliveryArtifactsScript,
  renderEnvTemplate,
  renderGitHubCI,
  renderGitHubCIMonorepo,
  renderGitLabCI,
  renderGitLabCIMonorepo,
  renderJuanieConfig,
  renderJuanieManagedDoc,
  renderManagedArtifactTargetDockerfile,
  renderManagedWorkloadDockerfile,
  renderStaticNginxConfig,
  renderWorkloadIdentityScript,
  resolveManagedMigrationScriptPaths,
  resolveMonorepoAffectedRules,
} from '@/lib/projects/bootstrap/repository-automation';
import {
  buildInitialAutoDeploySummary,
  resolveInitialAutoDeployEnvironmentsForRef,
  resolveInitialAutoDeployRefs,
} from '@/lib/projects/initial-auto-deploy';
import { getProjectProductionBranch } from '@/lib/projects/refs';
import { TemplateService } from '@/lib/templates';
import { requiredCapabilitiesForStep } from './project-init-capabilities';

const isDev = process.env.NODE_ENV === 'development';
const projectInitLogger = logger.child({ component: 'project-init-activities' });

type StepProgressReporter = (progress: number, message?: string) => Promise<void>;

export async function loadProjectInitProject(projectId: string) {
  return db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      repository: true,
      team: {
        columns: {
          name: true,
        },
      },
    },
  });
}

export type ProjectInitProjectRecord = NonNullable<
  Awaited<ReturnType<typeof loadProjectInitProject>>
>;

function requireProjectInitRepository(
  project: Pick<ProjectInitProjectRecord, 'repository'>,
  message = 'Project has no repository'
): typeof repositories.$inferSelect {
  if (!project.repository) {
    throw new Error(message);
  }

  return project.repository;
}

export async function validateRepository(
  project: typeof projects.$inferSelect & { repository: typeof repositories.$inferSelect | null },
  onProgress?: StepProgressReporter
) {
  const scopedLogger = projectInitLogger.child({
    projectId: project.id,
    step: 'validate_repository',
  });
  scopedLogger.info('Starting repository validation', { projectName: project.name });
  await onProgress?.(10, '检查仓库绑定');

  const repository = project.repository;

  if (!repository) {
    scopedLogger.warn('No repository linked');
    if (isDev) {
      scopedLogger.info('Skipping repository validation in development mode');
      await onProgress?.(100, '开发模式下跳过仓库校验');
      return;
    }
    throw new Error('No repository linked to project');
  }

  scopedLogger.info('Validating repository access', {
    repositoryFullName: repository.fullName,
  });
  await onProgress?.(45, '验证团队仓库授权');

  // Obtain integration session with required capability
  const session = await getTeamIntegrationSession({
    teamId: project.teamId,
    requiredCapabilities: requiredCapabilitiesForStep('validate_repository'),
  });

  await onProgress?.(80, '读取仓库元数据');
  const repo = await gateway.getRepository(session, repository.fullName);
  scopedLogger.info('Resolved repository access', {
    repositoryFullName: repository.fullName,
    accessGranted: Boolean(repo),
  });

  if (!repo) {
    throw new Error('No access to repository');
  }

  await onProgress?.(100, '仓库访问已确认');
  scopedLogger.info('Repository validation passed');
}

export async function createRepository(
  project: typeof projects.$inferSelect,
  onProgress?: StepProgressReporter
) {
  const scopedLogger = projectInitLogger.child({
    projectId: project.id,
    step: 'create_repository',
  });
  scopedLogger.info('Creating repository for project', { projectName: project.name });
  await onProgress?.(10, '准备创建仓库');

  // Obtain integration session with required capability
  const session = await getTeamIntegrationSession({
    teamId: project.teamId,
    requiredCapabilities: requiredCapabilitiesForStep('create_repository'),
  });

  const projectConfig =
    project.configJson && typeof project.configJson === 'object'
      ? (project.configJson as Record<string, unknown>)
      : null;
  const projectInitConfig =
    projectConfig?.projectInit && typeof projectConfig.projectInit === 'object'
      ? (projectConfig.projectInit as Record<string, unknown>)
      : null;
  const isPrivate =
    typeof projectInitConfig?.isPrivate === 'boolean' ? projectInitConfig.isPrivate : true;

  await onProgress?.(40, '向代码仓库提供方申请新仓库');
  const repo = await gateway.createRepository(session, {
    name: project.slug,
    description: project.description || undefined,
    isPrivate,
    autoInit: false,
  });

  // Create repository record in database
  await onProgress?.(75, '写入 Juanie 项目绑定');
  const dbRepoId = await insertRepositoryRecord(repo, session.integrationId);

  // Update project with repository ID
  await db.update(projects).set({ repositoryId: dbRepoId }).where(eq(projects.id, project.id));

  await onProgress?.(100, '仓库创建完成');
  scopedLogger.info('Created repository for project', {
    repositoryFullName: repo.fullName,
  });
}

export async function pushTemplate(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
    team?: {
      name: string;
    } | null;
  },
  template?: string,
  onProgress?: StepProgressReporter
) {
  const scopedLogger = projectInitLogger.child({
    projectId: project.id,
    step: 'push_template',
  });
  scopedLogger.info('Pushing template to project repository', { projectName: project.name });
  await onProgress?.(10, '准备模板内容');

  const repository = requireProjectInitRepository(project);
  const targetBranch = getProjectProductionBranch(project);

  const session = await getTeamIntegrationSession({
    teamId: project.teamId,
    requiredCapabilities: requiredCapabilitiesForStep('push_template'),
  });

  // Use gateway to push files instead of direct client
  const templateId = template || 'default';
  await onProgress?.(45, '渲染模板文件');
  const files = await new TemplateService(templateId, {
    projectName: project.name,
    projectSlug: project.slug,
    teamName: project.team?.name || 'Team',
    description: project.description || '',
  }).renderToMemory();

  await onProgress?.(85, '推送模板到仓库');
  await gateway.pushFiles(session, {
    repoFullName: repository.fullName,
    branch: targetBranch,
    files: Object.fromEntries(files),
    message: 'Initial commit from Juanie template',
  });

  await onProgress?.(100, '模板已推送');
  scopedLogger.info('Pushed template files to repository', {
    fileCount: files.size,
    repositoryFullName: repository.fullName,
  });
}

/**
 * Push CI/CD configuration files to the repository.
 * This step is called during project import flow.
 */
export async function pushCicdConfig(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  },
  onProgress?: StepProgressReporter
) {
  const scopedLogger = projectInitLogger.child({
    projectId: project.id,
    step: 'push_cicd_config',
  });
  scopedLogger.info('Pushing Juanie CI/CD config', { projectName: project.name });
  await onProgress?.(5, '准备注入 Juanie CI/CD 配置');

  if (!project.repository) {
    scopedLogger.warn('No repository linked, skipping CI/CD config');
    await onProgress?.(100, '项目还没有仓库，跳过 CI/CD 注入');
    return;
  }

  const repository = project.repository;
  const targetBranch = getProjectProductionBranch(project);

  // Obtain integration session with required capabilities
  const session = await getTeamIntegrationSession({
    teamId: project.teamId,
    requiredCapabilities: requiredCapabilitiesForStep('push_cicd_config'),
  });

  let monorepoType: MonorepoType = 'none';
  let rootFiles: string[] = [];
  let bakeDefinition: string | null = null;
  let bakeTargets: string[] = [];
  let atlasConfigPath: string | null = null;
  let atlasConfigContent: string | null = null;
  const atlasSchemaContents: Record<string, string> = {};
  const migrationScriptContents: Record<string, string> = {};
  let packageJson: RepoAutomationContext['packageJson'] = null;
  let topologyServices: RepositoryTopologyService[] = [];
  let deliveryGraph: DeliveryGraph | null = null;
  let configMonorepo: ProjectConfigMonorepoEntry | null = null;
  let configBuildTargets: ProjectConfigBuildTargetEntry[] = [];
  let configDeliverables: ProjectConfigDeliverableEntry[] = [];
  let managedJuanieConfigContent: string | null = null;

  try {
    await onProgress?.(20, '扫描仓库根目录与构建入口');
    const topology = await inspectRepositoryTopology(
      {
        listRootFiles: (repo, ref) => gateway.listRootFiles(session, repo, ref),
        getFileContent: (repo, path, ref) => gateway.getFileContent(session, repo, path, ref),
        listDirectory: (repo, path, ref) => gateway.listDirectory(session, repo, path, ref),
      },
      repository.fullName,
      targetBranch
    );

    rootFiles = topology.rootFiles;
    monorepoType = topology.monorepoType;
    bakeDefinition = topology.bakeDefinitionPath;
    bakeTargets = topology.bakeTargets;
    packageJson = topology.rootPackageJson;
    topologyServices = topology.services;
    deliveryGraph = topology.deliveryGraph;
    configMonorepo = topology.configMonorepo
      ? {
          enabled: topology.monorepoType !== 'none',
          type: topology.configMonorepo.type,
          packageManager: topology.configMonorepo.packageManager,
          affected: topology.configMonorepo.affected,
        }
      : null;
    configBuildTargets = topology.configBuildTargets ?? [];
    configDeliverables = topology.configDeliverables ?? [];
    managedJuanieConfigContent = topology.managedConfigContent ?? null;
    scopedLogger.info('Detected repository topology for CI/CD config', {
      monorepoType,
      repositoryFullName: repository.fullName,
    });

    if (!packageJson && rootFiles.includes('package.json')) {
      try {
        await onProgress?.(35, '读取 package.json 分析运行时');
        const packageJsonContent = await gateway.getFileContent(
          session,
          repository.fullName,
          'package.json',
          targetBranch
        );
        packageJson = packageJsonContent ? JSON.parse(packageJsonContent) : null;
      } catch (error) {
        scopedLogger.warn('Failed to parse package.json, falling back to migration skeleton', {
          repositoryFullName: repository.fullName,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (rootFiles.includes('atlas.hcl')) {
      atlasConfigPath = 'atlas.hcl';

      try {
        atlasConfigContent = await gateway.getFileContent(
          session,
          repository.fullName,
          atlasConfigPath,
          targetBranch
        );

        if (atlasConfigContent) {
          for (const sourcePath of extractAtlasSchemaSourcePaths(atlasConfigContent)) {
            try {
              const content = await gateway.getFileContent(
                session,
                repository.fullName,
                sourcePath,
                targetBranch
              );

              if (content) {
                atlasSchemaContents[sourcePath] = content;
              }
            } catch (error) {
              scopedLogger.warn(
                'Failed to inspect Atlas schema source while inferring capabilities',
                {
                  repositoryFullName: repository.fullName,
                  sourcePath,
                  errorMessage: error instanceof Error ? error.message : String(error),
                }
              );
            }
          }
        }
      } catch (error) {
        scopedLogger.warn('Failed to read atlas.hcl while inferring migrations', {
          repositoryFullName: repository.fullName,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    for (const scriptPath of resolveManagedMigrationScriptPaths(packageJson)) {
      try {
        const content = await gateway.getFileContent(
          session,
          repository.fullName,
          scriptPath,
          targetBranch
        );

        if (content) {
          migrationScriptContents[scriptPath] = content;
        }
      } catch (error) {
        scopedLogger.warn('Failed to inspect migration script while inferring tool', {
          repositoryFullName: repository.fullName,
          scriptPath,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (bakeDefinition) {
      try {
        await onProgress?.(50, '分析 docker-bake 定义');
        const bakeContent = await gateway.getFileContent(
          session,
          repository.fullName,
          bakeDefinition,
          targetBranch
        );
        if (bakeContent) {
          bakeTargets = parseDockerBakeTargets(bakeContent);
        }
      } catch (error) {
        scopedLogger.warn('Failed to inspect docker-bake definition, continuing without targets', {
          repositoryFullName: repository.fullName,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    scopedLogger.warn('Failed to inspect repository root, falling back to generated skeleton', {
      repositoryFullName: repository.fullName,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  await onProgress?.(65, '生成 Juanie 配置文件');
  const [serviceList, databaseList] = await Promise.all([
    db.query.services.findMany({
      where: eq(services.projectId, project.id),
      orderBy: (service, { asc }) => [asc(service.createdAt)],
    }),
    db.query.databases.findMany({
      where: eq(databases.projectId, project.id),
      orderBy: (database, { asc }) => [asc(database.createdAt)],
    }),
  ]);

  const renderContext: ProjectInitRenderContext = {
    services: serviceList,
    databases: databaseList,
  };
  const existingConfig = getProjectConfigJson(project);
  const existingServiceConfigMap = getProjectServiceConfigMap(project);
  const packageManager = detectPackageManager(rootFiles, packageJson);
  const buildSecretNames = getDeliveryBuildSecretNames(deliveryGraph);
  const effectiveBuildTargets =
    configBuildTargets.length > 0
      ? configBuildTargets
      : buildDeliveryBuildTargets({ graph: deliveryGraph, secretNames: buildSecretNames });
  const usesGeneratedBuildTargets = configBuildTargets.length === 0;
  const effectiveDeliverables =
    configDeliverables.length > 0 ? configDeliverables : buildDeliveryDeliverables(deliveryGraph);
  const inferredWorkloadByName = new Map(
    (deliveryGraph?.workloads ?? []).map((workload) => [workload.name, workload])
  );
  const nextServiceConfigMap = { ...existingServiceConfigMap };
  for (const service of topologyServices) {
    const workload = inferredWorkloadByName.get(service.name);
    const managedDockerfile =
      workload?.confidence === 'high' && !workload.hasDockerfile
        ? `.juanie/runtime/${getManagedBuildFileStem(service.name)}.Dockerfile`
        : null;
    const build = service.build
      ? {
          ...service.build,
          ...(managedDockerfile
            ? { strategy: 'dockerfile' as const, dockerfile: managedDockerfile, context: '.' }
            : {}),
          ...(buildSecretNames.length > 0 ? { secrets: buildSecretNames } : {}),
        }
      : managedDockerfile
        ? {
            strategy: 'dockerfile' as const,
            dockerfile: managedDockerfile,
            context: '.',
            command: workload?.buildCommand,
            secrets: buildSecretNames,
          }
        : undefined;
    nextServiceConfigMap[service.name] = {
      ...(existingServiceConfigMap[service.name] ?? {}),
      ...(service.appDir && service.appDir !== '.'
        ? {
            monorepo: {
              appDir: service.appDir,
              ...(service.packageName ? { packageName: service.packageName } : {}),
            },
          }
        : {}),
      ...(service.runtime ? { runtime: service.runtime } : {}),
      ...(build ? { build } : {}),
    };
  }
  const projectWithTopology = {
    ...project,
    configJson: {
      ...existingConfig,
      services: nextServiceConfigMap,
      ...(configMonorepo ? { monorepo: configMonorepo } : {}),
      ...(effectiveBuildTargets.length > 0 ? { buildTargets: effectiveBuildTargets } : {}),
      ...(effectiveDeliverables.length > 0 ? { deliverables: effectiveDeliverables } : {}),
      ...(deliveryGraph ? { deliveryGraph } : {}),
    },
  };
  const automationContext: RepoAutomationContext = {
    monorepoType,
    rootFiles,
    packageManager,
    bakeDefinition,
    bakeTargets,
    atlasConfigPath,
    atlasConfigContent,
    atlasSchemaContents,
    migrationScriptContents,
    packageJson,
  };
  const files: Record<string, string> = {};

  const isMonorepo = monorepoType !== 'none';
  if (session.provider === 'github') {
    const ciTemplate = isMonorepo
      ? renderGitHubCIMonorepo(projectWithTopology, serviceList)
      : renderGitHubCI(project, renderContext);
    files['.github/workflows/juanie-ci.yml'] = ciTemplate;
  } else if (session.provider === 'gitlab' || session.provider === 'gitlab-self-hosted') {
    const ciTemplate = isMonorepo
      ? renderGitLabCIMonorepo(projectWithTopology, serviceList)
      : renderGitLabCI(project, renderContext);
    files['.gitlab-ci.yml'] = ciTemplate;
  }

  files['juanie.yaml'] =
    managedJuanieConfigContent ??
    renderJuanieConfig(projectWithTopology, renderContext, automationContext);

  const envTemplate = renderEnvTemplate(project, databaseList);
  files['.env.juanie.example'] = envTemplate;
  files[JUANIE_MANAGED_DOC_PATH] = renderJuanieManagedDoc(project, session.provider);
  files[JUANIE_BUILD_RUN_SCRIPT_PATH] = renderBuildRunScript();
  files[JUANIE_DELIVERY_SCRIPT_PATH] = renderDeliveryArtifactsScript();
  files[JUANIE_WORKLOAD_IDENTITY_SCRIPT_PATH] = renderWorkloadIdentityScript();
  files[JUANIE_AFFECTED_WORKSPACE_SCRIPT_PATH] = renderAffectedWorkspaceScript();
  for (const workload of deliveryGraph?.workloads ?? []) {
    if (workload.confidence !== 'high' || workload.hasDockerfile) continue;
    files[`.juanie/runtime/${getManagedBuildFileStem(workload.name)}.Dockerfile`] =
      renderManagedWorkloadDockerfile({ workload, packageManager, secretNames: buildSecretNames });
  }
  if ((deliveryGraph?.workloads ?? []).some((workload) => workload.runtimeKind === 'static')) {
    files['.juanie/runtime/static-nginx.conf'] = renderStaticNginxConfig();
  }
  for (const target of usesGeneratedBuildTargets ? effectiveBuildTargets : []) {
    files[
      target.build.dockerfile ??
        `.juanie/build-targets/${getManagedBuildFileStem(target.name)}.Dockerfile`
    ] = renderManagedArtifactTargetDockerfile({
      packageManager,
      buildCommand: target.build.command ?? `${packageManager} run build`,
      outputPath: target.output.path,
      secretNames: target.build.secrets ?? [],
    });
  }

  if (Object.keys(files).length > 0) {
    await onProgress?.(90, '推送 Juanie 配置到仓库');
    await gateway.pushFiles(session, {
      repoFullName: repository.fullName,
      branch: targetBranch,
      files,
      message: 'Configure Juanie CI/CD [skip ci]',
    });
  }

  await db
    .update(projects)
    .set({
      configJson: {
        ...existingConfig,
        services: nextServiceConfigMap,
        monorepo: {
          ...(configMonorepo ?? {}),
          enabled: isMonorepo,
          type: monorepoType,
          packageManager,
          affected: resolveMonorepoAffectedRules(projectWithTopology, automationContext),
        },
        ...(effectiveBuildTargets.length > 0 ? { buildTargets: effectiveBuildTargets } : {}),
        ...(effectiveDeliverables.length > 0 ? { deliverables: effectiveDeliverables } : {}),
        ...(deliveryGraph ? { deliveryGraph } : {}),
      },
    })
    .where(eq(projects.id, project.id));

  await onProgress?.(100, 'Juanie CI/CD 配置已注入');
  scopedLogger.info('Pushed Juanie CI/CD config', {
    monorepoType: isMonorepo ? monorepoType : 'none',
    repositoryFullName: repository.fullName,
  });
}

/**
 * Configure the release trigger metadata Juanie needs after project bootstrap.
 * Deployments are triggered by Juanie release creation through managed CI.
 */
export async function configureReleaseTrigger(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  },
  onProgress?: StepProgressReporter
) {
  const scopedLogger = projectInitLogger.child({
    projectId: project.id,
    step: 'configure_release_trigger',
  });
  scopedLogger.info('Configuring release trigger for project', { projectName: project.name });
  await onProgress?.(20, '准备发布触发配置');

  const repository = project.repository;

  if (!repository) {
    scopedLogger.warn('No repository linked, skipping release trigger configuration');
    await onProgress?.(100, '项目还没有仓库，跳过发布触发配置');
    return;
  }

  // Update project config with image name
  const config = (project.configJson as Record<string, unknown>) || {};
  await onProgress?.(60, '计算镜像仓库地址');
  const imageName = resolveDeployImageRepository({
    configJson: project.configJson,
    repositoryFullName: repository.fullName,
  });

  if (!imageName) {
    throw new Error(`Cannot resolve deploy image repository for ${repository.fullName}`);
  }

  await db
    .update(projects)
    .set({
      configJson: {
        ...config,
        imageName,
        releaseTriggerConfigured: true,
      },
    })
    .where(eq(projects.id, project.id));

  await onProgress?.(100, '发布触发配置完成');
  scopedLogger.info('Configured release trigger for repository', {
    repositoryFullName: repository.fullName,
    imageName,
  });
}

export async function triggerInitialAutoDeployBuilds(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  },
  onProgress?: StepProgressReporter
): Promise<void> {
  const repository = project.repository;

  if (!repository?.fullName || !repository.providerId) {
    await onProgress?.(100, '项目还没有仓库，跳过首发构建触发');
    return;
  }

  const environmentList = await db.query.environments.findMany({
    where: eq(environments.projectId, project.id),
    orderBy: (environment, { asc }) => [asc(environment.createdAt)],
  });
  const refs = resolveInitialAutoDeployRefs(environmentList);

  if (refs.length === 0) {
    await onProgress?.(100, '没有需要触发的首发构建');
    return;
  }

  const scopedLogger = projectInitLogger.child({
    projectId: project.id,
    step: 'trigger_initial_auto_deploy_builds',
    repositoryFullName: repository.fullName,
  });

  const session = await getTeamIntegrationSession({
    integrationId: repository.providerId,
    teamId: project.teamId,
    requiredCapabilities: requiredCapabilitiesForStep('trigger_initial_builds'),
  });

  const triggeredRefs: string[] = [];
  const missingRefs: string[] = [];

  for (let index = 0; index < refs.length; index += 1) {
    const ref = refs[index];
    const matchedEnvironments = resolveInitialAutoDeployEnvironmentsForRef(environmentList, ref);
    await onProgress?.(
      Math.round((index / refs.length) * 90),
      `检查 ${ref.replace(/^refs\/heads\//, '')} 最新提交`
    );

    const sourceCommitSha = await gateway.resolveRefToCommitSha(session, repository.fullName, ref);

    if (!sourceCommitSha) {
      missingRefs.push(ref);
      scopedLogger.warn('Skipping missing initial auto-deploy branch', {
        ref,
      });
      continue;
    }

    const buildStartedAt = new Date();
    await Promise.all(
      matchedEnvironments.map((environment) =>
        setEnvironmentSourceBuildState({
          environmentId: environment.id,
          status: 'building',
          sourceRef: ref,
          sourceCommitSha,
          startedAt: buildStartedAt,
        })
      )
    );

    try {
      await gateway.triggerReleaseBuild(session, {
        repoFullName: repository.fullName,
        ref,
        releaseRef: ref,
        sourceCommitSha,
        forceFullBuild: true,
      });
    } catch (error) {
      await Promise.all(
        matchedEnvironments.map((environment) =>
          setEnvironmentSourceBuildState({
            environmentId: environment.id,
            status: 'failed',
            sourceRef: ref,
            sourceCommitSha,
            startedAt: buildStartedAt,
          })
        )
      );
      throw error;
    }
    triggeredRefs.push(ref);

    scopedLogger.info('Triggered initial auto-deploy build', {
      ref,
      sourceCommitSha,
    });
  }

  await onProgress?.(
    100,
    buildInitialAutoDeploySummary({
      refs,
      triggeredRefs,
      missingRefs,
    })
  );
}

export async function setupNamespace(
  project: typeof projects.$inferSelect,
  onProgress?: StepProgressReporter
) {
  const envList = await db.query.environments.findMany({
    where: eq(environments.projectId, project.id),
  });

  if (envList.length === 0) {
    await onProgress?.(100, '没有需要创建的命名空间');
    return;
  }

  for (let index = 0; index < envList.length; index += 1) {
    const environment = envList[index];
    const namespace = await ensureEnvironmentNamespace({
      projectSlug: project.slug,
      environment: {
        id: environment.id,
        name: environment.name,
        namespace: environment.namespace,
        kind: environment.kind,
        isProduction: environment.isProduction,
        isPreview: environment.isPreview,
      },
    });

    await syncEnvVarsToK8s(project.id, environment.id).catch((error) =>
      projectInitLogger.warn('Failed to sync initial project variables to Kubernetes', {
        projectId: project.id,
        step: 'setup_namespace',
        environmentId: environment.id,
        namespace,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    );

    await onProgress?.(
      Math.round(((index + 1) / envList.length) * 100),
      `已登记 ${environment.name} 环境命名空间 ${namespace}`
    );
  }
}

export async function deployServices(
  project: typeof projects.$inferSelect,
  hasK8s: boolean,
  onProgress?: StepProgressReporter
) {
  const serviceList = await db.query.services.findMany({
    where: eq(services.projectId, project.id),
  });
  const environmentList = await db.query.environments.findMany({
    where: eq(environments.projectId, project.id),
  });

  if (!hasK8s) {
    projectInitLogger.warn('Skipping service deployment because Kubernetes is unavailable', {
      projectId: project.id,
      step: 'deploy_services',
    });
    await onProgress?.(100, '当前没有可用 Kubernetes，已跳过服务初始化');
    return;
  }

  if (serviceList.length === 0 || environmentList.length === 0) {
    await onProgress?.(100, '没有需要初始化的服务');
    return;
  }

  for (let i = 0; i < environmentList.length; i++) {
    const environment = environmentList[i];

    await reconcileEnvironmentState({
      project: {
        id: project.id,
        slug: project.slug,
        configJson: project.configJson,
      },
      environment: {
        id: environment.id,
        name: environment.name,
        namespace: environment.namespace,
        kind: environment.kind,
        isProduction: environment.isProduction,
        isPreview: environment.isPreview,
        deploymentStrategy: environment.deploymentStrategy,
      },
      services: serviceList,
      scope: 'runtime',
    });

    // Namespace is created during reconcileEnvironmentState. Sync env vars afterwards so
    // project-level variables and provisioned database credentials are present for first deploy.
    await syncEnvVarsToK8s(project.id, environment.id).catch((error) =>
      projectInitLogger.warn('Failed to sync environment variables after namespace creation', {
        projectId: project.id,
        step: 'deploy_services',
        environmentId: environment.id,
        namespace: environment.namespace,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    );

    await onProgress?.(
      Math.round(((i + 1) / environmentList.length) * 100),
      `已确保 ${environment.name} 环境基础服务`
    );
  }

  await db
    .update(services)
    .set({ status: 'pending', updatedAt: new Date() })
    .where(eq(services.projectId, project.id));
}

export async function provisionDatabases(
  project: typeof projects.$inferSelect,
  hasK8s: boolean,
  onProgress?: StepProgressReporter
) {
  const databaseList = await db.query.databases.findMany({
    where: eq(databases.projectId, project.id),
  });

  if (databaseList.length === 0) {
    await onProgress?.(100, '没有需要创建的数据库');
    return;
  }

  for (let i = 0; i < databaseList.length; i++) {
    const database = databaseList[i];
    await provisionDatabase(database, project, hasK8s);
    // Re-fetch updated record (connectionString now set) and inject env vars
    const updated = await db.query.databases.findFirst({
      where: eq(databases.id, database.id),
    });
    if (updated?.connectionString) {
      // Scope env vars to the database's environment (null = project-scoped)
      await injectDatabaseEnvVars(updated, project, updated.environmentId ?? null);
    }
    // Reserve last 10% for K8s sync
    await onProgress?.(
      Math.round(((i + 1) / databaseList.length) * 90),
      `数据库 ${database.name} 已完成供应`
    );
  }

  // Sync all injected env vars to K8s ConfigMap/Secret for each affected environment
  if (hasK8s) {
    const affectedEnvIds = [
      ...new Set(databaseList.map((d) => d.environmentId).filter(Boolean) as string[]),
    ];
    for (const envId of affectedEnvIds) {
      await syncEnvVarsToK8s(project.id, envId).catch((e) =>
        projectInitLogger.warn('Failed to sync environment variables to Kubernetes', {
          projectId: project.id,
          step: 'provision_databases',
          environmentId: envId,
          errorMessage: e instanceof Error ? e.message : String(e),
        })
      );
    }
  }

  await onProgress?.(100, '数据库配置与环境变量同步完成');
}

export async function configureDns(
  project: typeof projects.$inferSelect,
  hasK8s: boolean,
  onProgress?: StepProgressReporter
) {
  const serviceList = await db.query.services.findMany({
    where: eq(services.projectId, project.id),
  });
  const environmentList = await db.query.environments.findMany({
    where: eq(environments.projectId, project.id),
  });
  const domainList = await db.query.domains.findMany({
    where: eq(domains.projectId, project.id),
    columns: {
      environmentId: true,
    },
  });
  const domainEnvironmentIds = new Set(
    domainList
      .map((domain) => domain.environmentId)
      .filter((value): value is string => Boolean(value))
  );
  const targetEnvironments = environmentList.filter(
    (environment) => environment.kind === 'preview' || domainEnvironmentIds.has(environment.id)
  );

  if (targetEnvironments.length === 0) {
    await onProgress?.(100, '没有需要配置的域名');
    return;
  }

  if (!hasK8s) {
    await onProgress?.(100, '当前没有可用 Kubernetes，已跳过域名配置');
    return;
  }

  for (let i = 0; i < targetEnvironments.length; i++) {
    const environment = targetEnvironments[i];

    await reconcileEnvironmentState({
      project: {
        id: project.id,
        slug: project.slug,
        configJson: project.configJson,
      },
      environment: {
        id: environment.id,
        name: environment.name,
        namespace: environment.namespace,
        kind: environment.kind,
        isPreview: environment.isPreview,
        deploymentStrategy: environment.deploymentStrategy,
      },
      services: serviceList,
      scope: 'access',
    });

    await onProgress?.(
      Math.round(((i + 1) / targetEnvironments.length) * 100),
      `已确保 ${environment.name} 环境域名与路由`
    );
  }
}
