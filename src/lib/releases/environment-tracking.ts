import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { releases } from '@/lib/db/schema';
import { isPreviewEnvironment } from '@/lib/environments/model';
import {
  gateway,
  getTeamIntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';

function slugifyBranchSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return normalized.length > 0 ? normalized : 'environment';
}

export function buildEnvironmentTrackingBranchName(environmentName: string): string {
  return `juanie-env-${slugifyBranchSegment(environmentName)}`;
}

export async function syncReleaseEnvironmentTrackingBranch(releaseId: string): Promise<boolean> {
  const release = await db.query.releases.findFirst({
    where: eq(releases.id, releaseId),
    with: {
      environment: true,
      project: {
        columns: {
          id: true,
          teamId: true,
          name: true,
        },
        with: {
          repository: {
            columns: {
              fullName: true,
            },
          },
        },
      },
    },
  });

  if (
    !release ||
    release.status !== 'succeeded' ||
    !release.sourceCommitSha ||
    !release.project.repository ||
    isPreviewEnvironment(release.environment)
  ) {
    return false;
  }

  const session = await getTeamIntegrationSession({
    teamId: release.project.teamId,
    actingUserId: release.triggeredByUserId ?? null,
    requiredCapabilities: ['write_repo'],
  });

  await gateway.syncBranchRef(session, {
    repoFullName: release.project.repository.fullName,
    branch: buildEnvironmentTrackingBranchName(release.environment.name),
    commitSha: release.sourceCommitSha,
  });

  return true;
}

export async function syncReleaseEnvironmentTrackingBranchSafely(releaseId: string): Promise<void> {
  await syncReleaseEnvironmentTrackingBranch(releaseId).catch((error) => {
    console.warn(`[Release] Failed to sync environment tracking branch for ${releaseId}:`, error);
  });
}
