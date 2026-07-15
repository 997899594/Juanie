import { eq } from 'drizzle-orm';
import { accessError } from '@/lib/api/errors';
import { createSignedArtifactUpload } from '@/lib/artifacts/storage';
import { db } from '@/lib/db';
import {
  type ReleaseArtifactKind,
  type ReleaseArtifactStatus,
  releaseArtifacts,
  releases,
} from '@/lib/db/schema';
import { publishReleaseRealtimeSnapshot } from '@/lib/realtime/releases';
import { verifyRepositoryAccess } from '@/lib/releases/api-access';
import { isUuid } from '@/lib/uuid';

const deliveryArtifactKinds = new Set(['package', 'baremetal', 'archive']);
const deliveryArtifactStatuses = new Set(['pending', 'building', 'succeeded', 'failed']);

export interface DeliveryArtifactRegistrationInput {
  kind: Exclude<ReleaseArtifactKind, 'image'>;
  name: string;
  variant?: string | null;
  platform?: string | null;
  format?: string | null;
  uri: string;
  checksum?: string | null;
  sizeBytes?: number | null;
  sbomUri?: string | null;
  provenanceUri?: string | null;
  status?: ReleaseArtifactStatus | null;
  sourceImageUri?: string | null;
  sourceImageDigest?: string | null;
  sourceImagePlatform?: string | null;
}

function assertDeliveryArtifact(input: DeliveryArtifactRegistrationInput, index: number) {
  if (!deliveryArtifactKinds.has(input.kind)) {
    throw accessError('invalid_scope', `Artifact ${index} has unsupported kind`);
  }

  if (!input.name?.trim()) {
    throw accessError('invalid_scope', `Artifact ${index} is missing name`);
  }

  if (!input.uri?.trim()) {
    throw accessError('invalid_scope', `Artifact ${index} is missing uri`);
  }

  if (input.status && !deliveryArtifactStatuses.has(input.status)) {
    throw accessError('invalid_scope', `Artifact ${input.name} has unsupported status`);
  }
}

async function getReleaseForRepository(releaseId: string) {
  if (!isUuid(releaseId)) {
    throw accessError('not_found', 'Release not found');
  }

  const release = await db.query.releases.findFirst({
    where: eq(releases.id, releaseId),
    with: {
      project: {
        with: {
          repository: true,
        },
      },
    },
  });

  if (!release?.project.repository?.fullName) {
    throw accessError('not_found', 'Release not found');
  }

  return release;
}

function assertReleaseAcceptsDeliveryArtifacts(
  release: Awaited<ReturnType<typeof getReleaseForRepository>>
) {
  if (release.status === 'succeeded' || release.status === 'awaiting_rollout') {
    return;
  }

  throw accessError(
    'invalid_scope',
    `Release ${release.id} is ${release.status}; delivery artifacts can only be attached after verification`
  );
}

export async function createManagedArtifactUpload(input: {
  repository: string;
  releaseId: string;
  name: string;
  variant?: string | null;
  platform?: string | null;
  format?: string | null;
  contentType?: string | null;
  authHeader: string | null;
}) {
  const release = await getReleaseForRepository(input.releaseId);
  if (release.project.repository?.fullName !== input.repository) {
    throw accessError('forbidden', 'Release does not belong to repository');
  }

  assertReleaseAcceptsDeliveryArtifacts(release);
  await verifyRepositoryAccess(input.repository, input.authHeader, {
    projectId: release.projectId,
    repositoryId: release.project.repository?.id,
    ref: release.sourceRef,
    sha: release.sourceCommitSha,
    externalRunId: release.externalRunId,
  });

  return createSignedArtifactUpload({
    projectId: release.projectId,
    releaseId: release.id,
    name: input.name,
    variant: input.variant,
    platform: input.platform,
    format: input.format,
    contentType: input.contentType,
  });
}

export async function appendReleaseDeliveryArtifacts(input: {
  releaseId: string;
  repository: string;
  artifacts: DeliveryArtifactRegistrationInput[];
  authHeader: string | null;
}) {
  const release = await getReleaseForRepository(input.releaseId);
  if (release.project.repository?.fullName !== input.repository) {
    throw accessError('forbidden', 'Release does not belong to repository');
  }

  assertReleaseAcceptsDeliveryArtifacts(release);
  await verifyRepositoryAccess(input.repository, input.authHeader, {
    projectId: release.projectId,
    repositoryId: release.project.repository?.id,
    ref: release.sourceRef,
    sha: release.sourceCommitSha,
    externalRunId: release.externalRunId,
  });

  if (!Array.isArray(input.artifacts) || input.artifacts.length === 0) {
    throw accessError('invalid_scope', 'At least one artifact is required');
  }

  const values = input.artifacts.map((artifact, index) => {
    assertDeliveryArtifact(artifact, index);

    return {
      releaseId: release.id,
      serviceId: null,
      kind: artifact.kind,
      name: artifact.name.trim(),
      variant: artifact.variant?.trim() || null,
      platform: artifact.platform?.trim() || null,
      format: artifact.format?.trim() || null,
      uri: artifact.uri.trim(),
      checksum: artifact.checksum?.trim() || null,
      sizeBytes:
        typeof artifact.sizeBytes === 'number' && Number.isFinite(artifact.sizeBytes)
          ? Math.max(0, Math.trunc(artifact.sizeBytes))
          : null,
      sbomUri: artifact.sbomUri?.trim() || null,
      provenanceUri: artifact.provenanceUri?.trim() || null,
      status: artifact.status ?? 'succeeded',
      imageUrl: null,
      imageDigest: null,
      sourceImageUri: artifact.sourceImageUri?.trim() || null,
      sourceImageDigest: artifact.sourceImageDigest?.trim() || null,
      sourceImagePlatform:
        artifact.sourceImagePlatform?.trim() || artifact.platform?.trim() || null,
    };
  });

  const inserted = [];
  for (const value of values) {
    const [artifact] = await db
      .insert(releaseArtifacts)
      .values(value)
      .onConflictDoUpdate({
        target: [
          releaseArtifacts.releaseId,
          releaseArtifacts.kind,
          releaseArtifacts.name,
          releaseArtifacts.variant,
          releaseArtifacts.platform,
        ],
        set: {
          uri: value.uri,
          checksum: value.checksum,
          sizeBytes: value.sizeBytes,
          sbomUri: value.sbomUri,
          provenanceUri: value.provenanceUri,
          status: value.status,
          sourceImageUri: value.sourceImageUri,
          sourceImageDigest: value.sourceImageDigest,
          sourceImagePlatform: value.sourceImagePlatform,
        },
      })
      .returning();
    if (artifact) {
      inserted.push(artifact);
    }
  }

  await publishReleaseRealtimeSnapshot(release.id);

  return inserted;
}
