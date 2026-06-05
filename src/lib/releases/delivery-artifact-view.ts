import {
  getDeliveryReleaseArtifacts,
  getReleaseArtifactIdentity,
  getReleaseArtifactUri,
  type ReleaseArtifactRecordLike,
} from '@/lib/releases/artifacts';

export interface DeliveryArtifactViewSourceArtifact extends ReleaseArtifactRecordLike {
  id?: string | null;
  releaseId?: string | null;
  status?: string | null;
  sourceImageDigest?: string | null;
}

export interface DeliveryArtifactViewItem {
  id?: string | null;
  releaseId?: string | null;
  kind?: string | null;
  name?: string | null;
  variant?: string | null;
  platform?: string | null;
  format?: string | null;
  uri?: string | null;
  status?: string | null;
  sourceImageDigest?: string | null;
}

export function buildDeliveryArtifactViewItems(input: {
  currentReleaseId: string;
  currentArtifacts?: DeliveryArtifactViewSourceArtifact[] | null;
  sourceRelease?: {
    id: string;
    artifacts?: DeliveryArtifactViewSourceArtifact[] | null;
  } | null;
}): DeliveryArtifactViewItem[] {
  const seen = new Set<string>();
  const deliveryArtifacts = [
    ...getDeliveryReleaseArtifacts(input.currentArtifacts ?? []).map((artifact) => ({
      artifact,
      fallbackReleaseId: input.currentReleaseId,
    })),
    ...getDeliveryReleaseArtifacts(input.sourceRelease?.artifacts ?? []).map((artifact) => ({
      artifact,
      fallbackReleaseId: input.sourceRelease?.id ?? input.currentReleaseId,
    })),
  ].filter(({ artifact }) => {
    const key = getReleaseArtifactIdentity(artifact);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  return deliveryArtifacts.map(({ artifact, fallbackReleaseId }) => ({
    id: artifact.id,
    releaseId: artifact.releaseId ?? fallbackReleaseId,
    kind: artifact.kind,
    name: artifact.name,
    variant: artifact.variant,
    platform: artifact.platform,
    format: artifact.format,
    uri: getReleaseArtifactUri(artifact),
    status: artifact.status,
    sourceImageDigest: artifact.sourceImageDigest,
  }));
}
