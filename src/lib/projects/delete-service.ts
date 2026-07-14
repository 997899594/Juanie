import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { enqueueOutboxMessage } from '@/lib/outbox/service';
import { publishProjectRealtimeSnapshot } from '@/lib/realtime/projects';

export interface ProjectDeletionRequestResult {
  status: 'deleting';
  alreadyDeleting: boolean;
  commandId: string | null;
  statusMessage: string | null;
}

const projectDeleteServiceLogger = logger.child({ component: 'project-delete-service' });

export async function requestProjectDeletion(
  projectId: string
): Promise<ProjectDeletionRequestResult> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: {
      id: true,
      status: true,
      statusMessage: true,
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  if (project.status === 'deleting') {
    await publishProjectRealtimeSnapshot(projectId).catch((error) => {
      projectDeleteServiceLogger.warn('Failed to publish deleting project snapshot', {
        projectId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    });
    return {
      status: 'deleting',
      alreadyDeleting: true,
      commandId: null,
      statusMessage: project.statusMessage ?? null,
    };
  }

  const commandId = randomUUID();
  await db.transaction(async (tx) => {
    await tx
      .update(projects)
      .set({
        status: 'deleting',
        statusMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));
    await enqueueOutboxMessage(tx, {
      topic: 'project.delete.requested',
      aggregateType: 'project',
      aggregateId: projectId,
      commandId,
      payload: { deletionAttemptId: commandId },
    });
  });

  await publishProjectRealtimeSnapshot(projectId).catch((error) => {
    projectDeleteServiceLogger.warn('Failed to publish deleting project snapshot', {
      projectId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  });

  return {
    status: 'deleting',
    alreadyDeleting: false,
    commandId,
    statusMessage: null,
  };
}
