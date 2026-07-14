import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull, lte, or, sql } from 'drizzle-orm';
import {
  generateEnvironmentCopilotReply,
  generateReleaseCopilotReply,
} from '@/lib/ai/copilot/service';
import { type AITaskKind, getAITaskDefinition } from '@/lib/ai/tasks/catalog';
import { createAuditLog } from '@/lib/audit';
import { db } from '@/lib/db';
import { aiTasks, environments, releases } from '@/lib/db/schema';
import { logger } from '@/lib/logger';

export interface GenericAITaskRecord {
  id: string;
  kind: AITaskKind;
  title: string;
  inputSummary: string;
  resultSummary: string | null;
  errorMessage: string | null;
  provider: string | null;
  model: string | null;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  createdAt: Date;
  completedAt: Date | null;
}

const AI_TASK_LEASE_DURATION_MS = 5 * 60_000;
const AI_TASK_HEARTBEAT_INTERVAL_MS = 60_000;
const aiTaskLogger = logger.child({ component: 'ai-task-execution' });

export class AITaskLeaseLostError extends Error {
  constructor(taskId: string) {
    super(`AI task execution lease lost: ${taskId}`);
    this.name = 'AITaskLeaseLostError';
  }
}

const deepAnalysisSystemAppendix =
  '这是一个后台深度分析任务。输出请完整但克制，优先使用 3 段：当前状态、关键风险、处理建议。';

async function claimAITaskExecution(input: {
  taskId: string;
  kind: AITaskKind;
  leaseToken: string;
  now: Date;
}): Promise<Awaited<ReturnType<typeof getQueuedAITaskOrThrow>> | null> {
  const [task] = await db
    .update(aiTasks)
    .set({
      status: 'running',
      leaseToken: input.leaseToken,
      leaseExpiresAt: new Date(input.now.getTime() + AI_TASK_LEASE_DURATION_MS),
      heartbeatAt: input.now,
      startedAt: sql`coalesce(${aiTasks.startedAt}, ${input.now})`,
      completedAt: null,
      errorMessage: null,
      updatedAt: input.now,
    })
    .where(
      and(
        eq(aiTasks.id, input.taskId),
        eq(aiTasks.kind, input.kind),
        or(
          eq(aiTasks.status, 'queued'),
          and(
            eq(aiTasks.status, 'running'),
            or(isNull(aiTasks.leaseExpiresAt), lte(aiTasks.leaseExpiresAt, input.now))
          )
        )
      )
    )
    .returning();

  return task ?? null;
}

async function heartbeatAITask(taskId: string, leaseToken: string): Promise<void> {
  const now = new Date();
  const [task] = await db
    .update(aiTasks)
    .set({
      heartbeatAt: now,
      leaseExpiresAt: new Date(now.getTime() + AI_TASK_LEASE_DURATION_MS),
      updatedAt: now,
    })
    .where(
      and(eq(aiTasks.id, taskId), eq(aiTasks.status, 'running'), eq(aiTasks.leaseToken, leaseToken))
    )
    .returning({ id: aiTasks.id });

  if (!task) throw new AITaskLeaseLostError(taskId);
}

async function markAITaskSucceeded(input: {
  taskId: string;
  reply: {
    message: string;
    provider: string | null;
    model: string | null;
  };
  leaseToken: string;
}): Promise<GenericAITaskRecord> {
  const [completedTask] = await db
    .update(aiTasks)
    .set({
      status: 'succeeded',
      resultSummary: input.reply.message,
      provider: input.reply.provider,
      model: input.reply.model,
      completedAt: new Date(),
      leaseToken: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(aiTasks.id, input.taskId),
        eq(aiTasks.status, 'running'),
        eq(aiTasks.leaseToken, input.leaseToken)
      )
    )
    .returning();

  if (!completedTask) throw new AITaskLeaseLostError(input.taskId);
  return completedTask;
}

async function markAITaskFailed(
  taskId: string,
  leaseToken: string,
  error: unknown
): Promise<GenericAITaskRecord> {
  const message = error instanceof Error ? error.message : 'AI 任务执行失败';
  const [failedTask] = await db
    .update(aiTasks)
    .set({
      status: 'failed',
      errorMessage: message,
      completedAt: new Date(),
      leaseToken: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(aiTasks.id, taskId), eq(aiTasks.status, 'running'), eq(aiTasks.leaseToken, leaseToken))
    )
    .returning();

  if (!failedTask) throw new AITaskLeaseLostError(taskId);
  return failedTask;
}

async function getQueuedAITaskOrThrow(taskId: string): Promise<
  GenericAITaskRecord & {
    teamId: string;
    projectId: string | null;
    environmentId: string | null;
    releaseId: string | null;
    actorUserId: string | null;
  }
> {
  const task = await db.query.aiTasks.findFirst({
    where: eq(aiTasks.id, taskId),
  });

  if (!task) {
    throw new Error('AI 任务不存在');
  }

  return task;
}

async function executeDeepAnalysisTask(input: {
  taskId: string;
  kind: AITaskKind;
  generateReply: (task: Awaited<ReturnType<typeof getQueuedAITaskOrThrow>>) => Promise<{
    message: string;
    provider: string | null;
    model: string | null;
  }>;
}): Promise<GenericAITaskRecord> {
  const leaseToken = randomUUID();
  const task = await claimAITaskExecution({
    taskId: input.taskId,
    kind: input.kind,
    leaseToken,
    now: new Date(),
  });
  if (!task) {
    return getQueuedAITaskOrThrow(input.taskId);
  }

  const heartbeat = setInterval(() => {
    heartbeatAITask(input.taskId, leaseToken).catch((error) => {
      aiTaskLogger.warn('AI task heartbeat failed', {
        taskId: input.taskId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    });
  }, AI_TASK_HEARTBEAT_INTERVAL_MS);

  try {
    const reply = await input.generateReply(task);
    return markAITaskSucceeded({
      taskId: input.taskId,
      reply,
      leaseToken,
    });
  } catch (error) {
    if (error instanceof AITaskLeaseLostError) throw error;
    return markAITaskFailed(input.taskId, leaseToken, error);
  } finally {
    clearInterval(heartbeat);
  }
}

async function createAITaskRecord(input: {
  kind: AITaskKind;
  actorUserId: string;
  teamId: string;
  projectId: string;
  question: string;
  environmentId?: string | null;
  releaseId?: string | null;
}): Promise<GenericAITaskRecord> {
  const definition = getAITaskDefinition(input.kind);
  const [createdTask] = await db
    .insert(aiTasks)
    .values({
      kind: input.kind,
      status: 'queued',
      title: definition.buildTitle(input.question),
      actorUserId: input.actorUserId,
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: input.environmentId ?? null,
      releaseId: input.releaseId ?? null,
      inputSummary: input.question,
    })
    .returning();

  await createAuditLog({
    teamId: input.teamId,
    userId: input.actorUserId,
    action: 'ai.task_requested',
    resourceType: definition.resourceType,
    resourceId:
      definition.resourceType === 'release'
        ? (input.releaseId ?? undefined)
        : (input.environmentId ?? undefined),
    metadata: {
      taskId: createdTask.id,
      taskKind: createdTask.kind,
      projectId: input.projectId,
      environmentId: input.environmentId ?? undefined,
    },
  }).catch(() => undefined);

  return createdTask;
}

export async function executeEnvironmentDeepAnalysisTask(
  taskId: string
): Promise<GenericAITaskRecord> {
  return executeDeepAnalysisTask({
    taskId,
    kind: 'environment_deep_analysis',
    generateReply: async (task) => {
      if (!task.projectId || !task.environmentId) {
        throw new Error('AI 任务不存在');
      }

      return generateEnvironmentCopilotReply({
        teamId: task.teamId,
        projectId: task.projectId,
        environmentId: task.environmentId,
        actorUserId: task.actorUserId,
        messages: [{ role: 'user', content: task.inputSummary }],
        policy: 'structured-high-quality',
        systemAppendix: deepAnalysisSystemAppendix,
      });
    },
  });
}

export async function executeReleaseDeepAnalysisTask(taskId: string): Promise<GenericAITaskRecord> {
  return executeDeepAnalysisTask({
    taskId,
    kind: 'release_deep_analysis',
    generateReply: async (task) => {
      if (!task.projectId || !task.releaseId) {
        throw new Error('AI 任务不存在');
      }

      return generateReleaseCopilotReply({
        teamId: task.teamId,
        projectId: task.projectId,
        releaseId: task.releaseId,
        actorUserId: task.actorUserId,
        messages: [{ role: 'user', content: task.inputSummary }],
        policy: 'structured-high-quality',
        systemAppendix: deepAnalysisSystemAppendix,
      });
    },
  });
}

export async function executeAITask(
  taskId: string,
  kind: AITaskKind
): Promise<GenericAITaskRecord> {
  if (kind === 'environment_deep_analysis') {
    return executeEnvironmentDeepAnalysisTask(taskId);
  }

  return executeReleaseDeepAnalysisTask(taskId);
}

export async function createEnvironmentDeepAnalysisTask(input: {
  projectId: string;
  environmentId: string;
  actorUserId: string;
  question: string;
}): Promise<GenericAITaskRecord> {
  const environment = await db.query.environments.findFirst({
    where: and(
      eq(environments.id, input.environmentId),
      eq(environments.projectId, input.projectId)
    ),
    columns: {
      id: true,
      name: true,
      projectId: true,
    },
    with: {
      project: {
        columns: {
          teamId: true,
        },
      },
    },
  });

  if (!environment) {
    throw new Error('环境不存在');
  }

  return createAITaskRecord({
    kind: 'environment_deep_analysis',
    actorUserId: input.actorUserId,
    teamId: environment.project.teamId,
    projectId: input.projectId,
    question: input.question,
    environmentId: input.environmentId,
  });
}

export async function createReleaseDeepAnalysisTask(input: {
  projectId: string;
  releaseId: string;
  actorUserId: string;
  question: string;
}): Promise<GenericAITaskRecord> {
  const release = await db.query.releases.findFirst({
    where: and(eq(releases.id, input.releaseId), eq(releases.projectId, input.projectId)),
    columns: {
      id: true,
      environmentId: true,
      projectId: true,
    },
    with: {
      project: {
        columns: {
          teamId: true,
        },
      },
    },
  });

  if (!release) {
    throw new Error('发布不存在');
  }

  return createAITaskRecord({
    kind: 'release_deep_analysis',
    actorUserId: input.actorUserId,
    teamId: release.project.teamId,
    projectId: input.projectId,
    question: input.question,
    environmentId: release.environmentId,
    releaseId: input.releaseId,
  });
}

export async function listRecentEnvironmentAITasks(input: {
  projectId: string;
  environmentId: string;
  limit?: number;
}): Promise<GenericAITaskRecord[]> {
  return db.query.aiTasks.findMany({
    where: and(
      eq(aiTasks.projectId, input.projectId),
      eq(aiTasks.environmentId, input.environmentId)
    ),
    orderBy: [desc(aiTasks.createdAt)],
    limit: input.limit ?? 3,
  });
}

export async function listRecentReleaseAITasks(input: {
  projectId: string;
  releaseId: string;
  limit?: number;
}): Promise<GenericAITaskRecord[]> {
  return db.query.aiTasks.findMany({
    where: and(eq(aiTasks.projectId, input.projectId), eq(aiTasks.releaseId, input.releaseId)),
    orderBy: [desc(aiTasks.createdAt)],
    limit: input.limit ?? 3,
  });
}
