import { and, eq } from 'drizzle-orm';
import { accessError } from '@/lib/api/errors';
import { createSignedArtifactDownload, isManagedArtifactReference } from '@/lib/artifacts/storage';
import { db } from '@/lib/db';
import { artifactDownloadEvents, releaseArtifacts, teamMembers } from '@/lib/db/schema';
import { canDownloadReleaseArtifact } from '@/lib/policies/runtime-access';
import { getReleaseArtifactDisplayName, getReleaseArtifactUri } from '@/lib/releases/artifacts';
import { isUuid } from '@/lib/uuid';

export interface ArtifactDownloadAuditContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function createReleaseArtifactDownload(input: {
  releaseId: string;
  artifactId: string;
  userId: string;
  audit?: ArtifactDownloadAuditContext;
}) {
  if (!isUuid(input.releaseId) || !isUuid(input.artifactId)) {
    throw accessError('not_found', 'Artifact not found');
  }

  const artifact = await db.query.releaseArtifacts.findFirst({
    where: and(
      eq(releaseArtifacts.id, input.artifactId),
      eq(releaseArtifacts.releaseId, input.releaseId)
    ),
    with: {
      service: true,
      release: {
        with: {
          project: true,
        },
      },
    },
  });

  if (!artifact) {
    throw accessError('not_found', 'Artifact not found');
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.teamId, artifact.release.project.teamId),
      eq(teamMembers.userId, input.userId)
    ),
  });

  if (!member || !canDownloadReleaseArtifact(member.role, artifact)) {
    throw accessError('forbidden', 'Forbidden');
  }

  const uri = getReleaseArtifactUri(artifact);
  if (!isManagedArtifactReference(uri)) {
    throw accessError(
      'invalid_scope',
      'Artifact is not available through Juanie managed downloads'
    );
  }

  const filename = [
    getReleaseArtifactDisplayName(artifact),
    artifact.variant,
    artifact.platform,
    artifact.format,
  ]
    .filter(Boolean)
    .join('-');
  const download = await createSignedArtifactDownload({
    uri,
    filename: filename || null,
  });

  await db.insert(artifactDownloadEvents).values({
    teamId: artifact.release.project.teamId,
    projectId: artifact.release.projectId,
    releaseId: artifact.releaseId,
    artifactId: artifact.id,
    userId: input.userId,
    ipAddress: input.audit?.ipAddress ?? null,
    userAgent: input.audit?.userAgent ?? null,
  });

  return {
    ...download,
    artifact: {
      id: artifact.id,
      name: getReleaseArtifactDisplayName(artifact),
    },
  };
}
