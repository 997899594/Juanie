import type { BuildPlan } from '@/lib/builds/plan';

export interface RegisteredDeliveryArtifact {
  kind: string;
  name: string | null;
  variant: string | null;
  platform: string | null;
  format: string | null;
  uri: string | null;
  checksum: string | null;
  sourceImageDigest: string | null;
  status: string;
}

function deliveryArtifactKey(input: {
  kind: string;
  name: string;
  variant: string;
  platform: string;
  format: string;
}): string {
  return [input.kind, input.name, input.variant, input.platform, input.format].join(':');
}

export function assessDeliveryArtifacts(
  plan: Pick<BuildPlan, 'deliverables'>,
  artifacts: RegisteredDeliveryArtifact[]
): { expected: number; missing: string[]; invalid: string[] } {
  const registered = new Map(
    artifacts
      .filter((artifact) => artifact.name && artifact.variant)
      .map((artifact) => [
        deliveryArtifactKey({
          kind: artifact.kind,
          name: artifact.name!,
          variant: artifact.variant!,
          platform: artifact.platform ?? 'any',
          format: artifact.format ?? 'tgz',
        }),
        artifact,
      ])
  );
  const expectedKeys = plan.deliverables.map((deliverable) =>
    deliveryArtifactKey({
      kind: deliverable.type,
      name: deliverable.name,
      variant: deliverable.variant.name,
      platform: deliverable.variant.platform ?? deliverable.variant.package.platform ?? 'any',
      format: deliverable.variant.package.format,
    })
  );
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const key of expectedKeys) {
    const artifact = registered.get(key);
    if (!artifact) {
      missing.push(key);
      continue;
    }
    if (
      artifact.status !== 'succeeded' ||
      !artifact.uri ||
      !/^sha256:[0-9a-f]{64}$/u.test(artifact.checksum ?? '') ||
      !/^sha256:[0-9a-f]{64}$/u.test(artifact.sourceImageDigest ?? '')
    ) {
      invalid.push(key);
    }
  }

  return { expected: expectedKeys.length, missing, invalid };
}
