import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { type DeploymentStatus, environments } from '@/lib/db/schema';

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
  await db
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
    .where(eq(environments.id, input.environmentId));
}

export async function clearEnvironmentSourceBuildState(environmentId: string): Promise<void> {
  await setEnvironmentSourceBuildState({
    environmentId,
    status: null,
  });
}
