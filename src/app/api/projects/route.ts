import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { DatabaseConfig, ServiceConfig } from '@/lib/config/parser';
import { db } from '@/lib/db';
import type { InitStepStatus } from '@/lib/db/schema';
import {
  databases,
  domains,
  environments,
  projectInitSteps,
  projects,
  repositories,
  services,
  teamMembers,
  teams,
} from '@/lib/db/schema';
import { getTeamIntegrationSession } from '@/lib/integrations/service/integration-control-plane';
import { ensureRepository } from '@/lib/integrations/service/repository-service';
import { addProjectInitJob } from '@/lib/queue';

interface CreateProjectRequest {
  mode: 'import' | 'create';
  repositoryId?: string;
  repositoryName?: string;
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
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateProjectRequest = await request.json();
    const {
      mode,
      repositoryId,
      repositoryName,
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
    } = body;

    if (!teamId || !name || !slug) {
      return NextResponse.json({ error: 'Team ID, name, and slug are required' }, { status: 400 });
    }

    const teamMember = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, session.user.id)),
    });

    if (!teamMember || !['owner', 'admin', 'member'].includes(teamMember.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const uniqueSlug = `${slug}-${nanoid(6).toLowerCase()}`;

    // For import mode, ensure repository record exists
    let dbRepositoryId: string | null = null;
    if (mode === 'import' && repositoryId && repositoryFullName) {
      const integrationSession = await getTeamIntegrationSession({
        teamId,
        requiredCapabilities: ['read_repo'],
      });

      dbRepositoryId = await ensureRepository(repositoryId, repositoryFullName, integrationSession);
    }

    const [project] = await db
      .insert(projects)
      .values({
        teamId,
        name,
        slug: uniqueSlug,
        description,
        repositoryId: dbRepositoryId,
        productionBranch,
        autoDeploy,
        status: 'initializing',
      })
      .returning();

    const [prodEnv] = await db
      .insert(environments)
      .values({
        projectId: project.id,
        name: 'production',
        branch: productionBranch,
        tagPattern: 'v*',
      })
      .returning();

    for (const serviceConfig of serviceConfigs) {
      await db.insert(services).values({
        projectId: project.id,
        name: serviceConfig.name,
        type: serviceConfig.type,
        buildCommand: serviceConfig.build?.command,
        startCommand: serviceConfig.run?.command,
        port: serviceConfig.run?.port,
        cronSchedule: serviceConfig.type === 'cron' ? serviceConfig.schedule : null,
        replicas: 1,
        status: 'pending',
      });
    }

    for (const dbConfig of databaseConfigs) {
      const provisionType = dbConfig.provisionType || 'standalone';
      await db.insert(databases).values({
        projectId: project.id,
        name: dbConfig.name,
        type: dbConfig.type,
        plan: dbConfig.plan || 'starter',
        provisionType,
        connectionString: provisionType === 'external' ? (dbConfig.externalUrl ?? null) : null,
        status: 'pending',
      });
    }

    if (useCustomDomain && domain) {
      await db.insert(domains).values({
        projectId: project.id,
        environmentId: prodEnv.id,
        hostname: domain,
        isCustom: true,
        isVerified: false,
      });
    } else {
      await db.insert(domains).values({
        projectId: project.id,
        environmentId: prodEnv.id,
        hostname: `${slug}.juanie.art`,
        isCustom: false,
        isVerified: true,
      });
    }

    const importSteps: { step: string; status: InitStepStatus; progress: number }[] = [
      { step: 'validate_repository', status: 'pending', progress: 0 },
      { step: 'push_cicd_config', status: 'pending', progress: 0 },
      { step: 'setup_registry_webhook', status: 'pending', progress: 0 },
      { step: 'setup_namespace', status: 'pending', progress: 0 },
      { step: 'deploy_services', status: 'pending', progress: 0 },
      { step: 'provision_databases', status: 'pending', progress: 0 },
      { step: 'configure_dns', status: 'pending', progress: 0 },
    ];

    const createSteps: { step: string; status: InitStepStatus; progress: number }[] = [
      { step: 'create_repository', status: 'pending', progress: 0 },
      { step: 'push_template', status: 'pending', progress: 0 },
      { step: 'setup_registry_webhook', status: 'pending', progress: 0 },
      { step: 'setup_namespace', status: 'pending', progress: 0 },
      { step: 'deploy_services', status: 'pending', progress: 0 },
      { step: 'provision_databases', status: 'pending', progress: 0 },
      { step: 'configure_dns', status: 'pending', progress: 0 },
    ];

    const initStepsData = mode === 'import' ? importSteps : createSteps;

    await db.insert(projectInitSteps).values(
      initStepsData.map((s) => ({
        projectId: project.id,
        step: s.step,
        status: s.status,
        progress: s.progress,
      }))
    );

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
        error: 'Failed to create project',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
