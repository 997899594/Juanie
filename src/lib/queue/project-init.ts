import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projectInitSteps, projects } from '@/lib/db/schema';
import { isK8sAvailable } from '@/lib/k8s';
import { logger } from '@/lib/logger';
import { publishProjectInitRealtimeEvent } from '@/lib/realtime/project-init';
import { publishProjectRealtimeSnapshot } from '@/lib/realtime/projects';
import {
  configureDns,
  configureReleaseTrigger,
  createRepository,
  deployServices,
  loadProjectInitProject,
  type ProjectInitProjectRecord,
  provisionDatabases,
  pushCicdConfig,
  pushTemplate,
  setupNamespace,
  triggerInitialAutoDeployBuilds,
  validateRepository,
} from './project-init-activities';
import {
  getProjectInitSteps,
  isK8sBackedProjectInitStep,
  type ProjectInitErrorCode,
  type ProjectInitStepName,
  projectInitDefaultErrorCodes,
} from './project-init-steps';

const _isDev = process.env.NODE_ENV === 'development';
const projectInitLogger = logger.child({ component: 'project-init' });
export interface ProjectInitCommand {
  projectId: string;
  mode: 'import' | 'create';
  template?: string;
}

export { requiredCapabilitiesForStep } from './project-init-capabilities';

type StepProgressReporter = (progress: number, message?: string) => Promise<void>;

// ============================================
// Helper Functions
// ============================================

async function updateStepStatus(
  projectId: string,
  step: ProjectInitStepName,
  status: 'running' | 'completed' | 'failed' | 'skipped',
  data?: { message?: string; progress?: number; error?: string; errorCode?: ProjectInitErrorCode }
) {
  const hasField = (field: keyof NonNullable<typeof data>) =>
    Boolean(data && Object.hasOwn(data, field));

  const updatePayload: Record<string, unknown> = {
    status,
    startedAt: status === 'running' ? new Date() : undefined,
    completedAt: status === 'completed' || status === 'skipped' ? new Date() : undefined,
  };

  if (hasField('message')) {
    updatePayload.message =
      status === 'running' || status === 'completed' || status === 'skipped'
        ? (data?.message ?? null)
        : data?.message;
  }

  if (hasField('progress')) {
    updatePayload.progress = data?.progress ?? null;
  }

  if (hasField('errorCode')) {
    updatePayload.errorCode =
      status === 'running' || status === 'completed' || status === 'skipped'
        ? null
        : data?.errorCode;
  }

  if (hasField('error')) {
    updatePayload.error =
      status === 'running' || status === 'completed' || status === 'skipped' ? null : data?.error;
  }

  await db
    .update(projectInitSteps)
    .set(updatePayload)
    .where(and(eq(projectInitSteps.projectId, projectId), eq(projectInitSteps.step, step)));

  await publishProjectInitRealtimeEvent({
    kind: 'step_updated',
    projectId,
    step,
    status,
    progress: hasField('progress') ? (data?.progress ?? null) : null,
    timestamp: Date.now(),
  }).catch((error) => {
    projectInitLogger.warn('Failed to publish project init realtime event', {
      projectId,
      step,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  });
}

async function publishProjectInitCompletion(projectId: string) {
  await Promise.all([
    publishProjectInitRealtimeEvent({
      kind: 'completed',
      projectId,
      status: 'active',
      timestamp: Date.now(),
    }).catch((error) => {
      projectInitLogger.warn('Failed to publish project init completion event', {
        projectId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }),
    publishProjectRealtimeSnapshot(projectId).catch((error) => {
      projectInitLogger.warn('Failed to publish project realtime snapshot after init completion', {
        projectId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }),
  ]);
}

async function publishProjectInitFailureSnapshot(projectId: string) {
  await publishProjectRealtimeSnapshot(projectId).catch((error) => {
    projectInitLogger.warn('Failed to publish project realtime snapshot after init failure', {
      projectId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  });
}

function classifyProjectInitError(step: ProjectInitStepName, error: unknown): ProjectInitErrorCode {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (step === 'validate_repository') {
    if (message.includes('no repository linked')) return 'repository_missing';
    if (message.includes('no access to repository')) return 'repository_access_denied';
  }

  if (step === 'create_repository') {
    if (message.includes('write_repo') || message.includes('permission')) {
      return 'repository_create_denied';
    }
  }

  return projectInitDefaultErrorCodes[step] ?? 'init_step_failed';
}

interface ProjectInitExecutionContext {
  hasK8s: boolean;
  project: ProjectInitProjectRecord;
  reportStepProgress: StepProgressReporter;
  template?: string;
}

type ProjectInitStepRunner = (
  context: ProjectInitExecutionContext
) => Promise<ProjectInitProjectRecord | undefined>;

const projectInitStepRunners: Record<ProjectInitStepName, ProjectInitStepRunner> = {
  validate_repository: async ({ project, reportStepProgress }) => {
    await validateRepository(project, reportStepProgress);
    return undefined;
  },
  create_repository: async ({ project, reportStepProgress }) => {
    await createRepository(project, reportStepProgress);
    return (await loadProjectInitProject(project.id)) ?? project;
  },
  push_template: async ({ project, reportStepProgress, template }) => {
    await pushTemplate(project, template, reportStepProgress);
    return undefined;
  },
  push_cicd_config: async ({ project, reportStepProgress }) => {
    await pushCicdConfig(project, reportStepProgress);
    return undefined;
  },
  configure_release_trigger: async ({ project, reportStepProgress }) => {
    await configureReleaseTrigger(project, reportStepProgress);
    return undefined;
  },
  setup_namespace: async ({ project, reportStepProgress }) => {
    await setupNamespace(project, reportStepProgress);
    return undefined;
  },
  provision_databases: async ({ project, hasK8s, reportStepProgress }) => {
    await provisionDatabases(project, hasK8s, reportStepProgress);
    return undefined;
  },
  deploy_services: async ({ project, hasK8s, reportStepProgress }) => {
    await deployServices(project, hasK8s, reportStepProgress);
    return undefined;
  },
  configure_dns: async ({ project, hasK8s, reportStepProgress }) => {
    await configureDns(project, hasK8s, reportStepProgress);
    return undefined;
  },
  trigger_initial_builds: async ({ project, reportStepProgress }) => {
    await triggerInitialAutoDeployBuilds(project, reportStepProgress);
    return undefined;
  },
};

export async function prepareProjectInitialization(input: ProjectInitCommand): Promise<{
  steps: ProjectInitStepName[];
}> {
  const project = await loadProjectInitProject(input.projectId);
  if (!project) {
    throw new Error(`Project ${input.projectId} not found`);
  }

  await db
    .update(projects)
    .set({ status: 'initializing', statusMessage: null, updatedAt: new Date() })
    .where(eq(projects.id, input.projectId));

  return { steps: [...getProjectInitSteps(input.mode)] };
}

export async function runProjectInitializationStep(input: {
  projectId: string;
  step: ProjectInitStepName;
  template?: string;
}): Promise<{ status: 'completed' | 'skipped' }> {
  const existingStep = await db.query.projectInitSteps.findFirst({
    where: and(
      eq(projectInitSteps.projectId, input.projectId),
      eq(projectInitSteps.step, input.step)
    ),
    columns: { status: true },
  });
  if (existingStep?.status === 'completed' || existingStep?.status === 'skipped') {
    return { status: existingStep.status };
  }

  const project = await loadProjectInitProject(input.projectId);
  if (!project) {
    throw new Error(`Project ${input.projectId} not found`);
  }

  const hasK8s = isK8sAvailable();
  const reportStepProgress: StepProgressReporter = (progress, message) =>
    updateStepStatus(input.projectId, input.step, 'running', {
      progress,
      ...(message !== undefined ? { message } : {}),
    });

  await updateStepStatus(input.projectId, input.step, 'running', {
    progress: 0,
  });

  await projectInitStepRunners[input.step]({
    project,
    template: input.template,
    hasK8s,
    reportStepProgress,
  });

  const skipped = !hasK8s && isK8sBackedProjectInitStep(input.step);
  const status = skipped ? 'skipped' : 'completed';
  await updateStepStatus(input.projectId, input.step, status, {
    progress: 100,
    message: skipped ? 'Skipped (no K8s cluster)' : undefined,
  });
  return { status };
}

export async function completeProjectInitialization(projectId: string): Promise<void> {
  await db
    .update(projects)
    .set({ status: 'active', statusMessage: null, updatedAt: new Date() })
    .where(eq(projects.id, projectId));
  await publishProjectInitCompletion(projectId);
}

export async function failProjectInitialization(input: {
  projectId: string;
  step: ProjectInitStepName;
  error: unknown;
}): Promise<void> {
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  await updateStepStatus(input.projectId, input.step, 'failed', {
    error: message,
    errorCode: classifyProjectInitError(input.step, input.error),
    message: '自动重试已用尽，请处理错误后手动重试',
  });
  await db
    .update(projects)
    .set({ status: 'failed', statusMessage: message, updatedAt: new Date() })
    .where(eq(projects.id, input.projectId));
  await publishProjectInitFailureSnapshot(input.projectId);
}
