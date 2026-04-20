import { Job, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { environments, projects } from '@/lib/db/schema';
import { deleteNamespace, getIsConnected, initK8sClient, waitForNamespaceDeleted } from '@/lib/k8s';
import {
  publishProjectDeletedRealtimeEvent,
  publishProjectRealtimeSnapshot,
} from '@/lib/realtime/projects';
import { resolveRedisConnectionOptions } from '@/lib/redis/config';
import type { ProjectDeleteJobData } from './index';

export async function processProjectDelete(job: Job<ProjectDeleteJobData>) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, job.data.projectId),
    columns: {
      id: true,
      status: true,
    },
  });

  if (!project) {
    await publishProjectDeletedRealtimeEvent(job.data.projectId).catch((error) => {
      console.warn(
        `Failed to publish project deleted realtime event for missing project ${job.data.projectId}:`,
        error
      );
    });
    return { success: true, deleted: true, missing: true };
  }

  initK8sClient();

  const environmentList = await db.query.environments.findMany({
    where: eq(environments.projectId, project.id),
    columns: {
      namespace: true,
    },
  });

  const namespaces = [
    ...new Set(
      environmentList
        .map((environment) => environment.namespace)
        .filter((namespace): namespace is string => Boolean(namespace))
    ),
  ];

  if (getIsConnected() && namespaces.length > 0) {
    await Promise.all(namespaces.map((namespace) => deleteNamespace(namespace)));

    const cleanupResults = await Promise.all(
      namespaces.map(async (namespace) => ({
        namespace,
        deleted: await waitForNamespaceDeleted({ name: namespace }),
      }))
    );
    const pendingNamespaces = cleanupResults
      .filter((result) => !result.deleted)
      .map((result) => result.namespace);

    if (pendingNamespaces.length > 0) {
      await publishProjectRealtimeSnapshot(project.id).catch((error) => {
        console.warn(`Failed to refresh deleting project snapshot for ${project.id}:`, error);
      });
      throw new Error(`Project resources are still cleaning up: ${pendingNamespaces.join(', ')}`);
    }
  }

  await db.delete(projects).where(eq(projects.id, project.id));

  await publishProjectDeletedRealtimeEvent(project.id).catch((error) => {
    console.warn(`Failed to publish project deleted realtime event for ${project.id}:`, error);
  });

  return { success: true, deleted: true };
}

export function createProjectDeleteWorker() {
  return new Worker<ProjectDeleteJobData>('project-delete', processProjectDelete, {
    connection: resolveRedisConnectionOptions({
      maxRetriesPerRequest: null,
    }),
    concurrency: 2,
  });
}
