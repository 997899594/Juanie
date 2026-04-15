import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { DatabaseConfig, ServiceConfig } from '@/lib/config/parser';
import { normalizeDatabaseCapabilities } from '@/lib/databases/capabilities';
import { db } from '@/lib/db';
import type { InitStepStatus } from '@/lib/db/schema';
import {
  databases,
  deliveryRules,
  domains,
  environments,
  projectInitSteps,
  projects,
  promotionFlows,
  services,
  teamMembers,
  teams,
} from '@/lib/db/schema';
import { buildPrimaryEnvironmentHostname } from '@/lib/domains/defaults';
import { getTeamIntegrationSession } from '@/lib/integrations/service/integration-control-plane';
import { ensureRepository } from '@/lib/integrations/service/repository-service';
import type { CreateRuntimeProfile } from '@/lib/projects/create-defaults';
import {
  buildEnvironmentTopologyBlueprint,
  type CreateEnvironmentTemplate,
} from '@/lib/projects/environment-topology';
import { addProjectInitJob } from '@/lib/queue';

interface CreateProjectRequest {
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
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录', code: 'unauthorized' }, { status: 401 });
  }

  const userProjects = await db
    .select({
      project: projects,
      teamName: teams.name,
    })
    .from(projects)
    .innerJoin(teams, eq(teams.id, projects.teamId))
    .innerJoin(
      teamMembers,
      and(eq(teamMembers.teamId, teams.id), eq(teamMembers.userId, session.user.id))
    );

  return NextResponse.json(userProjects);
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录', code: 'unauthorized' }, { status: 401 });
    }

    const body: CreateProjectRequest = await request.json();
    const {
      mode,
      repositoryId,
      repositoryFullName,
      isPrivate,
      name,
      slug,
      description,
      teamId,
      services: serviceConfigs,
      databases: databaseConfigs,
      domain,
      useCustomDomain,
      productionBranch,
      autoDeploy,
      template,
      productionDeploymentStrategy,
      previewDatabaseStrategy,
      runtimeProfile,
      environmentTemplate,
    } = body;

    if (!teamId || !name || !slug) {
      return NextResponse.json(
        { error: '团队、名称和标识不能为空', code: 'project_create_failed' },
        { status: 400 }
      );
    }

    const teamMember = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, session.user.id)),
    });

    if (!teamMember || !['owner', 'admin', 'member'].includes(teamMember.role)) {
      return NextResponse.json(
        { error: '当前团队不可用于创建项目', code: 'team_scope_missing' },
        { status: 403 }
      );
    }

    const uniqueSlug = `${slug}-${nanoid(6).toLowerCase()}`;

    let integrationSession: Awaited<ReturnType<typeof getTeamIntegrationSession>> | null = null;

    if (mode === 'import') {
      try {
        integrationSession = await getTeamIntegrationSession({
          teamId,
          actingUserId: session.user.id,
          requiredCapabilities: ['read_repo'],
        });
      } catch {
        return NextResponse.json(
          { error: '当前团队没有可用的仓库读取授权', code: 'repo_read_missing' },
          { status: 403 }
        );
      }
    }

    if (mode === 'create') {
      try {
        await getTeamIntegrationSession({
          teamId,
          actingUserId: session.user.id,
          requiredCapabilities: ['write_repo'],
        });
      } catch {
        return NextResponse.json(
          { error: '当前团队没有可用的仓库创建授权', code: 'repo_write_missing' },
          { status: 403 }
        );
      }
    }

    // For import mode, ensure repository record exists
    let dbRepositoryId: string | null = null;
    if (mode === 'import' && repositoryId && repositoryFullName && integrationSession) {
      dbRepositoryId = await ensureRepository(repositoryId, repositoryFullName, integrationSession);
    }

    const topology = buildEnvironmentTopologyBlueprint({
      template: environmentTemplate ?? 'staging_production_preview',
      productionBranch,
      autoDeploy,
      productionDeploymentStrategy: productionDeploymentStrategy ?? 'controlled',
      previewDatabaseStrategy: previewDatabaseStrategy ?? 'inherit',
    });

    const importSteps: { step: string; status: InitStepStatus; progress: number }[] = [
      { step: 'validate_repository', status: 'pending', progress: 0 },
      { step: 'push_cicd_config', status: 'pending', progress: 0 },
      { step: 'configure_release_trigger', status: 'pending', progress: 0 },
      { step: 'setup_namespace', status: 'pending', progress: 0 },
      { step: 'provision_databases', status: 'pending', progress: 0 },
      { step: 'deploy_services', status: 'pending', progress: 0 },
      { step: 'configure_dns', status: 'pending', progress: 0 },
    ];

    const createSteps: { step: string; status: InitStepStatus; progress: number }[] = [
      { step: 'create_repository', status: 'pending', progress: 0 },
      { step: 'push_template', status: 'pending', progress: 0 },
      { step: 'push_cicd_config', status: 'pending', progress: 0 },
      { step: 'configure_release_trigger', status: 'pending', progress: 0 },
      { step: 'setup_namespace', status: 'pending', progress: 0 },
      { step: 'provision_databases', status: 'pending', progress: 0 },
      { step: 'deploy_services', status: 'pending', progress: 0 },
      { step: 'configure_dns', status: 'pending', progress: 0 },
    ];

    const initStepsData = mode === 'import' ? importSteps : createSteps;

    const project = await db.transaction(async (tx) => {
      const [createdProject] = await tx
        .insert(projects)
        .values({
          teamId,
          name,
          slug: uniqueSlug,
          description,
          repositoryId: dbRepositoryId,
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
          },
          status: 'initializing',
        })
        .returning();

      if (!createdProject) {
        throw new Error('Failed to create project');
      }

      const createdEnvironments = await tx
        .insert(environments)
        .values(
          topology.environments.map((environment) => ({
            projectId: createdProject.id,
            name: environment.name,
            kind: environment.kind,
            branch: environment.branch,
            autoDeploy: environment.autoDeploy,
            isProduction: environment.isProduction,
            databaseStrategy: environment.databaseStrategy,
            deploymentStrategy: environment.deploymentStrategy,
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

      if (!primaryEnvironment) {
        throw new Error('Failed to create primary environment');
      }

      await tx.insert(deliveryRules).values(
        topology.deliveryRules.map((rule) => {
          const environment = environmentByKey.get(rule.environmentKey);
          if (!environment) {
            throw new Error(
              `Failed to resolve environment for delivery rule ${rule.environmentKey}`
            );
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

      for (const dbConfig of databaseConfigs) {
        const provisionType = dbConfig.provisionType || 'standalone';
        await tx.insert(databases).values({
          projectId: createdProject.id,
          environmentId: primaryEnvironment.id,
          serviceId: dbConfig.service ? (createdServices.get(dbConfig.service) ?? null) : null,
          name: dbConfig.name,
          type: dbConfig.type,
          plan: dbConfig.plan || 'starter',
          provisionType,
          scope: dbConfig.scope || (dbConfig.service ? 'service' : 'project'),
          role: dbConfig.role || 'primary',
          capabilities: normalizeDatabaseCapabilities(dbConfig.capabilities),
          connectionString: provisionType === 'external' ? (dbConfig.externalUrl ?? null) : null,
          status: 'pending',
        });
      }

      if (useCustomDomain && domain) {
        await tx.insert(domains).values({
          projectId: createdProject.id,
          environmentId: primaryEnvironment.id,
          hostname: domain,
          isCustom: true,
          isVerified: false,
        });
      } else {
        await tx.insert(domains).values({
          projectId: createdProject.id,
          environmentId: primaryEnvironment.id,
          hostname: buildPrimaryEnvironmentHostname(slug),
          isCustom: false,
          isVerified: true,
        });
      }

      await tx.insert(projectInitSteps).values(
        initStepsData.map((s) => ({
          projectId: createdProject.id,
          step: s.step,
          status: s.status,
          progress: s.progress,
        }))
      );

      return createdProject;
    });

    try {
      await addProjectInitJob(project.id, mode, template);
    } catch (error) {
      console.error('Failed to queue project initialization:', error);
    }

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json(
      {
        error: '创建项目失败',
        code: 'project_create_failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
