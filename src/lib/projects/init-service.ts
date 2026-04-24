import { eq } from 'drizzle-orm';
import { getProjectAccessOrNull } from '@/lib/api/page-access';
import { db } from '@/lib/db';
import { environments, projectInitSteps, projects } from '@/lib/db/schema';
import { buildProjectInitOverview } from '@/lib/projects/init-view';
import { resolveProjectRuntimeStatus } from '@/lib/projects/runtime-status';

type ProjectInitMode = 'import' | 'create';

export interface ProjectInitPageData {
  project: {
    id: string;
    name: string;
    status: string | null;
  };
  overview: ReturnType<typeof buildProjectInitOverview>;
}

function mapProjectInitStep(step: typeof projectInitSteps.$inferSelect) {
  return {
    id: step.id,
    step: step.step,
    status: step.status,
    message: step.message,
    progress: step.progress,
    errorCode: step.errorCode,
    error: step.error,
  };
}

export async function getProjectInitOverviewSnapshot(projectId: string) {
  const [steps, project] = await Promise.all([
    db.query.projectInitSteps.findMany({
      where: eq(projectInitSteps.projectId, projectId),
      orderBy: (step, { asc }) => [asc(step.createdAt)],
    }),
    db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: {
        id: true,
        status: true,
      },
      with: {
        environments: {
          columns: {
            id: true,
            name: true,
            isPreview: true,
            deliveryMode: true,
            previewBuildStatus: true,
          },
        },
      },
    }),
  ]);

  return buildProjectInitOverview(steps.map(mapProjectInitStep), {
    projectId,
    runtimeStatus: project
      ? resolveProjectRuntimeStatus({
          status: project.status,
          environments: project.environments,
        })
      : null,
  });
}

function resolveProjectInitMode(
  configJson: unknown,
  steps: Array<{ step: string }>
): { mode: ProjectInitMode; template?: string } {
  const config = (configJson as Record<string, unknown> | null) ?? null;
  const initConfig =
    config && typeof config.projectInit === 'object' && config.projectInit
      ? (config.projectInit as Record<string, unknown>)
      : null;

  const mode =
    initConfig?.mode === 'import' || initConfig?.mode === 'create'
      ? (initConfig.mode as ProjectInitMode)
      : steps.some((step) => step.step === 'create_repository')
        ? 'create'
        : 'import';

  const template =
    typeof initConfig?.template === 'string' && initConfig.template.length > 0
      ? initConfig.template
      : undefined;

  return { mode, template };
}

export async function getProjectInitRetryContext(
  projectId: string,
  userId: string
): Promise<{
  projectId: string;
  mode: ProjectInitMode;
  template?: string;
  failedStepId: string;
  failedStepOrder: number;
  retryAllowed: boolean;
  retryBlockedReason: string | null;
} | null> {
  const access = await getProjectAccessOrNull(projectId, userId);
  if (!access) {
    return null;
  }

  const [projectEnvironments, steps] = await Promise.all([
    db.query.environments.findMany({
      where: eq(environments.projectId, access.project.id),
      columns: {
        id: true,
        name: true,
        isPreview: true,
        deliveryMode: true,
        previewBuildStatus: true,
      },
    }),
    db.query.projectInitSteps.findMany({
      where: eq(projectInitSteps.projectId, projectId),
      orderBy: (step, { asc }) => [asc(step.createdAt)],
    }),
  ]);

  const failedStepIndex = steps.findIndex((step) => step.status === 'failed');
  if (failedStepIndex < 0) {
    return null;
  }

  const metadata = resolveProjectInitMode(access.project.configJson, steps);
  const overview = buildProjectInitOverview(steps.map(mapProjectInitStep), {
    projectId: access.project.id,
    runtimeStatus: resolveProjectRuntimeStatus({
      status: access.project.status,
      environments: projectEnvironments,
    }),
  });

  return {
    projectId: access.project.id,
    mode: metadata.mode,
    template: metadata.template,
    failedStepId: steps[failedStepIndex].id,
    failedStepOrder: failedStepIndex,
    retryAllowed: overview.recoveryAction?.kind === 'retry',
    retryBlockedReason:
      overview.recoveryAction?.kind === 'link'
        ? `当前错误需要先处理：${overview.recoveryAction.label}`
        : overview.recoveryAction?.kind === 'wait'
          ? '当前错误已进入平台自动重试，请稍候'
          : null,
  };
}

export async function getProjectInitPageData(
  projectId: string,
  userId: string
): Promise<ProjectInitPageData | null> {
  const access = await getProjectAccessOrNull(projectId, userId);
  if (!access) {
    return null;
  }

  const projectEnvironments = await db.query.environments.findMany({
    where: eq(environments.projectId, access.project.id),
    columns: {
      id: true,
      name: true,
      isPreview: true,
      deliveryMode: true,
      previewBuildStatus: true,
    },
  });

  return {
    project: {
      id: access.project.id,
      name: access.project.name,
      status: resolveProjectRuntimeStatus({
        status: access.project.status,
        environments: projectEnvironments,
      }).status,
    },
    overview: await getProjectInitOverviewSnapshot(projectId),
  };
}
