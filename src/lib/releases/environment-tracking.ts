import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { releases } from '@/lib/db/schema';
import { isPreviewEnvironment, isPromoteOnlyEnvironment } from '@/lib/environments/model';
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

export function buildReleaseEnvironmentTagName(input: {
  environmentName: string;
  createdAt: Date | string;
  sourceCommitSha: string | null;
}): string | null {
  if (!input.sourceCommitSha) {
    return null;
  }

  const createdAt = input.createdAt instanceof Date ? input.createdAt : new Date(input.createdAt);

  return `juanie-${slugifyBranchSegment(input.environmentName)}-${createdAt
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '.')}-${input.sourceCommitSha.slice(0, 7)}`;
}

export async function syncReleaseGitTracking(releaseId: string): Promise<{
  branchSynced: boolean;
  tagSynced: boolean;
}> {
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
    return {
      branchSynced: false,
      tagSynced: false,
    };
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

  let tagSynced = false;
  const tagName = isPromoteOnlyEnvironment(release.environment)
    ? buildReleaseEnvironmentTagName({
        environmentName: release.environment.name,
        createdAt: release.createdAt,
        sourceCommitSha: release.sourceCommitSha,
      })
    : null;

  if (tagName) {
    await gateway.createTag(session, {
      repoFullName: release.project.repository.fullName,
      tag: tagName,
      commitSha: release.sourceCommitSha,
    });
    tagSynced = true;
  }

  return {
    branchSynced: true,
    tagSynced,
  };
}

export async function syncReleaseGitTrackingSafely(releaseId: string): Promise<void> {
  await syncReleaseGitTracking(releaseId).catch((error) => {
    console.warn(`[Release] Failed to sync release git tracking for ${releaseId}:`, error);
  });
}
