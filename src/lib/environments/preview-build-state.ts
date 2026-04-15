import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { type DeploymentStatus, environments } from '@/lib/db/schema';

interface SetPreviewEnvironmentBuildStateInput {
  environmentId: string;
  status: Extract<DeploymentStatus, 'building' | 'failed'> | null;
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
  startedAt?: Date | null;
}

export async function setPreviewEnvironmentBuildState(
  input: SetPreviewEnvironmentBuildStateInput
): Promise<void> {
  await db
    .update(environments)
    .set({
      previewBuildStatus: input.status,
      previewBuildSourceRef: input.status ? (input.sourceRef ?? null) : null,
      previewBuildSourceCommitSha: input.status ? (input.sourceCommitSha ?? null) : null,
      previewBuildStartedAt: input.status ? (input.startedAt ?? new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(environments.id, input.environmentId));
}

export async function clearPreviewEnvironmentBuildState(environmentId: string): Promise<void> {
  await setPreviewEnvironmentBuildState({
    environmentId,
    status: null,
  });
}
