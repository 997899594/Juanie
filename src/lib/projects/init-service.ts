import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projectInitSteps, projects, teamMembers } from '@/lib/db/schema';
import { buildProjectInitOverview } from '@/lib/projects/init-view';

type ProjectInitMode = 'import' | 'create';

export interface ProjectInitPageData {
  project: {
    id: string;
    name: string;
    status: string | null;
  };
  overview: ReturnType<typeof buildProjectInitOverview>;
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
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    return null;
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, userId)),
  });

  if (!member) {
    return null;
  }

  const steps = await db.query.projectInitSteps.findMany({
    where: eq(projectInitSteps.projectId, projectId),
    orderBy: (step, { asc }) => [asc(step.createdAt)],
  });

  const failedStepIndex = steps.findIndex((step) => step.status === 'failed');
  if (failedStepIndex < 0) {
    return null;
  }

  const metadata = resolveProjectInitMode(project.configJson, steps);
  const overview = buildProjectInitOverview(
    steps.map((step) => ({
      id: step.id,
      step: step.step,
      status: step.status,
      message: step.message,
      progress: step.progress,
      errorCode: step.errorCode,
      error: step.error,
    }))
  );

  return {
    projectId: project.id,
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
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    return null;
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, userId)),
  });

  if (!member) {
    return null;
  }

  const steps = await db.query.projectInitSteps.findMany({
    where: eq(projectInitSteps.projectId, projectId),
    orderBy: (step, { asc }) => [asc(step.createdAt)],
  });

  return {
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
    },
    overview: buildProjectInitOverview(
      steps.map((step) => ({
        id: step.id,
        step: step.step,
        status: step.status,
        message: step.message,
        progress: step.progress,
        errorCode: step.errorCode,
        error: step.error,
      }))
    ),
  };
}
