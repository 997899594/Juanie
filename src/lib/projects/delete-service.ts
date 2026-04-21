import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { addProjectDeleteJob } from '@/lib/queue';
import { publishProjectRealtimeSnapshot } from '@/lib/realtime/projects';

export interface ProjectDeletionRequestResult {
  status: 'deleting';
  alreadyDeleting: boolean;
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
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  if (project.status === 'deleting') {
    await addProjectDeleteJob(projectId);
    await publishProjectRealtimeSnapshot(projectId).catch((error) => {
      projectDeleteServiceLogger.warn('Failed to publish deleting project snapshot', {
        projectId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    });
    return {
      status: 'deleting',
      alreadyDeleting: true,
    };
  }

  const previousStatus = project.status ?? 'active';
  await db
    .update(projects)
    .set({
      status: 'deleting',
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));

  try {
    await addProjectDeleteJob(projectId);
  } catch (error) {
    await db
      .update(projects)
      .set({
        status: previousStatus,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));
    throw error;
  }

  await publishProjectRealtimeSnapshot(projectId).catch((error) => {
    projectDeleteServiceLogger.warn('Failed to publish deleting project snapshot', {
      projectId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  });

  return {
    status: 'deleting',
    alreadyDeleting: false,
  };
}
