import { buildReleaseDetailPath } from '@/lib/releases/paths';
import { PreviewDatabaseGuardBlockedError } from '@/lib/releases/preview-database-guard';
import { ReleaseSchemaGateBlockedError } from '@/lib/schema-safety';

export interface AdmissionFailureReleasePayload {
  id: string;
  projectId: string;
  environmentId: string;
  status: 'admission_failed';
  releasePath: string;
}

export interface AdmissionFailureResponsePayload {
  error: string;
  releaseId?: string;
  releasePath?: string | null;
  release?: AdmissionFailureReleasePayload | null;
}

function buildAdmissionFailureReleasePayload(
  release:
    | {
        id: string;
        projectId: string;
        environmentId: string;
        releasePath?: string | null;
      }
    | null
    | undefined
): AdmissionFailureReleasePayload | null {
  if (!release) {
    return null;
  }

  return {
    id: release.id,
    projectId: release.projectId,
    environmentId: release.environmentId,
    status: 'admission_failed',
    releasePath:
      release.releasePath ??
      buildReleaseDetailPath(release.projectId, release.environmentId, release.id),
  };
}

export function getAdmissionFailureResponsePayload(error: unknown): {
  error: string;
  releaseId?: string;
  releasePath?: string | null;
  release?: AdmissionFailureReleasePayload | null;
} | null {
  if (
    !(error instanceof ReleaseSchemaGateBlockedError) &&
    !(error instanceof PreviewDatabaseGuardBlockedError)
  ) {
    return null;
  }

  const release = buildAdmissionFailureReleasePayload(error.release);

  return {
    error: error.message,
    releaseId: release?.id,
    releasePath: release?.releasePath ?? null,
    release,
  };
}
