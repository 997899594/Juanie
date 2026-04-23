import { and, desc, eq } from 'drizzle-orm';
import {
  generateEnvironmentCopilotReply,
  generateReleaseCopilotReply,
} from '@/lib/ai/copilot/service';
import { createAuditLog } from '@/lib/audit';
import { db } from '@/lib/db';
import { aiTasks, environments, releases } from '@/lib/db/schema';

export interface GenericAITaskRecord {
  id: string;
  kind: 'environment_deep_analysis' | 'release_deep_analysis';
  title: string;
  inputSummary: string;
  resultSummary: string | null;
  errorMessage: string | null;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  createdAt: Date;
  completedAt: Date | null;
}

export async function executeEnvironmentDeepAnalysisTask(
  taskId: string
): Promise<GenericAITaskRecord> {
  const task = await db.query.aiTasks.findFirst({
    where: eq(aiTasks.id, taskId),
  });

  if (!task || !task.projectId || !task.environmentId) {
    throw new Error('AI 任务不存在');
  }

  await db
    .update(aiTasks)
    .set({
      status: 'running',
      startedAt: new Date(),
      errorMessage: null,
    })
    .where(eq(aiTasks.id, taskId));

  try {
    const reply = await generateEnvironmentCopilotReply({
      teamId: task.teamId,
      projectId: task.projectId,
      environmentId: task.environmentId,
      actorUserId: task.actorUserId,
      messages: [{ role: 'user', content: task.inputSummary }],
      policy: 'structured-high-quality',
      systemAppendix:
        '这是一个会进入任务中心的深度分析任务。输出请更完整一些，但仍然保持清楚、克制。优先使用 3 段：当前状态、关键风险、下一步。',
    });

    const [completedTask] = await db
      .update(aiTasks)
      .set({
        status: 'succeeded',
        resultSummary: reply.message,
        provider: reply.provider,
        model: reply.model,
        completedAt: new Date(),
      })
      .where(eq(aiTasks.id, taskId))
      .returning();

    return completedTask;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 任务执行失败';
    const [failedTask] = await db
      .update(aiTasks)
      .set({
        status: 'failed',
        errorMessage: message,
        completedAt: new Date(),
      })
      .where(eq(aiTasks.id, taskId))
      .returning();

    return failedTask;
  }
}

export async function executeReleaseDeepAnalysisTask(taskId: string): Promise<GenericAITaskRecord> {
  const task = await db.query.aiTasks.findFirst({
    where: eq(aiTasks.id, taskId),
  });

  if (!task || !task.projectId || !task.releaseId) {
    throw new Error('AI 任务不存在');
  }

  await db
    .update(aiTasks)
    .set({
      status: 'running',
      startedAt: new Date(),
      errorMessage: null,
    })
    .where(eq(aiTasks.id, taskId));

  try {
    const reply = await generateReleaseCopilotReply({
      teamId: task.teamId,
      projectId: task.projectId,
      releaseId: task.releaseId,
      actorUserId: task.actorUserId,
      messages: [{ role: 'user', content: task.inputSummary }],
      policy: 'structured-high-quality',
      systemAppendix:
        '这是一个会进入任务中心的深度分析任务。输出请更完整一些，但仍然保持清楚、克制。优先使用 3 段：当前状态、关键风险、下一步。',
    });

    const [completedTask] = await db
      .update(aiTasks)
      .set({
        status: 'succeeded',
        resultSummary: reply.message,
        provider: reply.provider,
        model: reply.model,
        completedAt: new Date(),
      })
      .where(eq(aiTasks.id, taskId))
      .returning();

    return completedTask;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 任务执行失败';
    const [failedTask] = await db
      .update(aiTasks)
      .set({
        status: 'failed',
        errorMessage: message,
        completedAt: new Date(),
      })
      .where(eq(aiTasks.id, taskId))
      .returning();

    return failedTask;
  }
}

function buildEnvironmentTaskTitle(question: string): string {
  return question.length > 36 ? `${question.slice(0, 36)}...` : question;
}

function buildReleaseTaskTitle(question: string): string {
  return question.length > 36 ? `${question.slice(0, 36)}...` : question;
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

  const [createdTask] = await db
    .insert(aiTasks)
    .values({
      kind: 'environment_deep_analysis',
      status: 'queued',
      title: buildEnvironmentTaskTitle(input.question),
      actorUserId: input.actorUserId,
      teamId: environment.project.teamId,
      projectId: input.projectId,
      environmentId: input.environmentId,
      inputSummary: input.question,
    })
    .returning();

  await createAuditLog({
    teamId: environment.project.teamId,
    userId: input.actorUserId,
    action: 'ai.task_requested',
    resourceType: 'environment',
    resourceId: input.environmentId,
    metadata: {
      taskId: createdTask.id,
      taskKind: createdTask.kind,
      projectId: input.projectId,
    },
  }).catch(() => undefined);

  return createdTask;
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

  const [createdTask] = await db
    .insert(aiTasks)
    .values({
      kind: 'release_deep_analysis',
      status: 'queued',
      title: buildReleaseTaskTitle(input.question),
      actorUserId: input.actorUserId,
      teamId: release.project.teamId,
      projectId: input.projectId,
      environmentId: release.environmentId,
      releaseId: input.releaseId,
      inputSummary: input.question,
    })
    .returning();

  await createAuditLog({
    teamId: release.project.teamId,
    userId: input.actorUserId,
    action: 'ai.task_requested',
    resourceType: 'release',
    resourceId: input.releaseId,
    metadata: {
      taskId: createdTask.id,
      taskKind: createdTask.kind,
      projectId: input.projectId,
      environmentId: release.environmentId,
    },
  }).catch(() => undefined);

  return createdTask;
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
