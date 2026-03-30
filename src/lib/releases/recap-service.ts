import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { releases } from '@/lib/db/schema';
import { getReleaseById } from '@/lib/releases';
import { buildReleaseRecap, type ReleaseRecapRecord } from '@/lib/releases/recap';
import { getReleaseOperationalContext } from '@/lib/releases/runtime-context';

export async function persistReleaseRecapById(
  releaseId: string
): Promise<ReleaseRecapRecord | null> {
  const release = await getReleaseById(releaseId);
  if (!release) {
    return null;
  }

  const runtimeContext = await getReleaseOperationalContext({
    projectId: release.projectId,
    teamId: release.project.teamId,
    environmentId: release.environmentId,
    environmentName: release.environment.name,
    environmentIsPreview: release.environment.isPreview,
    namespace: release.environment.namespace,
    deploymentStrategy: release.environment.deploymentStrategy,
    releaseWindow: {
      startedAt: release.createdAt,
      finishedAt: release.updatedAt,
    },
  });

  const recap = buildReleaseRecap({
    ...release,
    infrastructureDiagnostics: runtimeContext.infrastructureDiagnostics,
    governanceEvents: runtimeContext.governanceEvents,
  });

  await db
    .update(releases)
    .set({
      recap,
    })
    .where(eq(releases.id, release.id));

  return recap;
}

export async function persistLatestEnvironmentReleaseRecap(input: {
  projectId: string;
  environmentId: string;
}): Promise<ReleaseRecapRecord | null> {
  const latestRelease = await db.query.releases.findFirst({
    where: and(
      eq(releases.projectId, input.projectId),
      eq(releases.environmentId, input.environmentId)
    ),
    orderBy: [desc(releases.createdAt)],
    columns: {
      id: true,
    },
  });

  if (!latestRelease) {
    return null;
  }

  return persistReleaseRecapById(latestRelease.id);
}
