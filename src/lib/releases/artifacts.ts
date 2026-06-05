export type ReleaseArtifactRecordLike = {
  kind?: string | null;
  name?: string | null;
  variant?: string | null;
  platform?: string | null;
  format?: string | null;
  uri?: string | null;
  imageUrl?: string | null;
  serviceId?: string | null;
  service?: {
    id: string;
    name: string;
  } | null;
};

export function getReleaseArtifactKind(artifact: ReleaseArtifactRecordLike): string {
  return artifact.kind ?? 'image';
}

export function getReleaseArtifactUri(artifact: ReleaseArtifactRecordLike): string | null {
  return artifact.uri ?? artifact.imageUrl ?? null;
}

export function isDeployableReleaseArtifact(artifact: ReleaseArtifactRecordLike): boolean {
  return (
    getReleaseArtifactKind(artifact) === 'image' &&
    Boolean(artifact.serviceId ?? artifact.service?.id) &&
    Boolean(getReleaseArtifactUri(artifact))
  );
}

export function getDeployableReleaseArtifacts<T extends ReleaseArtifactRecordLike>(
  artifacts: T[]
): T[] {
  return artifacts.filter((artifact) => isDeployableReleaseArtifact(artifact));
}

export function getDeliveryReleaseArtifacts<T extends ReleaseArtifactRecordLike>(
  artifacts: T[]
): T[] {
  return artifacts.filter((artifact) => !isDeployableReleaseArtifact(artifact));
}

export function getReleaseArtifactIdentity(artifact: ReleaseArtifactRecordLike): string {
  if (isDeployableReleaseArtifact(artifact)) {
    return ['image', artifact.serviceId ?? artifact.service?.id ?? artifact.service?.name ?? '']
      .filter(Boolean)
      .join(':');
  }

  return [
    getReleaseArtifactKind(artifact),
    artifact.name ?? '',
    artifact.variant ?? '',
    artifact.platform ?? '',
  ].join(':');
}

export function getReleaseArtifactDisplayName(artifact: ReleaseArtifactRecordLike): string {
  if (artifact.service?.name) {
    return artifact.service.name;
  }

  return (
    [artifact.name, artifact.variant, artifact.platform].filter(Boolean).join(' / ') || 'artifact'
  );
}

export function getReleaseArtifactKindLabel(artifact: ReleaseArtifactRecordLike): string {
  switch (getReleaseArtifactKind(artifact)) {
    case 'image':
      return '部署镜像';
    case 'package':
      return '包';
    case 'baremetal':
      return '裸机包';
    case 'archive':
      return '归档';
    default:
      return '制品';
  }
}
