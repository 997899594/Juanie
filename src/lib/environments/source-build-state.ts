import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { type DeploymentStatus, environments } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { publishProjectInitRealtimeEvent } from '@/lib/realtime/project-init';
import { publishProjectRealtimeSnapshot } from '@/lib/realtime/projects';

const sourceBuildStateLogger = logger.child({ component: 'environment-source-build-state' });

interface SetEnvironmentSourceBuildStateInput {
  environmentId: string;
  status: Extract<DeploymentStatus, 'building' | 'failed'> | null;
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
  startedAt?: Date | null;
}

export async function setEnvironmentSourceBuildState(
  input: SetEnvironmentSourceBuildStateInput
): Promise<void> {
  const [environment] = await db
    .update(environments)
    .set({
      // Persist source-build state in the existing environment build columns so preview and
      // persistent direct environments share one code path without introducing a second store.
      previewBuildStatus: input.status,
      previewBuildSourceRef: input.status ? (input.sourceRef ?? null) : null,
      previewBuildSourceCommitSha: input.status ? (input.sourceCommitSha ?? null) : null,
      previewBuildStartedAt: input.status ? (input.startedAt ?? new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(environments.id, input.environmentId))
    .returning({
      id: environments.id,
      projectId: environments.projectId,
      isPreview: environments.isPreview,
    });

  if (!environment) {
    return;
  }

  await publishProjectRealtimeSnapshot(environment.projectId).catch((error) => {
    sourceBuildStateLogger.warn(
      'Failed to publish project realtime snapshot after source build update',
      {
        environmentId: environment.id,
        projectId: environment.projectId,
        errorMessage: error instanceof Error ? error.message : String(error),
      }
    );
  });

  if (!environment.isPreview) {
    await publishProjectInitRealtimeEvent({
      kind: 'step_updated',
      projectId: environment.projectId,
      step: 'trigger_initial_builds',
      status: input.status ?? 'completed',
      progress: null,
      timestamp: Date.now(),
    }).catch((error) => {
      sourceBuildStateLogger.warn(
        'Failed to publish project init realtime event after source build update',
        {
          environmentId: environment.id,
          projectId: environment.projectId,
          errorMessage: error instanceof Error ? error.message : String(error),
        }
      );
    });
  }
}

export async function clearEnvironmentSourceBuildState(environmentId: string): Promise<void> {
  await setEnvironmentSourceBuildState({
    environmentId,
    status: null,
  });
}
