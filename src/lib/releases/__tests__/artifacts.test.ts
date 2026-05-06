import { describe, expect, it } from 'bun:test';
import {
  getDeliveryReleaseArtifacts,
  getDeployableReleaseArtifacts,
  getReleaseArtifactDisplayName,
  getReleaseArtifactKindLabel,
  getReleaseArtifactUri,
  isDeployableReleaseArtifact,
} from '@/lib/releases/artifacts';

describe('release artifact helpers', () => {
  it('keeps image artifacts deployable while leaving customer packages out of deployment', () => {
    const artifacts = [
      {
        kind: 'image',
        serviceId: 'svc-web',
        imageUrl: 'ghcr.io/acme/web:sha-1',
        service: {
          id: 'svc-web',
          name: 'web',
        },
      },
      {
        kind: 'package',
        name: 'kit',
        variant: 'sdk',
        platform: 'any',
        uri: 's3://artifacts/kit-sdk.tgz',
      },
    ];

    expect(isDeployableReleaseArtifact(artifacts[0])).toBe(true);
    expect(isDeployableReleaseArtifact(artifacts[1])).toBe(false);
    expect(getDeployableReleaseArtifacts(artifacts).length).toBe(1);
    expect(getDeliveryReleaseArtifacts(artifacts).length).toBe(1);
  });

  it('uses uri as the canonical artifact location and imageUrl as image fallback', () => {
    expect(getReleaseArtifactUri({ uri: 's3://artifacts/kit.tgz' })).toBe('s3://artifacts/kit.tgz');
    expect(getReleaseArtifactUri({ imageUrl: 'ghcr.io/acme/web:sha-1' })).toBe(
      'ghcr.io/acme/web:sha-1'
    );
  });

  it('builds readable names for package variants without a service', () => {
    expect(
      getReleaseArtifactDisplayName({
        kind: 'package',
        name: 'kit',
        variant: 'viewer-runtime',
        platform: 'any',
      })
    ).toBe('kit / viewer-runtime / any');
  });

  it('labels artifact kinds with product-facing delivery language', () => {
    expect(getReleaseArtifactKindLabel({ kind: 'image' })).toBe('部署镜像');
    expect(getReleaseArtifactKindLabel({ kind: 'baremetal' })).toBe('裸机包');
  });
});
